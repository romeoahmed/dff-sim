/**
 * 仿真控制器 (主线程)
 *
 * 1. 负责 UI 交互与 DOM 更新
 * 2. 负责 Worker 线程的生命周期管理
 * 3. 监听布局变化并通知 Worker
 * 4. 接收 Worker 的状态回传并显示
 */

import { Layout, Simulation, VoltageSpecs } from "../common/constants";
import SimulationWorker from "../worker/entry?worker";
import type {
  VoltageSpecConfig,
  UIElements,
  WorkerInitMessage,
  WorkerParamMessage,
  WorkerResizeMessage,
  WorkerStatusMessage,
} from "../common/types";

/**
 * 仿真应用主类
 */
export class SimulationApp {
  // --- 核心组件 ---
  private worker: Worker;
  private resizeObserver: ResizeObserver | null = null;

  // --- UI 缓存 ---
  private ui: UIElements;

  // --- 本地状态 ---
  private localTargetLogicD: 0 | 1 = 0;

  constructor() {
    // 1. 缓存 DOM 元素
    this.ui = this.cacheDomElements();

    // 2. 初始化 Worker
    this.worker = new SimulationWorker();
    this.initWorkerBridge();

    // 3. 绑定交互事件
    this.bindEvents();
  }

  /**
   * 缓存所有需要的 DOM 元素，并进行非空检查
   */
  private cacheDomElements(): UIElements {
    const getEl = (id: string) => {
      const el = document.getElementById(id);
      if (!el) throw new Error(`Element #${id} not found`);
      return el;
    };
    const getInputEl = (id: string) => {
      const el = document.getElementById(id);
      if (!el) throw new Error(`Element #${id} not found`);
      if (!(el instanceof HTMLInputElement)) {
        throw new Error(`Element #${id} is not an input element`);
      }
      return el;
    };
    const getPin = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`Selector ${sel} not found`);
      return el;
    };

    return {
      volts: {
        d: getEl("volt-d"),
        clk: getEl("volt-clk"),
        q: getEl("volt-q"),
      },
      pins: {
        d: getPin(".pin.input-d"),
        clk: getPin(".pin.input-clk"),
        q: getPin(".pin.output-q"),
      },
      controls: {
        btnToggleD: getEl("btn-toggle-d"),
        btnStd: getEl("btn-mode-std"),
        btnExp: getEl("btn-mode-exp"),
        btnReset: getEl("btn-reset"),
        sldNoise: getInputEl("noiseSlider"),
        sldSpeed: getInputEl("speedSlider"),
        valNoise: getEl("noiseVal"),
        valSpeed: getEl("speedVal"),
      },
    };
  }

  /**
   * 初始化 Worker 通信桥接
   *
   * 移交 Canvas 控制权 (OffscreenCanvas)
   */
  private initWorkerBridge() {
    const canvasWaveform = document.getElementById("waveform-canvas");
    const canvasDigital = document.getElementById("digital-canvas");

    if (!canvasWaveform || !canvasDigital) {
      throw new Error("Canvas elements missing");
    }
    if (!(canvasWaveform instanceof HTMLCanvasElement)) {
      throw new Error("#waveform-canvas is not a canvas element");
    }
    if (!(canvasDigital instanceof HTMLCanvasElement)) {
      throw new Error("#digital-canvas is not a canvas element");
    }

    // 1. 控制权移交：主线程不再拥有绘图上下文
    const offscreenWaveform = canvasWaveform.transferControlToOffscreen();
    const offscreenDigital = canvasDigital.transferControlToOffscreen();

    // 2. 获取初始尺寸
    const parent = canvasWaveform.parentElement;
    const width = parent
      ? parent.getBoundingClientRect().width - Layout.canvasPadding
      : 800;
    const dpr = window.devicePixelRatio || 1;

    // 3. 发送初始化消息
    const initMsg: WorkerInitMessage = {
      type: "INIT",
      canvasWaveform: offscreenWaveform,
      canvasDigital: offscreenDigital,
      width,
      height: Layout.canvasHeight,
      digitalHeight: Layout.digitalScopeHeight,
      dpr,
    };

    // Transfer List
    this.worker.postMessage(initMsg, [offscreenWaveform, offscreenDigital]);

    // 4. 监听 Worker 回传 (更新 UI 数值)
    this.worker.onmessage = (e) => {
      const msg = e.data as WorkerStatusMessage;
      if (msg.type === "STATUS_UPDATE") {
        this.updateVoltageDisplay(msg.d, msg.clk, msg.q);
      }
    };

    // 5. 监听容器 Resize
    this.initResizeObserver(canvasWaveform);
  }

  /**
   * 初始化 ResizeObserver 以监听父容器尺寸变化
   * @param target - 目标元素
   */
  private initResizeObserver(target: HTMLElement) {
    if (!target.parentElement) return;

    this.resizeObserver = new ResizeObserver(() => {
      const parent = target.parentElement;
      if (parent) {
        const w = parent.getBoundingClientRect().width - Layout.canvasPadding;
        const resizeMsg: WorkerResizeMessage = {
          type: "RESIZE",
          width: w,
          height: Layout.canvasHeight,
          digitalHeight: Layout.digitalScopeHeight,
          dpr: window.devicePixelRatio || 1,
        };
        this.worker.postMessage(resizeMsg);
      }
    });
    this.resizeObserver.observe(target.parentElement);
  }

  /**
   * 绑定所有交互事件
   */
  private bindEvents() {
    const { controls } = this.ui;

    // 1. 切换 Input D
    controls.btnToggleD.addEventListener("click", () => {
      this.localTargetLogicD = this.localTargetLogicD === 1 ? 0 : 1;
      this.renderToggleBtnState();
      this.sendParam("toggleD", this.localTargetLogicD === 1);
    });

    // 2. 噪声控制
    controls.sldNoise.addEventListener("input", (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      controls.valNoise.textContent = `${val} %`;
      this.sendParam("noise", val);
    });

    // 3. 速度控制
    controls.sldSpeed.addEventListener("input", (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      const freqHz =
        (Simulation.baseFrameRate * val * Simulation.clockSpeedFactor) /
        (2 * Math.PI);
      controls.valSpeed.textContent = `${freqHz.toFixed(2)} Hz`;
      this.sendParam("speed", val);
    });

    // 4. 重置 (Hold)
    const setReset = (active: boolean) => {
      controls.btnReset.classList.toggle("active", active);
      this.sendParam("reset", active);
    };
    controls.btnReset.addEventListener("pointerdown", () => setReset(true));
    controls.btnReset.addEventListener("pointerup", () => setReset(false));
    controls.btnReset.addEventListener("pointerleave", () => setReset(false));

    // 5. 切换渲染模式
    controls.btnStd.addEventListener("click", () => {
      controls.btnStd.classList.add("active");
      controls.btnExp.classList.remove("active");
      this.worker.postMessage({ type: "SWITCH_RENDERER", mode: "standard" });
    });

    controls.btnExp.addEventListener("click", () => {
      controls.btnExp.classList.add("active");
      controls.btnStd.classList.remove("active");
      this.worker.postMessage({
        type: "SWITCH_RENDERER",
        mode: "experimental",
      });
    });
  }

  /**
   * 辅助：向 Worker 发送参数更新
   * @param key - 参数键
   * @param value - 参数值
   */
  private sendParam(key: WorkerParamMessage["key"], value: number | boolean) {
    this.worker.postMessage({ type: "PARAM_UPDATE", key, value });
  }

  /**
   * 渲染 Toggle 按钮的视觉状态
   */
  private renderToggleBtnState() {
    const btn = this.ui.controls.btnToggleD;
    const isHigh = this.localTargetLogicD === 1;

    // 使用 CSS 类控制图标显隐
    btn.classList.toggle("active", isHigh);

    const iconOff = btn.querySelector(".icon-off") as HTMLElement;
    const iconOn = btn.querySelector(".icon-on") as HTMLElement;
    const textSpan = btn.querySelector(".btn-text") as HTMLElement;

    if (iconOff) iconOff.style.display = isHigh ? "none" : "inline";
    if (iconOn) iconOn.style.display = isHigh ? "inline" : "none";
    if (textSpan)
      textSpan.textContent = isHigh ? "Input D: HIGH" : "Input D: LOW";
  }

  /**
   * 更新电压数值显示与引脚高亮
   *
   * @param d - D 引脚电压
   * @param clk - CLK 引脚电压
   * @param q - Q 引脚电压
   */
  private updateVoltageDisplay(d: number, clk: number, q: number) {
    const { volts, pins } = this.ui;
    const threshold = VoltageSpecs.logicHighMin;

    // 更新文本
    volts.d.textContent = d.toFixed(2) + "V";
    volts.clk.textContent = clk.toFixed(2) + "V";
    volts.q.textContent = q.toFixed(2) + "V";

    // 更新高亮
    pins.d.classList.toggle("active", d > threshold);
    pins.clk.classList.toggle("active", clk > threshold);
    pins.q.classList.toggle("active", q > threshold);
  }

  /**
   * 更新仿真电压参数
   *
   * 将新设置发送给 Worker 线程
   */
  public updateSettings(settings: Partial<VoltageSpecConfig>) {
    this.worker.postMessage({
      type: "SETTINGS_UPDATE",
      settings,
    });
  }

  /**
   * 销毁应用
   */
  public destroy() {
    this.resizeObserver?.disconnect();
    this.worker.terminate();
  }
}
