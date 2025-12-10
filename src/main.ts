/**
 * 主控制器：负责 UI 交互、物理循环调度与数据绑定
 */

import "@fortawesome/fontawesome-free/css/all.min.css";
import "./styles/main.css";

import { Signal, DFlipFlop } from "./physics";
import { Oscilloscope } from "./renderer";
import { VoltageSpecs, SimulationConfig } from "./constants";
import type { SignalSample } from "./types";

/**
 * 仿真应用主类
 */
class SimulationApp {
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
  clockSpeed: number =
    SimulationConfig.defaultSpeed * SimulationConfig.clockSpeedFactor; // ~0.06V

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
   * 噪声滑块
   */
  sldNoise = document.getElementById("noiseSlider") as HTMLInputElement;

  /**
   * 速度滑块
   */
  sldSpeed = document.getElementById("speedSlider") as HTMLInputElement;

  /**
   * 噪声数值显示
   */
  elNoiseVal = document.getElementById("noiseVal");

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
    if (!this.btnToggleD || !this.sldNoise || !this.sldSpeed) return;

    // 1. 输入 D 切换按钮
    this.btnToggleD.addEventListener("click", () => {
      const current = this.signalD.targetLogic;
      this.signalD.targetLogic = current === 1 ? 0 : 1;
      this.updateToggleButton();
    });

    // 2. 噪声滑块控制
    this.sldNoise.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      const percent = parseInt(target.value);

      // 使用常量计算噪声
      const noiseVolts = (percent / 100) * SimulationConfig.maxNoiseLevel;

      this.signalD.noiseLevel = noiseVolts;
      this.dff.qSignal.noiseLevel = noiseVolts * 0.5;

      if (this.elNoiseVal) this.elNoiseVal.innerText = `${percent}%`;
    });

    // 3. 时钟速度控制
    this.sldSpeed.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      const val = parseInt(target.value);
      this.clockSpeed = val * SimulationConfig.clockSpeedFactor;
    });
  }

  /**
   * 更新按钮状态
   */
  updateToggleButton() {
    if (!this.btnToggleD) return;
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
  updatePhysics(): SignalSample {
    this.clockPhase += this.clockSpeed;

    // 生成方波
    this.signalClk.targetLogic = Math.sin(this.clockPhase) > 0 ? 1 : 0;

    // 更新各端口电压物理值（含噪声计算）
    this.signalClk.update();
    this.signalD.update();

    // 核心：执行 D 触发器逻辑
    const qVolts = this.dff.process(
      this.signalD.currentValue,
      this.signalClk.currentValue,
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
  loop() {
    const data = this.updatePhysics();
    this.updateUI(data);
    requestAnimationFrame(() => this.loop());
  }
}

// DOM 加载完成后启动
document.addEventListener("DOMContentLoaded", () => {
  try {
    new SimulationApp();
  } catch (e) {
    console.error("Critical System Failure:", e);
  }
});
