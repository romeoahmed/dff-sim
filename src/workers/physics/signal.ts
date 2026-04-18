import type { SignalConfig } from "@/lib/types";
import type { NoiseGenerator } from "./noise";

export class Signal {
  voltage: number = 0;
  targetLogic: 0 | 1 = 0;

  private x1: number = 0;
  private x2: number = 0;
  private config: SignalConfig;
  private wn: number;

  constructor(
    config: SignalConfig,
    private readonly noise: NoiseGenerator,
  ) {
    Signal.validateConfig(config);
    this.config = config;
    this.wn = 2 * Math.PI * config.ringFreq;
  }

  private static validateConfig(config: SignalConfig): void {
    if (!Number.isFinite(config.ringFreq) || config.ringFreq <= 0) {
      throw new RangeError(
        `Signal.applyConfig: ringFreq must be positive finite, got ${config.ringFreq}`,
      );
    }
    if (!Number.isFinite(config.zeta) || config.zeta <= 0) {
      throw new RangeError(`Signal.applyConfig: zeta must be positive finite, got ${config.zeta}`);
    }
  }

  update(dt: number): void {
    const { baseHigh, baseLow, zeta, clampMin, clampMax } = this.config;

    const target = this.targetLogic === 1 ? baseHigh : baseLow;
    const noisyTarget = target + this.noise.sample();

    const error = noisyTarget - this.x1;
    const wn = this.wn;
    this.x2 += (wn * wn * error - 2 * zeta * wn * this.x2) * dt;
    this.x1 += this.x2 * dt;

    this.voltage = Math.max(clampMin, Math.min(clampMax, this.x1));
  }

  snapTo(voltage: number): void {
    this.x1 = voltage;
    this.x2 = 0;
    this.voltage = voltage;
  }

  applyConfig(config: SignalConfig): void {
    Signal.validateConfig(config);
    this.config = config;
    this.wn = 2 * Math.PI * config.ringFreq;
  }
}
