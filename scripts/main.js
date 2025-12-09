// @ts-check
/**
 * @file 主控制器：负责 UI 交互、物理循环调度与数据绑定
 */

import "@fortawesome/fontawesome-free/css/all.min.css";
import "../styles/main.css";

import { Signal, DFlipFlop } from "./physics.js";
import { Oscilloscope } from "./renderer.js";

/**
 * 仿真应用主类
 */
class SimulationApp {
  // --- 物理组件 ---

  /**
   * 输入信号 D (逻辑 1 设为1.5V，处于安全区间中间)
   * @type {Signal}
   */
  signalD = new Signal(1.5, 0.3);

  /**
   * 时钟信号 CLK (幅度较大，2.0V)
   * @type {Signal}
   */
  signalClk = new Signal(2.0, 0.0);

  /**
   * D 触发器实例
   * @type {DFlipFlop}
   */
  dff = new DFlipFlop();

  /**
   * 示波器
   * @type {Oscilloscope}
   */
  scope = new Oscilloscope("waveform-canvas");

  // --- 仿真状态 ---

  /**
   * 时钟相位累加器
   * @type {number}
   */
  clockPhase = 0;

  /**
   * 时钟频率步进速度
   * @type {number}
   */
  clockSpeed = 0.05;

  // --- DOM 元素缓存 ---

  /**
   * D 输入电压显示 DOM
   * @type {HTMLElement | null}
   */
  elVoltD = document.getElementById("volt-d");

  /**
   * CLK 电压显示 DOM
   * @type {HTMLElement | null}
   */
  elVoltClk = document.getElementById("volt-clk");

  /**
   * Q 输出电压显示 DOM
   * @type {HTMLElement | null}
   */
  elVoltQ = document.getElementById("volt-q");

  /**
   * D 引脚 DOM
   * @type {HTMLElement | null}
   */
  elPinD = document.querySelector(".pin.input-d");

  /**
   * CLK 引脚 DOM
   * @type {HTMLElement | null}
   */
  elPinClk = document.querySelector(".pin.input-clk");

  /**
   * Q 引脚 DOM
   * @type {HTMLElement | null}
   */
  elPinQ = document.querySelector(".pin.output-q");

  /**
   * D 输入切换按钮
   * @type {HTMLElement | null}
   */
  btnToggleD = document.getElementById("btn-toggle-d");

  /**
   * 噪声滑块
   * @type {HTMLInputElement | null}
   */
  sldNoise = /** @type {HTMLInputElement} */ (
    document.getElementById("noiseSlider")
  );

  /**
   * 速度滑块
   * @type {HTMLInputElement | null}
   */
  sldSpeed = /** @type {HTMLInputElement} */ (
    document.getElementById("speedSlider")
  );

  /**
   * 噪声数值显示
   * @type {HTMLElement | null}
   */
  elNoiseVal = document.getElementById("noiseVal");

  /**
   * 初始化仿真应用，绑定 DOM 并启动主循环
   */
  constructor() {
    this.initListeners();
    this.loop();
  }

  /**
   * 初始化 DOM 事件监听器
   * @returns {void}
   */
  initListeners() {
    const { btnToggleD, sldNoise, sldSpeed, elNoiseVal } = this;

    if (!btnToggleD || !sldNoise || !sldSpeed) return;

    // 1. 输入 D 切换按钮
    btnToggleD.addEventListener("click", () => {
      const current = this.signalD.targetLogic;
      this.signalD.targetLogic = current === 1 ? 0 : 1;

      // 更新按钮样式
      if (this.signalD.targetLogic === 1) {
        btnToggleD.classList.add("active");
        btnToggleD.innerHTML =
          '<i class="fa-solid fa-toggle-on"></i> Input D: HIGH';
      } else {
        btnToggleD.classList.remove("active");
        btnToggleD.innerHTML =
          '<i class="fa-solid fa-toggle-off"></i> Input D: LOW';
      }
    });

    // 2. 噪声滑块控制
    sldNoise.addEventListener("input", (e) => {
      const target = /** @type {HTMLInputElement} */ (e.target);
      const percent = parseInt(target.value);
      // 将 0-100% 映射到 0.0V - 0.8V 的噪声幅度
      const noiseVolts = (percent / 100) * 0.8;

      this.signalD.noiseLevel = noiseVolts;
      // 输出端的噪声通常小于输入端（数字电路的再生特性）
      this.dff.qSignal.noiseLevel = noiseVolts * 0.5;

      if (elNoiseVal) elNoiseVal.innerText = `${percent}%`;
    });

    // 3. 时钟速度控制
    sldSpeed.addEventListener("input", (e) => {
      const target = /** @type {HTMLInputElement} */ (e.target);
      const val = parseInt(target.value);
      this.clockSpeed = val * 0.002;
    });
  }

  /**
   * 物理计算步进 (Physics Step)
   * @returns {{d: number, clk: number, q: number}} 当前电压快照
   */
  updatePhysics() {
    // 生成正弦波时钟并整形为方波 (模拟时钟发生器)
    this.clockPhase += this.clockSpeed;
    if (Math.sin(this.clockPhase) > 0) {
      this.signalClk.targetLogic = 1;
    } else {
      this.signalClk.targetLogic = 0;
    }

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
   * @param {{d: number, clk: number, q: number}} data - 当前帧的电压数据对象
   * @returns {void}
   */
  updateUI(data) {
    // 更新芯片管脚旁的数字电压显示
    if (this.elVoltD) this.elVoltD.innerText = data.d.toFixed(2) + "V";
    if (this.elVoltClk) this.elVoltClk.innerText = data.clk.toFixed(2) + "V";
    if (this.elVoltQ) this.elVoltQ.innerText = data.q.toFixed(2) + "V";

    // 更新引脚高亮状态
    if (this.elPinD) this.elPinD.classList.toggle("active", data.d > 1.0);
    if (this.elPinClk) this.elPinClk.classList.toggle("active", data.clk > 1.0);
    if (this.elPinQ) this.elPinQ.classList.toggle("active", data.q > 1.0);

    // 将数据推送到示波器
    this.scope.pushData(data.d, data.clk, data.q);
    this.scope.draw();
  }

  /**
   * 动画主循环 (RequestAnimationFrame)
   * @returns {void}
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
