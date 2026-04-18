import type { CombinationalComponent, ComponentDeps, PhysicsConfig, Port } from "@/lib/types";
import { AnalogOutput, mergeGateParams } from "../analog-output";
import { createPort, readLogicInput } from "./base";

export class NOTGate implements CombinationalComponent {
  readonly kind = "combinational" as const;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;

  private readonly inPort: Port;
  private readonly outPort: Port;
  private readonly out: AnalogOutput;
  private readonly params: Record<string, unknown>;
  private config: PhysicsConfig;
  private highThreshold: number;
  private lowThreshold: number;
  private lastIn: 0 | 1 = 0;

  constructor(
    readonly id: string,
    params: Record<string, unknown>,
    deps: ComponentDeps,
  ) {
    this.config = deps.config;
    this.params = params;
    this.highThreshold = deps.config.voltage.logicHighMin;
    this.lowThreshold = deps.config.voltage.logicLowMax;

    const inp = createPort("in");
    const outP = createPort("out");
    this.inPort = inp;
    this.outPort = outP;
    this.inputs = new Map([["in", inp]]);
    this.outputs = new Map([["out", outP]]);

    this.out = new AnalogOutput(mergeGateParams(deps.config, params), deps.rng);
  }

  evaluate(): void {
    this.lastIn = readLogicInput(
      this.inPort.voltage,
      this.lastIn,
      this.highThreshold,
      this.lowThreshold,
    );
    this.out.set(this.lastIn === 1 ? 0 : 1);
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
