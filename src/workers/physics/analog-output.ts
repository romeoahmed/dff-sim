import type { PhysicsConfig, RngFn, SignalConfig } from "@/lib/types";
import { NoiseGenerator } from "./noise";
import { Signal } from "./signal";

export interface AnalogOutputConfig {
  readonly tPD: number;
  readonly zeta: number;
  readonly ringFreq: number;
  readonly baseHigh: number;
  readonly baseLow: number;
  readonly clampMin: number;
  readonly clampMax: number;
  readonly noiseLevel: number;
}

function computeNoiseLevel(config: PhysicsConfig, noisePercent: number): number {
  return (
    (noisePercent / 100) * config.simulation.maxNoiseLevel * config.simulation.outputNoiseRatio
  );
}

export function mergeGateParams(
  config: PhysicsConfig,
  params: Record<string, unknown>,
): AnalogOutputConfig {
  const numeric = (k: string): number | undefined =>
    typeof params[k] === "number" ? (params[k] as number) : undefined;
  return {
    tPD: numeric("tPD") ?? config.gates.tPD,
    zeta: numeric("zeta") ?? config.gates.zeta,
    ringFreq: numeric("ringFreq") ?? config.gates.ringFreq,
    baseHigh: (config.voltage.outputHighMin + config.voltage.outputHighMax) / 2,
    baseLow: config.voltage.outputLowMax / 2,
    clampMin: config.voltage.clampMin,
    clampMax: config.voltage.systemMax,
    noiseLevel: computeNoiseLevel(config, config.simulation.defaultNoise),
  };
}

export class AnalogOutput {
  private readonly signal: Signal;
  private readonly noise: NoiseGenerator;
  private tPD: number;
  private currentTarget: 0 | 1 = 0;
  private pending: 0 | 1 | null = null;
  private pendingTimer: number = 0;

  constructor(cfg: AnalogOutputConfig, rng: RngFn) {
    this.tPD = cfg.tPD;
    this.noise = new NoiseGenerator(rng, cfg.noiseLevel);
    this.signal = new Signal(this.toSignalConfig(cfg), this.noise);
  }

  private toSignalConfig(cfg: AnalogOutputConfig): SignalConfig {
    return {
      baseHigh: cfg.baseHigh,
      baseLow: cfg.baseLow,
      zeta: cfg.zeta,
      ringFreq: cfg.ringFreq,
      clampMin: cfg.clampMin,
      clampMax: cfg.clampMax,
    };
  }

  get voltage(): number {
    return this.signal.voltage;
  }

  set(logic: 0 | 1): void {
    if (logic === this.currentTarget && this.pending === null) return;
    if (logic === this.pending) return;
    if (logic === this.currentTarget && this.pending !== null) {
      this.pending = null;
      this.pendingTimer = 0;
      return;
    }
    this.pending = logic;
    this.pendingTimer = this.tPD;
  }

  update(dt: number): void {
    if (this.pending !== null) {
      this.pendingTimer -= dt;
      if (this.pendingTimer <= 0) {
        this.currentTarget = this.pending;
        this.signal.targetLogic = this.pending;
        this.pending = null;
      }
    }
    this.signal.update(dt);
  }

  snapTo(logic: 0 | 1, cfg: AnalogOutputConfig): void {
    this.currentTarget = logic;
    this.pending = null;
    this.pendingTimer = 0;
    this.signal.targetLogic = logic;
    this.signal.snapTo(logic === 1 ? cfg.baseHigh : cfg.baseLow);
  }

  setNoise(noisePercent: number, config: PhysicsConfig): void {
    this.noise.setSigma(computeNoiseLevel(config, noisePercent));
  }

  applyConfig(cfg: AnalogOutputConfig): void {
    this.tPD = cfg.tPD;
    this.signal.applyConfig(this.toSignalConfig(cfg));
    this.noise.setSigma(cfg.noiseLevel);
  }
}
