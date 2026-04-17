import type { CombinationalComponent, ComponentDeps, Port } from "@/lib/types";
import { AnalogOutput, mergeGateParams } from "../analog-output";
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
  private readonly sumOut: AnalogOutput;
  private readonly coutOut: AnalogOutput;
  private readonly threshold: number;

  constructor(
    readonly id: string,
    params: Record<string, unknown>,
    deps: ComponentDeps,
  ) {
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

    const cfg = mergeGateParams(deps.config, params);
    this.sumOut = new AnalogOutput(cfg, deps.rng);
    this.coutOut = new AnalogOutput(cfg, deps.rng);
  }

  evaluate(): void {
    const aHigh = this.aPort.voltage > this.threshold;
    const bHigh = this.bPort.voltage > this.threshold;
    const cinHigh = this.cinPort.voltage > this.threshold;
    const sumHigh = (aHigh !== bHigh) !== cinHigh;
    const coutHigh = (aHigh && bHigh) || (cinHigh && aHigh !== bHigh);
    this.sumOut.set(sumHigh ? 1 : 0);
    this.coutOut.set(coutHigh ? 1 : 0);
  }

  update(dt: number): void {
    this.sumOut.update(dt);
    this.coutOut.update(dt);
    this.sumPort.voltage = this.sumOut.voltage;
    this.coutPort.voltage = this.coutOut.voltage;
  }
}
