import type { ComponentDeps, PhysicsConfig, Port, RngFn, SequentialComponent } from "@/lib/types";
import { NoiseGenerator } from "../noise";
import { Signal } from "../signal";
import { createPort } from "./base";

export class DFlipFlop implements SequentialComponent {
  readonly kind = "sequential" as const;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;

  private readonly qSignal: Signal;
  private readonly config: PhysicsConfig;
  private readonly rng: RngFn;

  private lastClkLogic: 0 | 1 = 0;
  private resetActive: boolean = false;

  private metastable: boolean = false;
  private metaTimer: number = 0;
  private metaResolveTime: number = 0;

  private pendingQ: 0 | 1 | null = null;
  private pendingTimer: number = 0;

  constructor(
    readonly id: string,
    _params: Record<string, unknown>,
    deps: ComponentDeps,
  ) {
    const { config, rng } = deps;
    this.config = config;
    this.rng = rng;

    const dPort = createPort("d");
    const clkPort = createPort("clk");
    const qPort = createPort("q");

    this.inputs = new Map([
      ["d", dPort],
      ["clk", clkPort],
    ]);
    this.outputs = new Map([["q", qPort]]);

    const noiseLevel =
      (config.simulation.defaultNoise / 100) *
      config.simulation.maxNoiseLevel *
      config.simulation.outputNoiseRatio;

    this.qSignal = new Signal(
      {
        baseHigh: (config.voltage.outputHighMin + config.voltage.outputHighMax) / 2,
        baseLow: config.voltage.outputLowMax / 2,
        zeta: 0.4,
        ringFreq: 120,
        clampMin: config.voltage.clampMin,
        clampMax: config.voltage.systemMax,
      },
      new NoiseGenerator(rng, noiseLevel),
    );
  }

  update(dt: number): void {
    if (this.pendingQ !== null) {
      this.pendingTimer -= dt;
      if (this.pendingTimer <= 0) {
        this.qSignal.targetLogic = this.pendingQ;
        this.pendingQ = null;
      }
    }

    if (this.metastable) {
      this.metaTimer += dt;
      if (this.metaTimer >= this.metaResolveTime) {
        this.metastable = false;
        this.qSignal.targetLogic = this.rng() > 0.5 ? 1 : 0;
      }
    }

    this.qSignal.update(dt);
    this.outputs.get("q")!.voltage = this.qSignal.voltage;
  }

  clock(_dt: number): void {
    if (this.resetActive) {
      this.qSignal.targetLogic = 0;
      this.metastable = false;
      this.pendingQ = null;
      return;
    }

    const clkVoltage = this.inputs.get("clk")!.voltage;
    const { logicHighMin, logicLowMax } = this.config.voltage;

    let clkLogic: 0 | 1;
    if (clkVoltage > logicHighMin) {
      clkLogic = 1;
    } else if (clkVoltage < logicLowMax) {
      clkLogic = 0;
    } else {
      clkLogic = this.lastClkLogic;
    }

    const isRisingEdge = this.lastClkLogic === 0 && clkLogic === 1;
    this.lastClkLogic = clkLogic;

    if (!isRisingEdge) return;

    const dVoltage = this.inputs.get("d")!.voltage;

    if (dVoltage > logicHighMin) {
      this.scheduleQ(1);
    } else if (dVoltage < logicLowMax) {
      this.scheduleQ(0);
    } else {
      this.enterMetastable();
    }
  }

  setReset(active: boolean): void {
    this.resetActive = active;
  }

  private scheduleQ(logic: 0 | 1): void {
    this.pendingQ = logic;
    this.pendingTimer = this.config.timing.tCQ;
  }

  private enterMetastable(): void {
    this.metastable = true;
    this.metaTimer = 0;
    const u = this.rng();
    this.metaResolveTime = -this.config.timing.tauMeta * Math.log(u || 1e-10);
    this.qSignal.snapTo(this.config.voltage.systemMax / 2);
  }
}
