/**
 * 物理模拟引擎：处理电压、噪声与逻辑门行为
 */

import { VoltageSpecs, Simulation } from "./constants";

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
  targetLogic: 0 | 1 = 0;

  /**
   * 噪声强度 (标准差，单位 V)
   */
  noiseLevel: number =
    (Simulation.defaultNoise / 100) * Simulation.maxNoiseLevel;

  // --- Marsaglia Polar Method 优化缓存 ---

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
    public baseHigh: number = VoltageSpecs.outputHighMin,
    public baseLow: number = VoltageSpecs.outputLowMax,
    public smoothingFactor: number = VoltageSpecs.smoothingFactor,
  ) {
    this.currentValue = baseLow;
  }

  /**
   * 计算下一帧的电压值
   *
   * 包含高斯白噪声注入和低通滤波（模拟 Slew Rate）
   *
   * @remarks
   * Marsaglia Polar Method 参考 AI 辅助建议
   */
  update() {
    const { targetLogic, baseHigh, baseLow, noiseLevel, smoothingFactor } =
      this;

    // 1. 确定无噪声的目标电压
    const targetVoltage = targetLogic === 1 ? baseHigh : baseLow;

    // 2. 生成高斯噪声 (Marsaglia Polar Method - 双缓冲优化)
    let noise: number;
    if (this._noiseCache === null) {
      let u: number, v: number, s: number;

      // 拒绝采样：直到点落在单位圆内
      do {
        u = Math.random() * 2 - 1; // [-1, 1]
        v = Math.random() * 2 - 1; // [-1, 1]
        s = u * u + v * v;
      } while (s >= 1 || s === 0);

      const mul = Math.sqrt((-2.0 * Math.log(s)) / s);

      // 生成两个独立的正态分布值
      noise = u * mul;
      this._noiseCache = v * mul;
    } else {
      noise = this._noiseCache;
      this._noiseCache = null; // 清空缓存
    }

    // 3. 叠加噪声
    const noisyVoltage = targetVoltage + noise * noiseLevel;

    // 4. RC 低通滤波
    this.currentValue += (noisyVoltage - this.currentValue) * smoothingFactor;

    // 5. 物理限制
    this.currentValue = Math.max(
      VoltageSpecs.clampMin,
      Math.min(VoltageSpecs.systemMax, this.currentValue),
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
  qSignal: Signal = new Signal(
    (VoltageSpecs.outputHighMin + VoltageSpecs.outputHighMax) / 2,
    VoltageSpecs.outputLowMax / 2,
    VoltageSpecs.outputSmoothingFactor,
  );

  /**
   * 记录上一帧的 CLK 逻辑状态
   */
  lastClkState: 0 | 1 = 0;

  /**
   * 执行单步逻辑运算
   * @param dVoltage - 当前 D 输入端的实际电压
   * @param clkVoltage - 当前 CLK 输入端的实际电压
   * @param resetActive - 异步重置信号是否激活 (低电平有效时传 false)
   * @returns 计算后的 Q 输出端电压
   */
  process(dVoltage: number, clkVoltage: number, resetActive: boolean) {
    // 0. 异步重置优先级最高
    if (resetActive) {
      this.qSignal.targetLogic = 0;
      this.qSignal.update();
      return this.qSignal.currentValue;
    }

    const { logicHighMin, logicLowMax } = VoltageSpecs;

    // 1. 施密特触发器
    let clkLogic: 0 | 1 = 0;
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
