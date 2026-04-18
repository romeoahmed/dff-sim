import type { RngFn } from "@/lib/types";
import { createGaussianSampler } from "./gaussian";

const FLICKER_RATIO = 4.0;

export class NoiseGenerator {
  private sigmaWhite: number;
  private sigmaFlicker: number;

  private readonly gaussian: () => number;
  private readonly octaves: number;
  private readonly generators: Float64Array;
  private runningSum: number = 0;
  private counter: number = 0;

  constructor(rng: RngFn, sigmaWhite: number, octaves: number = 8) {
    this.sigmaWhite = sigmaWhite;
    this.sigmaFlicker = sigmaWhite * FLICKER_RATIO;
    this.octaves = octaves;
    this.gaussian = createGaussianSampler(rng);

    this.generators = new Float64Array(octaves);
    for (let i = 0; i < octaves; i++) {
      const val = this.gaussian();
      this.generators[i] = val;
      this.runningSum += val;
    }
  }

  setSigma(sigmaWhite: number): void {
    this.sigmaWhite = sigmaWhite;
    this.sigmaFlicker = sigmaWhite * FLICKER_RATIO;
  }

  sample(): number {
    const white = this.gaussian() * this.sigmaWhite;
    const flicker = this.flickerSample() * this.sigmaFlicker;
    return white + flicker;
  }

  private flickerSample(): number {
    // Pre-increment so counter is always ≥ 1; this avoids the ctz(0)=32 skip on every
    // 2^32-sample wraparound (cosmetic, but keeps octave updates deterministic).
    this.counter = (this.counter + 1) >>> 0;
    if (this.counter === 0) this.counter = 1;
    const idx = this.ctz(this.counter);
    if (idx < this.octaves) {
      this.runningSum -= this.generators[idx] ?? 0;
      const newVal = this.gaussian();
      this.generators[idx] = newVal;
      this.runningSum += newVal;
    }
    return this.runningSum / this.octaves;
  }

  private ctz(n: number): number {
    return Math.log2(n & -n) | 0;
  }
}
