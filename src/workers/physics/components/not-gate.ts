import type { CombinationalComponent, ComponentDeps, Port } from "@/lib/types";
import { createPort } from "./base";

export class NOTGate implements CombinationalComponent {
  readonly kind = "combinational" as const;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;

  private readonly inPort: Port;
  private readonly outPort: Port;
  private readonly vHigh: number;
  private readonly threshold: number;

  constructor(
    readonly id: string,
    _params: Record<string, unknown>,
    deps: ComponentDeps,
  ) {
    this.vHigh = deps.config.voltage.outputHighMax;
    this.threshold = deps.config.voltage.logicHighMin;

    const inp = createPort("in");
    const out = createPort("out");
    this.inPort = inp;
    this.outPort = out;
    this.inputs = new Map([["in", inp]]);
    this.outputs = new Map([["out", out]]);
  }

  evaluate(): void {
    this.outPort.voltage = this.inPort.voltage > this.threshold ? 0.0 : this.vHigh;
  }
}
