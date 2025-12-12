/**
 * 数据缓冲区：用于存储波形数据
 */

import { Simulation } from "./constants";
import type { WaveformDataSource } from "./types";

// Ring Buffer 实现
export class WaveformBuffer implements WaveformDataSource {
  readonly length: number;

  readonly d: Float32Array;
  readonly clk: Float32Array;
  readonly q: Float32Array;

  // 内部指针
  private _writePointer: number = 0;

  constructor(length: number = Simulation.bufferLength) {
    this.length = length;
    this.d = new Float32Array(length).fill(0);
    this.clk = new Float32Array(length).fill(0);
    this.q = new Float32Array(length).fill(0);
  }

  /**
   * 获取当前写入指针 (实现接口)
   */
  get writePointer() {
    return this._writePointer;
  }

  /**
   * 推入新数据
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
   */
  reset() {
    this.d.fill(0);
    this.clk.fill(0);
    this.q.fill(0);
    this._writePointer = 0;
  }
}
