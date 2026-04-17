import type { CombinationalComponent, ComponentDeps, Port } from "@/lib/types";
import { AnalogOutput, mergeGateParams } from "../analog-output";
import { createPort } from "./base";

export class NOTGate implements CombinationalComponent {
  readonly kind = "combinational" as const;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;

  private readonly inPort: Port;
  private readonly outPort: Port;
  private readonly out: AnalogOutput;
  private readonly threshold: number;

  constructor(
    readonly id: string,
    params: Record<string, unknown>,
    deps: ComponentDeps,
  ) {
    this.threshold = deps.config.voltage.logicHighMin;

    const inp = createPort("in");
    const outP = createPort("out");
    this.inPort = inp;
    this.outPort = outP;
    this.inputs = new Map([["in", inp]]);
    this.outputs = new Map([["out", outP]]);

    this.out = new AnalogOutput(mergeGateParams(deps.config, params), deps.rng);
  }

  evaluate(): void {
    const inHigh = this.inPort.voltage > this.threshold;
    this.out.set(inHigh ? 0 : 1);
  }

  update(dt: number): void {
    this.out.update(dt);
    this.outPort.voltage = this.out.voltage;
  }
}
