import type { CombinationalComponent, ComponentDeps, PhysicsConfig, Port } from "@/lib/types";
import { AnalogOutput, mergeGateParams } from "../analog-output";
import { createPort, readLogicInput } from "./base";

export class XORGate implements CombinationalComponent {
  readonly kind = "combinational" as const;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;

  private readonly aPort: Port;
  private readonly bPort: Port;
  private readonly outPort: Port;
  private readonly out: AnalogOutput;
  private readonly params: Record<string, unknown>;
  private config: PhysicsConfig;
  private highThreshold: number;
  private lowThreshold: number;
  private lastA: 0 | 1 = 0;
  private lastB: 0 | 1 = 0;

  constructor(
    readonly id: string,
    params: Record<string, unknown>,
    deps: ComponentDeps,
  ) {
    this.config = deps.config;
    this.params = params;
    this.highThreshold = deps.config.voltage.logicHighMin;
    this.lowThreshold = deps.config.voltage.logicLowMax;

    const a = createPort("a");
    const b = createPort("b");
    const outP = createPort("out");
    this.aPort = a;
    this.bPort = b;
    this.outPort = outP;
    this.inputs = new Map([
      ["a", a],
      ["b", b],
    ]);
    this.outputs = new Map([["out", outP]]);

    this.out = new AnalogOutput(mergeGateParams(deps.config, params), deps.rng);
  }

  evaluate(): void {
    this.lastA = readLogicInput(
      this.aPort.voltage,
      this.lastA,
      this.highThreshold,
      this.lowThreshold,
    );
    this.lastB = readLogicInput(
      this.bPort.voltage,
      this.lastB,
      this.highThreshold,
      this.lowThreshold,
    );
    this.out.set(this.lastA !== this.lastB ? 1 : 0);
  }

  update(dt: number): void {
    this.out.update(dt);
    this.outPort.voltage = this.out.voltage;
  }

  setNoise(percent: number): void {
    this.out.setNoise(percent, this.config);
  }

  applyConfig(config: PhysicsConfig): void {
    this.config = config;
    this.highThreshold = config.voltage.logicHighMin;
    this.lowThreshold = config.voltage.logicLowMax;
    this.out.applyConfig(mergeGateParams(config, this.params));
  }
}
