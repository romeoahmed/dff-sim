/**
 * 自定义类型
 */

/**
 * 颜色配置
 */
export interface ColorConfig {
  /** 时钟信号颜色 (CLK) */
  green: string;

  /** 输入信号颜色 (D) */
  blue: string;

  /** 输出信号颜色 (Q) */
  red: string;

  /** 高亮与数值显示 */
  yellow: string;

  /** 普通文本 */
  text: string;

  /** 网格线颜色 */
  grid: string;

  /** 描边颜色 */
  stroke: string;

  /** 填充颜色 */
  fill: string;
}

/**
 * 电压物理规范类型
 */
export interface VoltageSpecConfig {
  /** 逻辑 1 输入的最低电压阈值 */
  logicHighMin: number;

  /** 逻辑 0 输入的最高电压阈值 */
  logicLowMax: number;

  /** 输出逻辑 1 的最小电压 */
  outputHighMin: number;

  /** 输出逻辑 1 的最大电压 */
  outputHighMax: number;

  /** 输出逻辑 0 的最大电压 */
  outputLowMax: number;

  /** 系统最大供电电压 */
  systemMax: number;

  /** 电压钳位下限 (允许轻微负压) */
  clampMin: number;
}

/**
 * 各通道历史电压数据
 */
export interface VoltageData {
  /** 输入电压 */
  d: Array<number>;

  /** 时钟电路电压 */
  clk: Array<number>;

  /** 输出电压 */
  q: Array<number>;
}

/**
 * 瞬时信号数据
 */
export interface SignalSample {
  /** 输入信号 */
  d: number;

  /** 时钟电路信号 */
  clk: number;

  /** 输出信号 */
  q: number;
}
