import type { ComponentDeps, PhysicsConfig, Port, SequentialComponent } from "@/lib/types";
import { createGaussianSampler } from "../gaussian";
import { NoiseGenerator } from "../noise";
import { Signal } from "../signal";
import { createPort } from "./base";

function clockNoiseLevel(config: PhysicsConfig, percent: number): number {
  return (percent / 100) * config.simulation.maxNoiseLevel * config.simulation.outputNoiseRatio;
}

export class ClockSource implements SequentialComponent {
  readonly kind = "sequential" as const;
  readonly inputs = new Map<string, Port>();
  readonly outputs: Map<string, Port>;

  private readonly signal: Signal;
  private readonly noise: NoiseGenerator;
  private readonly gaussianSample: () => number;
  private readonly outPort: Port;
  private phase: number = 0;
  private speed: number;
  private readonly jitterRms: number;
  private config: PhysicsConfig;

  constructor(
    readonly id: string,
    params: Record<string, unknown>,
    deps: ComponentDeps,
  ) {
    const { config, rng } = deps;
    this.config = config;
    this.speed = (params.speed as number) ?? config.simulation.defaultSpeed;
    this.jitterRms = (params.jitterRms as number) ?? 0.02;
    this.gaussianSample = createGaussianSampler(rng);

    const outPort = createPort("out");
    this.outPort = outPort;
    this.outputs = new Map([["out", outPort]]);

    this.noise = new NoiseGenerator(rng, 0);
    this.signal = new Signal(
      {
        baseHigh: config.voltage.outputHighMax,
        baseLow: 0.0,
        zeta: 0.8,
        ringFreq: 80,
        clampMin: config.voltage.clampMin,
        clampMax: config.voltage.systemMax,
      },
      this.noise,
    );
  }

  update(dt: number): void {
    this.signal.update(dt);
    this.outPort.voltage = this.signal.voltage;
  }

  clock(dt: number): void {
    const oldPhase = this.phase;
    const jitter = this.gaussianSample() * this.jitterRms;
    const frameRate = this.config.simulation.baseFrameRate;
    this.phase += this.speed * this.config.simulation.clockSpeedFactor * dt * frameRate + jitter;
    this.phase = ((this.phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    const oldHalf = Math.floor(oldPhase / Math.PI) % 2;
    const newHalf = Math.floor(this.phase / Math.PI) % 2;

    if (oldHalf !== newHalf) {
      this.signal.targetLogic = newHalf === 0 ? 1 : 0;
    }
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  setNoise(percent: number): void {
    this.noise.setSigma(clockNoiseLevel(this.config, percent));
  }

  applyConfig(config: PhysicsConfig): void {
    this.config = config;
    this.signal.applyConfig({
      baseHigh: config.voltage.outputHighMax,
      baseLow: 0.0,
      zeta: 0.8,
      ringFreq: 80,
      clampMin: config.voltage.clampMin,
      clampMax: config.voltage.systemMax,
    });
  }
}
