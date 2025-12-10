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
 *
 * 包含电压阈值、输出范围及信号响应特性（RC 滤波系数）
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

  /** 默认信号平滑系数 (RC 滤波) */
  smoothingFactor: number;

  /** 输出信号平滑系数 (更快的响应) */
  outputSmoothingFactor: number;
}

/**
 * 波形图布局配置
 */
export interface LayoutConfig {
  /** CLK 通道的 Y 轴偏移量 (px) */
  clkOffset: number;

  /** D 通道的 Y 轴偏移量 (px) */
  dOffset: number;

  /** Q 通道的 Y 轴偏移量 (px) */
  qOffset: number;

  /** 1V 对应的像素高度 */
  scaleY: number;

  /** Canvas 高度 (px) */
  canvasHeight: number;

  /** Canvas 内边距 (px) */
  canvasPadding: number;

  /** 波形线宽 (px) */
  waveformLineWidth: number;

  /** 虚线阈值参考线宽 (px) */
  thresholdLineWidth: number;

  /** 顶部电压余量 (V) */
  voltageHeadroom: number;

  /** 通道标签 X 偏移 (px) */
  labelOffsetX: number;

  /** 通道标签 Y 偏移 (px) */
  labelOffsetY: number;

  /** 虚线模式 [线长, 间隔] */
  dashPattern: [number, number];

  /** 阈值标签距右边距 (px) */
  thresholdLabelMargin: number;

  /** 阈值标签在线上方的偏移 (px) */
  thresholdLabelAbove: number;

  /** 阈值标签在线下方的偏移 (px) */
  thresholdLabelBelow: number;
}

/**
 * 仿真参数配置
 */
export interface SimulationConfigType {
  /** 最大噪声电压 (V) */
  maxNoiseLevel: number;

  /** 时钟速度系数 */
  clockSpeedFactor: number;

  /** 默认时钟速度 (0-100) */
  defaultSpeed: number;

  /** 默认噪声 (0-100) */
  defaultNoise: number;

  /** 基准帧率 (用于物理计算归一化) */
  baseFrameRate: number;

  /** 数据缓冲区长度 */
  bufferLength: number;

  /** Q 输出噪声相对于 D 输入的比例 */
  outputNoiseRatio: number;

  /** 波形图布局配置 */
  layout: LayoutConfig;
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
