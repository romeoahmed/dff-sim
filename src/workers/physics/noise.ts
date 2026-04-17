import type { RngFn } from "@/lib/types";

const FLICKER_RATIO = 4.0;

export class NoiseGenerator {
  private sigmaWhite: number;
  private sigmaFlicker: number;

  private noiseCache: number | null = null;

  private readonly octaves: number;
  private readonly generators: Float64Array;
  private runningSum: number = 0;
  private counter: number = 0;

  constructor(
    private readonly rng: RngFn,
    sigmaWhite: number,
    octaves: number = 8,
  ) {
    this.sigmaWhite = sigmaWhite;
    this.sigmaFlicker = sigmaWhite * FLICKER_RATIO;
    this.octaves = octaves;

    this.generators = new Float64Array(octaves);
    for (let i = 0; i < octaves; i++) {
      const val = this.gaussianSample();
      this.generators[i] = val;
      this.runningSum += val;
    }
  }

  setSigma(sigmaWhite: number): void {
    this.sigmaWhite = sigmaWhite;
    this.sigmaFlicker = sigmaWhite * FLICKER_RATIO;
  }

  sample(): number {
    const white = this.gaussianSample() * this.sigmaWhite;
    const flicker = this.flickerSample() * this.sigmaFlicker;
    return white + flicker;
  }

  private gaussianSample(): number {
    if (this.noiseCache !== null) {
      const cached = this.noiseCache;
      this.noiseCache = null;
      return cached;
    }

    let u: number;
    let v: number;
    let s: number;
    do {
      u = this.rng() * 2 - 1;
      v = this.rng() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);

    const mul = Math.sqrt((-2.0 * Math.log(s)) / s);
    this.noiseCache = v * mul;
    return u * mul;
  }

  private flickerSample(): number {
    const idx = this.ctz(this.counter);
    if (idx < this.octaves) {
      this.runningSum -= this.generators[idx]!;
      const newVal = this.gaussianSample();
      this.generators[idx] = newVal;
      this.runningSum += newVal;
    }
    this.counter++;
    return this.runningSum / this.octaves;
  }

  private ctz(n: number): number {
    if (n === 0) return 32;
    return Math.log2(n & -n) | 0;
  }
}
