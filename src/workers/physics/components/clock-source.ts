import type { ComponentDeps, Port, RngFn, SequentialComponent } from "@/lib/types";
import { NoiseGenerator } from "../noise";
import { Signal } from "../signal";
import { createPort } from "./base";

export class ClockSource implements SequentialComponent {
  readonly kind = "sequential" as const;
  readonly inputs = new Map<string, Port>();
  readonly outputs: Map<string, Port>;

  private readonly signal: Signal;
  private readonly outPort: Port;
  private phase: number = 0;
  private speed: number;
  private readonly jitterRms: number;
  private readonly rng: RngFn;
  private readonly speedFactor: number;

  constructor(
    readonly id: string,
    params: Record<string, unknown>,
    deps: ComponentDeps,
  ) {
    const { config, rng } = deps;
    this.rng = rng;
    this.speed = (params.speed as number) ?? config.simulation.defaultSpeed;
    this.jitterRms = (params.jitterRms as number) ?? 0.02;
    this.speedFactor = config.simulation.clockSpeedFactor;

    const outPort = createPort("out");
    this.outPort = outPort;
    this.outputs = new Map([["out", outPort]]);

    const noise = new NoiseGenerator(rng, 0);
    this.signal = new Signal(
      {
        baseHigh: config.voltage.outputHighMax,
        baseLow: 0.0,
        zeta: 0.8,
        ringFreq: 80,
        clampMin: config.voltage.clampMin,
        clampMax: config.voltage.systemMax,
      },
      noise,
    );
  }

  update(dt: number): void {
    this.signal.update(dt);
    this.outPort.voltage = this.signal.voltage;
  }

  clock(dt: number): void {
    const oldPhase = this.phase;
    // Add Gaussian jitter to phase — affects timing but not logic direction
    const jitter = this.gaussianJitter() * this.jitterRms;
    this.phase += this.speed * this.speedFactor * dt * 60 + jitter;
    if (this.phase < 0) this.phase += Math.PI * 2;
    if (this.phase >= Math.PI * 2) this.phase -= Math.PI * 2;

    const oldHalf = Math.floor(oldPhase / Math.PI) % 2;
    const newHalf = Math.floor(this.phase / Math.PI) % 2;

    if (oldHalf !== newHalf) {
      // newHalf=0 → rising edge (HIGH), newHalf=1 → falling edge (LOW)
      this.signal.targetLogic = newHalf === 0 ? 1 : 0;
    }
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  private gaussianJitter(): number {
    const u1 = this.rng();
    const u2 = this.rng();
    return Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
  }
}
