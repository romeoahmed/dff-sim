/**
 * 物理模拟引擎：处理电压、噪声与逻辑门行为
 */

import { VoltageSpecs } from "./constants";

const TWO_PI = 2.0 * Math.PI;
const VOLTAGE_CLAMP_MIN = -0.5;
const VOLTAGE_CLAMP_MAX = VoltageSpecs.systemMax;

/**
 * 模拟单个电压信号源，包含噪声生成与阻容延迟模拟
 */
export class Signal {
  /**
   * 当前实际电压值 (含噪声)
   */
  currentValue: number = 0;

  /**
   * 目标逻辑状态 (0 或 1)
   */
  targetLogic: number = 0;

  /**
   * 噪声强度 (标准差，单位 V)
   */
  noiseLevel: number = 0.1;

  // --- Box-Muller 优化缓存 ---

  /**
   * 缓存的下一个高斯随机数
   */
  private _noiseCache: number | null = null;

  /**
   * 创建一个电压信号源
   * @param baseHigh - 逻辑高电平的基准电压 (V)
   * @param baseLow - 逻辑低电平的基准电压 (V)
   * @param smoothingFactor - 信号压摆率 / 平滑系数 (0.0 - 1.0)
   */
  constructor(
    public baseHigh: number = 1.8,
    public baseLow: number = 0.2,
    public smoothingFactor: number = 0.5,
  ) {}

  /**
   * 计算下一帧的电压值
   *
   * 包含高斯白噪声注入和低通滤波（模拟 Slew Rate）
   */
  update() {
    const { targetLogic, baseHigh, baseLow, noiseLevel, smoothingFactor } =
      this;

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
    this.currentValue += (noisyVoltage - this.currentValue) * smoothingFactor;

    // 5. 物理限制 Clamping (-0.5V ~ 3.0V)
    this.currentValue = Math.max(
      VOLTAGE_CLAMP_MIN,
      Math.min(VOLTAGE_CLAMP_MAX, this.currentValue),
    );
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
   * 输出跳变比输入更干脆，smoothingFactor 设为 0.8
   */
  qSignal: Signal = new Signal(1.9, 0.1, 0.8);

  /**
   * 记录上一帧的 CLK 逻辑状态
   */
  lastClkState: number = 0;

  /**
   * 执行单步逻辑运算
   * @param dVoltage - 当前 D 输入端的实际电压
   * @param clkVoltage - 当前 CLK 输入端的实际电压
   * @returns 计算后的 Q 输出端电压
   */
  process(dVoltage: number, clkVoltage: number) {
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
