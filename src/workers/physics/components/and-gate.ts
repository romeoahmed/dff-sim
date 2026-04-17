import type { CombinationalComponent, ComponentDeps, Port } from "@/lib/types";
import { createPort } from "./base";

export class ANDGate implements CombinationalComponent {
  readonly kind = "combinational" as const;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;

  private readonly aPort: Port;
  private readonly bPort: Port;
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

    const a = createPort("a");
    const b = createPort("b");
    const out = createPort("out");
    this.aPort = a;
    this.bPort = b;
    this.outPort = out;
    this.inputs = new Map([
      ["a", a],
      ["b", b],
    ]);
    this.outputs = new Map([["out", out]]);
  }

  evaluate(): void {
    const aHigh = this.aPort.voltage > this.threshold;
    const bHigh = this.bPort.voltage > this.threshold;
    this.outPort.voltage = aHigh && bHigh ? this.vHigh : 0.0;
  }

  update(_dt: number): void {
    // No-op until Task 5 wires AnalogOutput.
  }
}
