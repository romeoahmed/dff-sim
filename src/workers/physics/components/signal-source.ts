import type { ComponentDeps, PhysicsConfig, Port, SequentialComponent } from "@/lib/types";
import { NoiseGenerator } from "../noise";
import { Signal } from "../signal";
import { createPort } from "./base";

function signalNoiseLevel(config: PhysicsConfig, percent: number): number {
  return (percent / 100) * config.simulation.maxNoiseLevel;
}

export class SignalSource implements SequentialComponent {
  readonly kind = "sequential" as const;
  readonly inputs = new Map<string, Port>();
  readonly outputs: Map<string, Port>;

  private readonly signal: Signal;
  private readonly outPort: Port;
  private readonly noise: NoiseGenerator;
  private readonly params: Record<string, unknown>;
  private config: PhysicsConfig;

  constructor(
    readonly id: string,
    params: Record<string, unknown>,
    deps: ComponentDeps,
  ) {
    const { config, rng } = deps;
    this.config = config;
    this.params = params;
    const { baseHigh, baseLow } = this.resolveRails(config);

    const outPort = createPort("out");
    this.outPort = outPort;
    this.outputs = new Map([["out", outPort]]);

    this.noise = new NoiseGenerator(rng, signalNoiseLevel(config, config.simulation.defaultNoise));

    this.signal = new Signal(
      {
        baseHigh,
        baseLow,
        zeta: 0.8,
        ringFreq: 80,
        clampMin: config.voltage.clampMin,
        clampMax: config.voltage.systemMax,
      },
      this.noise,
    );
  }

  private resolveRails(config: PhysicsConfig): { baseHigh: number; baseLow: number } {
    const baseHigh =
      (this.params.baseHigh as number | undefined) ??
      (config.voltage.logicHighMin + config.voltage.systemMax) / 2;
    const baseLow = (this.params.baseLow as number | undefined) ?? config.voltage.logicLowMax / 2;
    return { baseHigh, baseLow };
  }

  update(dt: number): void {
    this.signal.update(dt);
    this.outPort.voltage = this.signal.voltage;
  }

  clock(_dt: number): void {}

  setTargetLogic(logic: 0 | 1 | boolean): void {
    this.signal.targetLogic = logic ? 1 : 0;
  }

  setNoise(percent: number): void {
    this.noise.setSigma(signalNoiseLevel(this.config, percent));
  }

  applyConfig(config: PhysicsConfig): void {
    this.config = config;
    const { baseHigh, baseLow } = this.resolveRails(config);
    this.signal.applyConfig({
      baseHigh,
      baseLow,
      zeta: 0.8,
      ringFreq: 80,
      clampMin: config.voltage.clampMin,
      clampMax: config.voltage.systemMax,
    });
  }
}
