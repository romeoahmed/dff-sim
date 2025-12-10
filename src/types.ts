/**
 * 自定义类型
 */

/**
 * 各通道历史电压数据接口
 */
export interface VoltageData {
  d: Array<number>;
  clk: Array<number>;
  q: Array<number>;
}

/**
 * 瞬时信号数据接口
 */
export interface SignalSample {
  d: number;
  clk: number;
  q: number;
}
