function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

export class WaveformBuffer {
  readonly channelCount: number;
  readonly length: number;

  private readonly channels: Float32Array[];
  private readonly mask: number;
  private _writePointer: number = 0;

  constructor(channelCount: number, length: number) {
    if (!isPowerOfTwo(length)) {
      throw new Error(`WaveformBuffer length must be power of 2, got ${length}`);
    }
    this.channelCount = channelCount;
    this.length = length;
    this.mask = length - 1;
    this.channels = Array.from({ length: channelCount }, () => new Float32Array(length));
  }

  get writePointer(): number {
    return this._writePointer;
  }

  push(values: readonly number[]): void {
    if (values.length !== this.channelCount) {
      throw new Error(`Expected ${this.channelCount} values, got ${values.length}`);
    }
    const ptr = this._writePointer;
    for (let i = 0; i < this.channelCount; i++) {
      this.getChannel(i)[ptr] = values[i] ?? 0;
    }
    this._writePointer = (ptr + 1) & this.mask;
  }

  getChannel(index: number): Float32Array {
    const ch = this.channels[index];
    if (!ch) throw new Error(`Channel ${index} out of range`);
    return ch;
  }

  reset(fillValue: number = 0): void {
    for (const ch of this.channels) ch.fill(fillValue);
    this._writePointer = 0;
  }

  toChannelMajorBuffer(): Float32Array {
    const buf = new Float32Array(this.channelCount * this.length);
    for (let c = 0; c < this.channelCount; c++) {
      buf.set(this.getChannel(c), c * this.length);
    }
    return buf;
  }
}
