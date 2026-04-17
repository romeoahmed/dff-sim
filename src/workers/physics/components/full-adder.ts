import type { CombinationalComponent, ComponentDeps, PhysicsConfig, Port } from "@/lib/types";
import { AnalogOutput, type AnalogOutputConfig, mergeGateParams } from "../analog-output";
import { createPort, readLogicInput } from "./base";

function coutConfig(base: AnalogOutputConfig, config: PhysicsConfig): AnalogOutputConfig {
  const coutTPD = config.gates.tPD_cout ?? base.tPD * 0.6;
  return { ...base, tPD: coutTPD };
}

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
  private readonly params: Record<string, unknown>;
  private config: PhysicsConfig;
  private highThreshold: number;
  private lowThreshold: number;
  private lastA: 0 | 1 = 0;
  private lastB: 0 | 1 = 0;
  private lastCin: 0 | 1 = 0;

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

    const sumCfg = mergeGateParams(deps.config, params);
    this.sumOut = new AnalogOutput(sumCfg, deps.rng);
    this.coutOut = new AnalogOutput(coutConfig(sumCfg, deps.config), deps.rng);
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
    this.lastCin = readLogicInput(
      this.cinPort.voltage,
      this.lastCin,
      this.highThreshold,
      this.lowThreshold,
    );
    const aHigh = this.lastA === 1;
    const bHigh = this.lastB === 1;
    const cinHigh = this.lastCin === 1;
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

  setNoise(percent: number): void {
    this.sumOut.setNoise(percent, this.config);
    this.coutOut.setNoise(percent, this.config);
  }

  applyConfig(config: PhysicsConfig): void {
    this.config = config;
    this.highThreshold = config.voltage.logicHighMin;
    this.lowThreshold = config.voltage.logicLowMax;
    const sumCfg = mergeGateParams(config, this.params);
    this.sumOut.applyConfig(sumCfg);
    this.coutOut.applyConfig(coutConfig(sumCfg, config));
  }
}
