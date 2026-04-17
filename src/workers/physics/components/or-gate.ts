import type { CombinationalComponent, ComponentDeps, Port } from "@/lib/types";
import { AnalogOutput, mergeGateParams } from "../analog-output";
import { createPort } from "./base";

export class ORGate implements CombinationalComponent {
  readonly kind = "combinational" as const;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;

  private readonly aPort: Port;
  private readonly bPort: Port;
  private readonly outPort: Port;
  private readonly out: AnalogOutput;
  private readonly threshold: number;

  constructor(
    readonly id: string,
    params: Record<string, unknown>,
    deps: ComponentDeps,
  ) {
    this.threshold = deps.config.voltage.logicHighMin;

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
    const aHigh = this.aPort.voltage > this.threshold;
    const bHigh = this.bPort.voltage > this.threshold;
    this.out.set(aHigh || bHigh ? 1 : 0);
  }

  update(dt: number): void {
    this.out.update(dt);
    this.outPort.voltage = this.out.voltage;
  }
}
