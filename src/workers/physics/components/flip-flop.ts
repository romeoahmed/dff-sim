import type { ComponentDeps, PhysicsConfig, Port, RngFn, SequentialComponent } from "@/lib/types";
import { createGaussianSampler } from "../gaussian";
import { NoiseGenerator } from "../noise";
import { Signal } from "../signal";
import { createPort } from "./base";

function dffNoiseLevel(config: PhysicsConfig, percent: number): number {
  return (percent / 100) * config.simulation.maxNoiseLevel * config.simulation.outputNoiseRatio;
}

export class DFlipFlop implements SequentialComponent {
  readonly kind = "sequential" as const;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;

  private readonly qSignal: Signal;
  private readonly qNoise: NoiseGenerator;
  private readonly qPort: Port;
  private readonly clkPort: Port;
  private readonly dPort: Port;
  private config: PhysicsConfig;
  private readonly rng: RngFn;
  private readonly gaussianSample: () => number;
  private vMid: number;

  private lastClkLogic: 0 | 1 = 0;
  private lastDLogic: 0 | 1 = 0;
  // Time since the last observed D transition. Consumed by the setup/hold checks at clock edges.
  private timeSinceDEdge: number = Number.POSITIVE_INFINITY;
  // When a rising clock edge is detected, we open a hold-window of tHold during which another D
  // transition also counts as a violation; negative value means no hold check pending.
  private holdWindowRemaining: number = -1;
  private holdWindowDValue: 0 | 1 = 0;
  private resetActive: boolean = false;

  private metastable: boolean = false;
  private metaTimer: number = 0;
  private metaResolveTime: number = 0;
  private metaInputVoltage: number = 0;

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
    this.gaussianSample = createGaussianSampler(rng);
    this.vMid = (config.voltage.logicHighMin + config.voltage.logicLowMax) / 2;

    const dPort = createPort("d");
    const clkPort = createPort("clk");
    const qPort = createPort("q");

    this.dPort = dPort;
    this.clkPort = clkPort;
    this.qPort = qPort;

    this.inputs = new Map([
      ["d", dPort],
      ["clk", clkPort],
    ]);
    this.outputs = new Map([["q", qPort]]);

    this.qNoise = new NoiseGenerator(rng, dffNoiseLevel(config, config.simulation.defaultNoise));
    this.qSignal = new Signal(
      {
        baseHigh: (config.voltage.outputHighMin + config.voltage.outputHighMax) / 2,
        baseLow: config.voltage.outputLowMax / 2,
        zeta: 0.4,
        ringFreq: 120,
        clampMin: config.voltage.clampMin,
        clampMax: config.voltage.systemMax,
      },
      this.qNoise,
    );
  }

  update(dt: number): void {
    this.trackDEdges(dt);

    if (this.holdWindowRemaining > 0) {
      this.holdWindowRemaining -= dt;
      if (this.holdWindowRemaining <= 0) this.holdWindowRemaining = -1;
    }

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
        const sigma = this.config.timing.metaResolveNoiseSigma;
        const jitter = sigma * this.gaussianSample();
        const noisy = this.metaInputVoltage + jitter;
        this.qSignal.targetLogic = noisy > this.vMid ? 1 : 0;
      } else {
        // Q hovers around vMid with colored noise, rather than a perfectly flat line.
        const wobble = this.qNoise.sample();
        this.qSignal.snapTo(this.vMid + wobble);
        this.qPort.voltage = this.qSignal.voltage;
        return;
      }
    }

    this.qSignal.update(dt);
    this.qPort.voltage = this.qSignal.voltage;
  }

  clock(_dt: number): void {
    if (this.resetActive) {
      // Async reset still respects tCQ so the Q transition matches other clocked events.
      this.scheduleQ(0);
      this.metastable = false;
      return;
    }

    const clkVoltage = this.clkPort.voltage;
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

    const dVoltage = this.dPort.voltage;
    const { tSetup, tHold } = this.config.timing;

    // Setup violation: D transitioned too close to the rising edge.
    if (this.timeSinceDEdge < tSetup) {
      this.enterMetastable();
      return;
    }

    if (dVoltage > logicHighMin) {
      this.scheduleQ(1);
      this.holdWindowDValue = 1;
    } else if (dVoltage < logicLowMax) {
      this.scheduleQ(0);
      this.holdWindowDValue = 0;
    } else {
      this.enterMetastable();
      return;
    }

    // Open the hold window; trackDEdges() will trip us metastable if D flips inside it.
    this.holdWindowRemaining = tHold;
  }

  setReset(active: boolean): void {
    this.resetActive = active;
  }

  setNoise(percent: number): void {
    this.qNoise.setSigma(dffNoiseLevel(this.config, percent));
  }

  applyConfig(config: PhysicsConfig): void {
    this.config = config;
    this.vMid = (config.voltage.logicHighMin + config.voltage.logicLowMax) / 2;
    this.qSignal.applyConfig({
      baseHigh: (config.voltage.outputHighMin + config.voltage.outputHighMax) / 2,
      baseLow: config.voltage.outputLowMax / 2,
      zeta: 0.4,
      ringFreq: 120,
      clampMin: config.voltage.clampMin,
      clampMax: config.voltage.systemMax,
    });
  }

  private trackDEdges(dt: number): void {
    const { logicHighMin, logicLowMax } = this.config.voltage;
    const v = this.dPort.voltage;
    let curr: 0 | 1 | null = null;
    if (v > logicHighMin) curr = 1;
    else if (v < logicLowMax) curr = 0;

    this.timeSinceDEdge += dt;
    if (curr !== null && curr !== this.lastDLogic) {
      this.lastDLogic = curr;
      this.timeSinceDEdge = 0;
      if (this.holdWindowRemaining > 0 && curr !== this.holdWindowDValue) {
        // Hold violation: D flipped inside the hold window of the last capture.
        this.enterMetastable();
        this.holdWindowRemaining = -1;
      }
    }
  }

  private scheduleQ(logic: 0 | 1): void {
    if (this.pendingQ === logic) return; // already pending — don't reset the timer
    this.pendingQ = logic;
    this.pendingTimer = this.config.timing.tCQ;
  }

  private enterMetastable(): void {
    this.metastable = true;
    this.metaTimer = 0;
    const u = this.rng();
    this.metaResolveTime = -this.config.timing.tauMeta * Math.log(u || 1e-10);
    this.metaInputVoltage = this.dPort.voltage;
    this.qSignal.snapTo(this.vMid);
    this.pendingQ = null;
  }
}
