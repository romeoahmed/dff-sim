import type { CombinationalComponent, ComponentDeps, Port } from "@/lib/types";
import { createPort } from "./base";

export class FullAdder implements CombinationalComponent {
  readonly kind = "combinational" as const;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;

  private readonly aPort: Port;
  private readonly bPort: Port;
  private readonly cinPort: Port;
  private readonly sumPort: Port;
  private readonly coutPort: Port;
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
    const cin = createPort("cin");
    const sum = createPort("sum");
    const cout = createPort("cout");
    this.aPort = a;
    this.bPort = b;
    this.cinPort = cin;
    this.sumPort = sum;
    this.coutPort = cout;
    this.inputs = new Map([
      ["a", a],
      ["b", b],
      ["cin", cin],
    ]);
    this.outputs = new Map([
      ["sum", sum],
      ["cout", cout],
    ]);
  }

  evaluate(): void {
    const aHigh = this.aPort.voltage > this.threshold;
    const bHigh = this.bPort.voltage > this.threshold;
    const cinHigh = this.cinPort.voltage > this.threshold;
    const sumHigh = (aHigh !== bHigh) !== cinHigh;
    const coutHigh = (aHigh && bHigh) || (cinHigh && aHigh !== bHigh);
    this.sumPort.voltage = sumHigh ? this.vHigh : 0.0;
    this.coutPort.voltage = coutHigh ? this.vHigh : 0.0;
  }

  update(_dt: number): void {
    // No-op until Task 5 wires AnalogOutput.
  }
}
