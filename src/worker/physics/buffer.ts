/**
 * 数据缓冲区：用于存储波形数据
 */

import { Simulation } from "../../common/constants";
import type { WaveformDataSource } from "../../common/types";

// Ring Buffer 实现
export class WaveformBuffer implements WaveformDataSource {
  readonly length: number;

  readonly d: Float32Array;
  readonly clk: Float32Array;
  readonly q: Float32Array;

  // 内部指针
  private _writePointer: number = 0;

  /**
   * 初始化缓冲区
   * @param length - 缓冲区长度
   * @param fillValue - 初始填充值
   */
  constructor(length: number = Simulation.bufferLength, fillValue: number = 0) {
    this.length = length;
    this.d = new Float32Array(length).fill(fillValue);
    this.clk = new Float32Array(length).fill(fillValue);
    this.q = new Float32Array(length).fill(fillValue);
  }

  /**
   * 获取当前写入指针 (实现接口)
   */
  get writePointer() {
    return this._writePointer;
  }

  /**
   * 推入新数据
   *
   * @param dVal - D 引脚电压值
   * @param clkVal - CLK 引脚电压值
   * @param qVal - Q 引脚电压值
   */
  push(dVal: number, clkVal: number, qVal: number) {
    this.d[this._writePointer] = dVal;
    this.clk[this._writePointer] = clkVal;
    this.q[this._writePointer] = qVal;

    // 位运算回绕 (前提: length 是 2 的幂)
    this._writePointer = (this._writePointer + 1) & (this.length - 1);
  }

  /**
   * 重置数据
   *
   * @param fillValue - 重置时的填充值
   */
  reset(fillValue: number = 0) {
    this.d.fill(fillValue);
    this.clk.fill(fillValue);
    this.q.fill(fillValue);
    this._writePointer = 0;
  }
}
