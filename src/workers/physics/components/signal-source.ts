import type { ComponentDeps, Port, SequentialComponent } from "@/lib/types";
import { NoiseGenerator } from "../noise";
import { Signal } from "../signal";
import { createPort } from "./base";

export class SignalSource implements SequentialComponent {
  readonly kind = "sequential" as const;
  readonly inputs = new Map<string, Port>();
  readonly outputs: Map<string, Port>;

  private readonly signal: Signal;
  private readonly outPort: Port;
  private readonly noise: NoiseGenerator;
  private readonly maxNoiseLevel: number;

  constructor(
    readonly id: string,
    params: Record<string, unknown>,
    deps: ComponentDeps,
  ) {
    const { config, rng } = deps;
    const baseHigh =
      (params.baseHigh as number) ?? (config.voltage.logicHighMin + config.voltage.systemMax) / 2;
    const baseLow = (params.baseLow as number) ?? config.voltage.logicLowMax / 2;

    const outPort = createPort("out");
    this.outPort = outPort;
    this.outputs = new Map([["out", outPort]]);

    this.maxNoiseLevel = config.simulation.maxNoiseLevel;
    const noiseLevel = (config.simulation.defaultNoise / 100) * this.maxNoiseLevel;
    this.noise = new NoiseGenerator(rng, noiseLevel);

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

  update(dt: number): void {
    this.signal.update(dt);
    this.outPort.voltage = this.signal.voltage;
  }

  clock(_dt: number): void {}

  setTargetLogic(logic: 0 | 1 | boolean): void {
    this.signal.targetLogic = logic ? 1 : 0;
  }

  setNoise(percent: number): void {
    const sigma = (percent / 100) * this.maxNoiseLevel;
    this.noise.setSigma(sigma);
  }
}
