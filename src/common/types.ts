/**
 * 接口类型定义：颜色配置、电压规范、布局配置、仿真参数、历史数据与瞬时信号
 */

/**
 * 颜色配置
 */
export interface ColorConfig {
  /** 时钟信号颜色 (CLK) */
  clk: string;

  /** 输入信号颜色 (D) */
  d: string;

  /** 输出信号颜色 (Q) */
  q: string;

  /** 高亮与数值显示 */
  highlight: string;

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

  /** 数字逻辑视图 Canvas 高度 (px) */
  digitalScopeHeight: number;

  /** Canvas 内边距 (px) */
  canvasPadding: number;

  /** 数字逻辑垂直阶跃高度 (px) */
  digitalLogicStep: number;

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

  /** 波形标签字体样式 */
  waveformLabelFont: string;

  /** 阈值标签字体样式 */
  thresholdLabelFont: string;
}

/**
 * 仿真参数配置
 */
export interface SimulationConfig {
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
}

/**
 * 通道配置
 */
export interface ChannelConfig {
  color: string;
  label: string;
}

/**
 * 各通道历史电压数据
 */
export interface VoltageData {
  /** 输入电压 */
  d: Float32Array;

  /** 时钟电路电压 */
  clk: Float32Array;

  /** 输出电压 */
  q: Float32Array;
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

/**
 * 示波器数据源接口
 */
export interface WaveformDataSource {
  /** 缓冲区长度 (必须是 2 的幂) */
  readonly length: number;

  /** 当前写入指针的位置 (0 ~ length-1) */
  readonly writePointer: number;

  /** 原始数据数组 (Float32Array) */
  readonly d: Float32Array;
  readonly clk: Float32Array;
  readonly q: Float32Array;
}

/**
 * DOM 元素字典类型定义
 */
export interface UIElements {
  volts: {
    d: HTMLElement;
    clk: HTMLElement;
    q: HTMLElement;
  };
  pins: {
    d: Element;
    clk: Element;
    q: Element;
  };
  controls: {
    btnToggleD: HTMLElement;
    btnStd: HTMLElement;
    btnExp: HTMLElement;
    btnReset: HTMLElement;
    sldNoise: HTMLInputElement;
    sldSpeed: HTMLInputElement;
    valNoise: HTMLElement;
    valSpeed: HTMLElement;
  };
}

/**
 * Worker 初始化消息
 */
export interface WorkerInitMessage {
  type: "INIT";
  canvasWaveform: OffscreenCanvas;
  canvasDigital: OffscreenCanvas;
  dpr: number;
  width: number;
  height: number;
  digitalHeight: number;
}

/**
 * 尺寸变更消息
 */
export interface WorkerResizeMessage {
  type: "RESIZE";
  width: number;
  height: number;
  digitalHeight: number;
  dpr: number;
}

/**
 * 参数更新消息 (UI -> Worker)
 */
export interface WorkerParamMessage {
  type: "PARAM_UPDATE";
  key: "noise" | "speed" | "toggleD" | "reset";
  value: number | boolean;
}

/**
 * 数据回传消息 (Worker -> UI)
 *
 * 用于更新页面上的电压数值文字
 */
export interface WorkerStatusMessage {
  type: "STATUS_UPDATE";
  d: number;
  clk: number;
  q: number;
}

/**
 * 设置更新消息 (UI -> Worker)
 */
export interface WorkerSettingsMessage {
  type: "SETTINGS_UPDATE";
  settings: Partial<VoltageSpecConfig>;
}

/**
 * 渲染器切换消息
 */
export interface WorkerSwitchRendererMessage {
  type: "SWITCH_RENDERER";
  mode: "standard" | "experimental";
}

/**
 * Worker 消息类型合集
 */
export type WorkerMessage =
  | WorkerInitMessage
  | WorkerResizeMessage
  | WorkerParamMessage
  | WorkerSettingsMessage
  | WorkerSwitchRendererMessage;
