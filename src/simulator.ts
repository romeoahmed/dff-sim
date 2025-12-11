/**
 * 仿真控制器：UI 交互、物理循环调度与数据绑定
 */

import { Signal, DFlipFlop } from "./physics";
import { Oscilloscope } from "./renderer";
import { VoltageSpecs, Simulation } from "./constants";
import type { SignalSample } from "./types";

/**
 * 仿真应用主类
 */
export class SimulationApp {
  // --- 物理组件 ---

  /**
   * 输入信号 D
   */
  signalD: Signal = new Signal(
    (VoltageSpecs.logicHighMin + VoltageSpecs.systemMax) / 2, // ~1.75V
    VoltageSpecs.logicLowMax / 2, // ~0.3V
  );

  /**
   * 时钟信号 CLK
   */
  signalClk: Signal = new Signal(VoltageSpecs.outputHighMax, 0.0);

  /**
   * D 触发器实例
   */
  dff: DFlipFlop = new DFlipFlop();

  /**
   * 示波器
   */
  scope: Oscilloscope = new Oscilloscope("waveform-canvas");

  // --- 仿真状态 ---

  /**
   * 时钟相位累加器
   */
  clockPhase: number = 0;

  /**
   * 时钟频率步进速度
   */
  clockSpeed: number = Simulation.defaultSpeed * Simulation.clockSpeedFactor; // ~0.06

  // --- DOM 元素缓存 ---

  /**
   * D 输入电压显示 DOM
   */
  elVoltD = document.getElementById("volt-d");

  /**
   * CLK 电压显示 DOM
   */
  elVoltClk = document.getElementById("volt-clk");

  /**
   * Q 输出电压显示 DOM
   */
  elVoltQ = document.getElementById("volt-q");

  /**
   * D 引脚 DOM
   */
  elPinD = document.querySelector(".pin.input-d");

  /**
   * CLK 引脚 DOM
   */
  elPinClk = document.querySelector(".pin.input-clk");

  /**
   * Q 引脚 DOM
   */
  elPinQ = document.querySelector(".pin.output-q");

  /**
   * D 输入切换按钮
   */
  btnToggleD = document.getElementById("btn-toggle-d");

  /**
   * 重置按钮
   */
  btnReset = document.getElementById("btn-reset");

  /**
   * 重置信号激活状态
   */
  resetActive: boolean = false;

  /**
   * 噪声滑块
   */
  sldNoise = document.getElementById("noiseSlider");

  /**
   * 速度滑块
   */
  sldSpeed = document.getElementById("speedSlider");

  /**
   * 噪声数值显示
   */
  elNoiseVal = document.getElementById("noiseVal");

  /**
   * 速度数值显示
   */
  elSpeedVal = document.getElementById("speedVal");

  /**
   * 上一帧的时间戳
   */
  private _lastFrameTime: number = 0;

  // --- 脏检查缓存 (Dirty Check Cache) ---

  // 用于存储上一帧渲染的值，避免重复操作 DOM
  private _cache = {
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
    this.initListeners();
    this.loop();
  }

  /**
   * 初始化 DOM 事件监听器
   */
  initListeners() {
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
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) {
        throw new Error(`Element #${target} is not a input`);
      }
      const percent = parseInt(target.value);

      // 使用常量计算噪声
      const noiseVolts = (percent / 100) * Simulation.maxNoiseLevel;

      this.signalD.noiseLevel = noiseVolts;
      this.dff.qSignal.noiseLevel = noiseVolts * Simulation.outputNoiseRatio;

      if (this.elNoiseVal) this.elNoiseVal.innerText = `${percent} %`;
    });

    // 3. 时钟速度控制
    this.sldSpeed.addEventListener("input", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) {
        throw new Error(`Element #${target} is not a input`);
      }
      const val = parseInt(target.value);

      this.clockSpeed = val * Simulation.clockSpeedFactor;

      // 计算实际频率: f = (baseFrameRate * clockSpeed) / (2π)
      const freqHz =
        (Simulation.baseFrameRate * this.clockSpeed) / (2 * Math.PI);
      if (this.elSpeedVal)
        this.elSpeedVal.innerText = `${freqHz.toFixed(2)} Hz`;
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
  updateToggleButton() {
    if (!this.btnToggleD) {
      throw new Error("Required element #btn-toggle-d not found");
    }

    if (this.signalD.targetLogic === 1) {
      this.btnToggleD.classList.add("active");
      this.btnToggleD.innerHTML =
        '<i class="fa-solid fa-toggle-on"></i> Input D: HIGH';
    } else {
      this.btnToggleD.classList.remove("active");
      this.btnToggleD.innerHTML =
        '<i class="fa-solid fa-toggle-off"></i> Input D: LOW';
    }
  }

  /**
   * 物理计算步进 (Physics Step)
   * @returns 当前电压快照
   */
  updatePhysics(deltaTime: number): SignalSample {
    this.clockPhase += this.clockSpeed * deltaTime * Simulation.baseFrameRate; // 归一化到 60fps 基准

    // 生成方波
    this.signalClk.targetLogic = Math.sin(this.clockPhase) > 0 ? 1 : 0;

    // 更新各端口电压物理值（含噪声计算）
    this.signalClk.update();
    this.signalD.update();

    // 核心：执行 D 触发器逻辑
    const qVolts = this.dff.process(
      this.signalD.currentValue,
      this.signalClk.currentValue,
      this.resetActive,
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
  updateUI(data: SignalSample) {
    const updateText = (
      el: HTMLElement | null,
      val: number,
      cacheKey: "voltD" | "voltClk" | "voltQ",
    ) => {
      if (!el) return;
      const newText = val.toFixed(2) + "V";

      // 脏检查：如果新文本和缓存的一样，直接跳过
      if (this._cache[cacheKey] !== newText) {
        el.innerText = newText;
        this._cache[cacheKey] = newText; // 更新缓存
      }
    };

    const updateActive = (
      el: Element | null,
      isActive: boolean,
      cacheKey: "pinDActive" | "pinClkActive" | "pinQActive",
    ) => {
      if (!el) return;

      // 脏检查
      if (this._cache[cacheKey] !== isActive) {
        el.classList.toggle("active", isActive);
        this._cache[cacheKey] = isActive; // 更新缓存
      }
    };

    // 更新芯片管脚旁的数字电压显示
    updateText(this.elVoltD, data.d, "voltD");
    updateText(this.elVoltClk, data.clk, "voltClk");
    updateText(this.elVoltQ, data.q, "voltQ");

    // 更新引脚高亮状态
    const threshold = VoltageSpecs.logicHighMin;
    updateActive(this.elPinD, data.d > threshold, "pinDActive");
    updateActive(this.elPinClk, data.clk > threshold, "pinClkActive");
    updateActive(this.elPinQ, data.q > threshold, "pinQActive");

    // 将数据推送到示波器
    this.scope.pushData(data.d, data.clk, data.q);
    this.scope.draw();
  }

  /**
   * 动画主循环
   */
  loop(timestamp: number = 0) {
    // 计算 deltaTime (秒)
    const deltaTime = this._lastFrameTime
      ? (timestamp - this._lastFrameTime) / 1000
      : 1 / Simulation.baseFrameRate;
    this._lastFrameTime = timestamp;

    const data = this.updatePhysics(deltaTime);
    this.updateUI(data);
    requestAnimationFrame((t) => this.loop(t));
  }

  refresh() {
    this.scope.destroy();

    this.signalD = new Signal(
      (VoltageSpecs.logicHighMin + VoltageSpecs.systemMax) / 2, // ~1.75V
      VoltageSpecs.logicLowMax / 2, // ~0.3V
    );

    this.signalClk = new Signal(VoltageSpecs.outputHighMax, 0.0);

    this.dff = new DFlipFlop();

    this.scope = new Oscilloscope("waveform-canvas");

    this.clockPhase = 0;
    this.resetActive = false;
    this._lastFrameTime = 0;
    this._cache = {
      voltD: "",
      voltClk: "",
      voltQ: "",
      pinDActive: false,
      pinClkActive: false,
      pinQActive: false,
    };
  }
}
