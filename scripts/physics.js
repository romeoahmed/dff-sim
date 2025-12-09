// @ts-check
/**
 * @file 物理模拟引擎：处理电压、噪声与逻辑门行为
 */

import { VoltageSpecs } from "./constants.js";

const TWO_PI = 2.0 * Math.PI;

/**
 * 模拟单个电压信号源，包含噪声生成与阻容延迟模拟
 */
export class Signal {
  /**
   * 当前实际电压值（含噪声）
   *  @type {number}
   */
  currentValue = 0;

  /**
   * 目标逻辑状态 (0 或 1)
   * @type {number}
   */
  targetLogic = 0;

  /**
   * 噪声强度 (标准差，单位 V)
   * @type {number}
   */
  noiseLevel = 0.1;

  /**
   * 逻辑高电平的基准电压
   * @type {number}
   */
  baseHigh;

  /**
   * 逻辑低电平的基准电压
   * @type {number}
   */
  baseLow;

  // --- Box-Muller 优化缓存 ---

  /**
   * 缓存的下一个高斯随机数
   * @type {number|null}
   */
  _noiseCache = null;

  /**
   * 创建一个电压信号源
   * @param {number} [baseHigh] - 逻辑高电平的基准电压 (V)
   * @param {number} [baseLow] - 逻辑低电平的基准电压 (V)
   * @param {number} [slewRate] - 信号压摆率 / 平滑系数 (0.0 - 1.0)
   */
  constructor(baseHigh = 1.8, baseLow = 0.2, slewRate = 0.5) {
    this.baseHigh = baseHigh;
    this.baseLow = baseLow;
    this.slewRate = slewRate;
  }

  /**
   * 计算下一帧的电压值
   *
   * 包含高斯白噪声注入和低通滤波（模拟 Slew Rate）
   * @returns {void}
   */
  update() {
    const { targetLogic, baseHigh, baseLow, noiseLevel, slewRate } = this;

    // 1. 确定无噪声的目标电压
    const targetVoltage = targetLogic === 1 ? baseHigh : baseLow;

    // 2. 生成高斯噪声 (Box-Muller 变换 - 双缓冲优化)
    let noise;
    if (this._noiseCache === null) {
      let u = 0,
        v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();

      const radius = Math.sqrt(-2.0 * Math.log(u));
      const angle = TWO_PI * v;

      // Box-Muller 生成两个独立的正态分布值
      noise = radius * Math.cos(angle);
      this._noiseCache = radius * Math.sin(angle);
    } else {
      noise = this._noiseCache;
      this._noiseCache = null; // 清空缓存
    }

    // 3. 叠加噪声
    const noisyVoltage = targetVoltage + noise * noiseLevel;

    // 4. 模拟电容充放电 (低通滤波 / Slew Rate)
    this.currentValue += (noisyVoltage - this.currentValue) * slewRate;

    // 5. 物理限制 Clamping (-0.5V ~ 3.0V)
    this.currentValue = Math.max(-0.5, Math.min(3.0, this.currentValue));
  }
}

/**
 * D触发器 (D Flip-Flop) 逻辑模拟类
 *
 * 模拟上升沿触发、阈值判断及亚稳态行为
 */
export class DFlipFlop {
  /**
   * 输出信号 Q
   *
   * 输出跳变比输入更干脆，slewRate 设为 0.8
   * @type {Signal}
   */
  qSignal = new Signal(1.9, 0.1, 0.8);

  /**
   * 记录上一帧的 CLK 逻辑状态
   * @type {number}
   */
  lastClkState = 0;

  /**
   * 执行单步逻辑运算
   * @param {number} dVoltage - 当前 D 输入端的实际电压
   * @param {number} clkVoltage - 当前 CLK 输入端的实际电压
   * @returns {number} - 计算后的 Q 输出端电压
   */
  process(dVoltage, clkVoltage) {
    const { logicHighMin, logicLowMax } = VoltageSpecs;

    // 1. 施密特触发器类似的输入判断 (简化版)
    let clkLogic = 0;
    if (clkVoltage > logicHighMin) {
      clkLogic = 1;
    } else if (clkVoltage < logicLowMax) {
      clkLogic = 0;
    } else {
      // 滞回区间/未定义区间：保持上一状态
      clkLogic = this.lastClkState;
    }

    // 2. 上升沿检测 (Rising Edge Detection): 0 -> 1
    const isRisingEdge = this.lastClkState === 0 && clkLogic === 1;

    if (isRisingEdge) {
      // 在上升沿时刻采样 D
      if (dVoltage > logicHighMin) {
        this.qSignal.targetLogic = 1;
      } else if (dVoltage < logicLowMax) {
        this.qSignal.targetLogic = 0;
      } else {
        // 3. 亚稳态/Undefined Zone 模拟
        // 当输入电压处于 0.6V-1.0V 之间时，触发器行为不可预测
        // 这里为了演示鲁棒性问题，随机决定输出
        this.qSignal.targetLogic = Math.random() > 0.5 ? 1 : 0;
      }
    }

    this.lastClkState = clkLogic;

    // 更新输出引脚的物理电压
    this.qSignal.update();

    return this.qSignal.currentValue;
  }
}
