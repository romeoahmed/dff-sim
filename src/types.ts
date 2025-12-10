/**
 * 自定义类型
 */

/**
 * 颜色配置类型
 */
export interface ColorConfig {
  green: string;
  blue: string;
  red: string;
  yellow: string;
  text: string;
  grid: string;
  stroke: string;
  fill: string;
}

/**
 * 电压规范类型
 */
export interface VoltageSpecConfig {
  logicHighMin: number;
  logicLowMax: number;
  outputHighMin: number;
  outputHighMax: number;
  outputLowMax: number;
  systemMax: number;
}

/**
 * 各通道历史电压数据类型
 */
export interface VoltageData {
  d: Array<number>;
  clk: Array<number>;
  q: Array<number>;
}

/**
 * 瞬时信号数据类型
 */
export interface SignalSample {
  d: number;
  clk: number;
  q: number;
}
