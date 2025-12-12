/**
 * 仿真控制器：UI 交互、物理循环调度与数据绑定
 */

import { Signal, DFlipFlop } from "./physics";
import { Oscilloscope } from "./renderer";
import { VoltageSpecs, Simulation } from "./constants";
import { WaveformBuffer } from "./buffer";
import type { SignalSample } from "./types";

/**
 * 仿真应用主类
 */
export class SimulationApp {
  // --- 物理组件 ---

  /**
   * 输入信号 D
   */
  private signalD: Signal = new Signal(
    (VoltageSpecs.logicHighMin + VoltageSpecs.systemMax) / 2, // ~1.75V
    VoltageSpecs.logicLowMax / 2, // ~0.3V
  );

  /**
   * 时钟信号 CLK
   */
  private signalClk: Signal = new Signal(VoltageSpecs.outputHighMax, 0.0);

  /**
   * D 触发器实例
   */
  private dff: DFlipFlop = new DFlipFlop();

  /**
   * 波形数据缓冲区
   */
  private waveformBuffer: WaveformBuffer = new WaveformBuffer(
    Simulation.bufferLength,
  );

  /**
   * 示波器
   */
  private scope: Oscilloscope = new Oscilloscope(
    "waveform-canvas",
    "digital-canvas",
  );

  // --- 仿真状态 ---

  /**
   * 时钟相位累加器
   */
  private clockPhase: number = 0;

  /**
   * 时钟频率步进速度
   */
  private clockSpeed: number =
    Simulation.defaultSpeed * Simulation.clockSpeedFactor; // ~0.06

  // --- DOM 元素缓存 ---

  /**
   * D 输入电压显示 DOM
   */
  private elVoltD = document.getElementById("volt-d");

  /**
   * CLK 电压显示 DOM
   */
  private elVoltClk = document.getElementById("volt-clk");

  /**
   * Q 输出电压显示 DOM
   */
  private elVoltQ = document.getElementById("volt-q");

  /**
   * D 引脚 DOM
   */
  private elPinD = document.querySelector(".pin.input-d");

  /**
   * CLK 引脚 DOM
   */
  private elPinClk = document.querySelector(".pin.input-clk");

  /**
   * Q 引脚 DOM
   */
  private elPinQ = document.querySelector(".pin.output-q");

  /**
   * D 输入切换按钮
   */
  private btnToggleD = document.getElementById("btn-toggle-d");

  /**
   * 重置按钮
   */
  private btnReset = document.getElementById("btn-reset");

  /**
   * 重置信号激活状态
   */
  private resetActive: boolean = false;

  /**
   * 噪声滑块
   */
  private sldNoise = document.getElementById("noiseSlider");

  /**
   * 速度滑块
   */
  private sldSpeed = document.getElementById("speedSlider");

  /**
   * 噪声数值显示
   */
  private elNoiseVal = document.getElementById("noiseVal");

  /**
   * 速度数值显示
   */
  private elSpeedVal = document.getElementById("speedVal");

  /**
   * 上一帧的时间戳
   */
  private lastFrameTime: number = 0;

  /**
   * 帧计数器
   */
  private frameCount: number = 0;

  // --- 脏检查缓存 (Dirty Check Cache) ---

  // 用于存储上一帧渲染的值，避免重复操作 DOM
  private cache = {
    voltD: "",
    voltClk: "",
    voltQ: "",
    pinDActive: false,
    pinClkActive: false,
    pinQActive: false,
  };

  /**
   * 初始化仿真应用，绑定 DOM 并启动主循环
   */
  constructor() {
    // 数据源绑定到示波器
    this.scope.setData(this.waveformBuffer);

    // 初始化事件监听器
    this.initListeners();

    // 启动循环
    this.loop();
  }

  /**
   * 初始化 DOM 事件监听器
   */
  private initListeners() {
    if (!this.btnToggleD) {
      throw new Error("Required element #btn-toggle-d not found");
    }
    if (!this.btnReset) {
      throw new Error("Required element #btn-reset not found");
    }
    if (!(this.sldNoise instanceof HTMLInputElement)) {
      throw new Error("Required element #noiseSlider is not an input");
    }
    if (!(this.sldSpeed instanceof HTMLInputElement)) {
      throw new Error("Required element #speedSlider is not an input");
    }

    // 1. 输入 D 切换按钮
    this.btnToggleD.addEventListener("pointerdown", () => {
      const current = this.signalD.targetLogic;
      this.signalD.targetLogic = current === 1 ? 0 : 1;
      this.updateToggleButton();
    });

    // 2. 噪声滑块控制
    this.sldNoise.addEventListener("input", (e) => {
      if (!this.elNoiseVal) {
        throw new Error("Required element #noiseVal not found");
      }

      const target = e.target;
      if (!(target instanceof HTMLInputElement)) {
        throw new Error(`Element #${target} is not a input`);
      }
      const percent = parseInt(target.value);

      // 使用常量计算噪声
      const noiseVolts = (percent / 100) * Simulation.maxNoiseLevel;

      this.signalD.noiseLevel = noiseVolts;
      this.dff.qSignal.noiseLevel = noiseVolts * Simulation.outputNoiseRatio;

      this.elNoiseVal.textContent = `${percent} %`;
    });

    // 3. 时钟速度控制
    this.sldSpeed.addEventListener("input", (e) => {
      if (!this.elSpeedVal) {
        throw new Error("Required element #speedVal not found");
      }

      const target = e.target;
      if (!(target instanceof HTMLInputElement)) {
        throw new Error(`Element #${target} is not a input`);
      }
      const val = parseInt(target.value);

      this.clockSpeed = val * Simulation.clockSpeedFactor;

      // 计算实际频率: f = (baseFrameRate * clockSpeed) / (2π)
      const freqHz =
        (Simulation.baseFrameRate * this.clockSpeed) / (2 * Math.PI);

      this.elSpeedVal.textContent = `${freqHz.toFixed(2)} Hz`;
    });

    // 4. 异步重置按钮

    const activateReset = () => {
      this.resetActive = true;
      this.btnReset?.classList.add("active");
    };

    const deactivateReset = () => {
      this.resetActive = false;
      this.btnReset?.classList.remove("active");
    };

    // 按下时激活重置
    this.btnReset.addEventListener("pointerdown", activateReset);

    // 松开时释放重置
    this.btnReset.addEventListener("pointerup", deactivateReset);

    // 移出时也释放（防止卡住）
    this.btnReset.addEventListener("pointerleave", deactivateReset);
  }

  /**
   * 更新按钮状态
   */
  private updateToggleButton() {
    if (!this.btnToggleD) {
      throw new Error("Required element #btn-toggle-d not found");
    }

    const iconOff = this.btnToggleD.querySelector(".icon-off");
    const iconOn = this.btnToggleD.querySelector(".icon-on");
    const textSpan = this.btnToggleD.querySelector(".btn-text");

    if (
      !(iconOff instanceof HTMLElement) ||
      !(iconOn instanceof HTMLElement) ||
      !(textSpan instanceof HTMLElement)
    ) {
      throw new Error("Required #btn-toggle-d child elements not found");
    }

    if (this.signalD.targetLogic === 1) {
      this.btnToggleD.classList.add("active");
      iconOff.style.display = "none";
      iconOn.style.display = "inline";
      textSpan.textContent = "Input D: HIGH";
    } else {
      this.btnToggleD.classList.remove("active");
      iconOff.style.display = "inline";
      iconOn.style.display = "none";
      textSpan.textContent = "Input D: LOW";
    }
  }

  /**
   * 物理计算步进 (Physics Step)
   * @returns 当前电压快照
   */
  private updatePhysics(deltaTime: number): SignalSample {
    this.clockPhase += this.clockSpeed * deltaTime * Simulation.baseFrameRate; // 归一化到 60fps 基准

    // 防止 phase 无限增长导致浮点数精度问题
    // 2 * PI 是一个完整周期
    if (this.clockPhase > Math.PI * 2) {
      this.clockPhase -= Math.PI * 2;
    }

    // 生成方波
    this.signalClk.targetLogic = Math.sin(this.clockPhase) > 0 ? 1 : 0;

    // 更新各端口电压物理值（含噪声计算）
    this.signalClk.update(deltaTime);
    this.signalD.update(deltaTime);

    // 核心：执行 D 触发器逻辑
    const qVolts = this.dff.process(
      this.signalD.currentValue,
      this.signalClk.currentValue,
      this.resetActive,
      deltaTime,
    );

    return {
      d: this.signalD.currentValue,
      clk: this.signalClk.currentValue,
      q: qVolts,
    };
  }

  /**
   * UI 渲染更新 (UI Step)
   * @param data - 当前帧的电压数据对象
   */
  private updateUI(data: SignalSample) {
    if (!this.elVoltD || !this.elVoltClk || !this.elVoltQ) {
      throw new Error("Required voltage display elements not found");
    }
    if (!this.elPinD || !this.elPinClk || !this.elPinQ) {
      throw new Error("Required pin elements not found");
    }

    this.frameCount++;

    const updateText = (
      el: HTMLElement | null,
      val: number,
      cacheKey: "voltD" | "voltClk" | "voltQ",
    ) => {
      if (!el) return;
      const newText = val.toFixed(2) + "V";

      // 脏检查：如果新文本和缓存的一样，直接跳过
      if (this.cache[cacheKey] !== newText) {
        el.textContent = newText;
        this.cache[cacheKey] = newText; // 更新缓存
      }
    };

    const updateActive = (
      el: Element | null,
      isActive: boolean,
      cacheKey: "pinDActive" | "pinClkActive" | "pinQActive",
    ) => {
      if (!el) return;

      // 脏检查
      if (this.cache[cacheKey] !== isActive) {
        el.classList.toggle("active", isActive);
        this.cache[cacheKey] = isActive; // 更新缓存
      }
    };

    if (this.frameCount % 10 === 0) {
      // 更新芯片管脚旁的数字电压显示
      updateText(this.elVoltD, data.d, "voltD");
      updateText(this.elVoltClk, data.clk, "voltClk");
      updateText(this.elVoltQ, data.q, "voltQ");

      // 重置帧计数器
      this.frameCount = 0;
    }

    // 更新引脚高亮状态
    const threshold = VoltageSpecs.logicHighMin;
    updateActive(this.elPinD, data.d > threshold, "pinDActive");
    updateActive(this.elPinClk, data.clk > threshold, "pinClkActive");
    updateActive(this.elPinQ, data.q > threshold, "pinQActive");

    // 更新波形图数据缓冲区
    this.waveformBuffer.push(data.d, data.clk, data.q);

    // 重绘波形图
    this.scope.draw();
    this.scope.drawDigital();
  }

  /**
   * 动画主循环
   */
  private loop(timestamp: number = 0) {
    // 第一帧时间或间跳变过大时重置时间基准
    if (!this.lastFrameTime || timestamp - this.lastFrameTime > 1000) {
      this.lastFrameTime = timestamp;
    }

    // 2. 计算原始 deltaTime
    let deltaTime = (timestamp - this.lastFrameTime) / 1000;

    // 3. 钳位 deltaTime
    // 强制每帧最大只模拟 0.1 秒的物理时间（即使实际卡顿了 0.5 秒）
    // 这样波形虽然会变慢，但绝不会瞬移或乱跳
    const MAX_DELTA_TIME = 0.1;
    if (deltaTime > MAX_DELTA_TIME) {
      deltaTime = MAX_DELTA_TIME;
    }

    this.lastFrameTime = timestamp;

    const data = this.updatePhysics(deltaTime);
    this.updateUI(data);
    requestAnimationFrame((t) => this.loop(t));
  }

  refresh() {
    this.signalD = new Signal(
      (VoltageSpecs.logicHighMin + VoltageSpecs.systemMax) / 2, // ~1.75V
      VoltageSpecs.logicLowMax / 2, // ~0.3V
    );

    this.signalClk = new Signal(VoltageSpecs.outputHighMax, 0.0);

    this.dff = new DFlipFlop();

    this.waveformBuffer.reset();

    // 可以选择销毁并重建示波器实例，但目前看没必要
    // this.scope.destroy();
    // this.scope = new Oscilloscope("waveform-canvas", "digital-canvas");
    // this.scope.setData(this.waveformBuffer);

    this.clockPhase = 0;
    this.resetActive = false;
    this.lastFrameTime = 0;
    this.cache = {
      voltD: "",
      voltClk: "",
      voltQ: "",
      pinDActive: false,
      pinClkActive: false,
      pinQActive: false,
    };

    // 关键：同步 UI 控件的当前值到仿真参数
    if (!this.elNoiseVal) {
      throw new Error("Required element #noiseVal not found");
    }
    if (!this.elSpeedVal) {
      throw new Error("Required element #speedVal not found");
    }
    if (!(this.sldNoise instanceof HTMLInputElement)) {
      throw new Error("Required element #noiseSlider is not an input");
    }
    if (!(this.sldSpeed instanceof HTMLInputElement)) {
      throw new Error("Required element #speedSlider is not an input");
    }

    const percent = parseInt(this.sldNoise.value);
    const noiseVolts = (percent / 100) * Simulation.maxNoiseLevel;
    this.signalD.noiseLevel = noiseVolts;
    this.dff.qSignal.noiseLevel = noiseVolts * Simulation.outputNoiseRatio;
    this.elNoiseVal.textContent = `${percent} %`;

    const val = parseInt(this.sldSpeed.value);
    this.clockSpeed = val * Simulation.clockSpeedFactor;
    const freqHz = (Simulation.baseFrameRate * this.clockSpeed) / (2 * Math.PI);
    this.elSpeedVal.textContent = `${freqHz.toFixed(2)} Hz`;

    // 更新按钮状态
    this.updateToggleButton();
  }
}
