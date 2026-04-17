// SimulationEngine: 持有 CircuitGraph 和 WaveformBuffer，以固定时间步运行物理仿真
import type {
  CircuitDefinition,
  Component,
  PhysicsConfig,
  RngFn,
  SequentialComponent,
} from "@/lib/types";
import type { ComponentRegistry } from "./components/registry";
import { CircuitGraph } from "./graph";
import { WaveformBuffer } from "./waveform-buffer";

export class SimulationEngine {
  private readonly graph: CircuitGraph;
  private readonly buffer: WaveformBuffer;
  private readonly probes: CircuitDefinition["probes"];
  private readonly sequentialList: readonly SequentialComponent[];
  private readonly dt: number;
  private accumulator: number = 0;

  constructor(
    definition: CircuitDefinition,
    registry: ComponentRegistry,
    config: PhysicsConfig,
    rng: RngFn,
  ) {
    this.graph = new CircuitGraph(definition, registry, config, rng);
    this.probes = definition.probes;
    this.buffer = new WaveformBuffer(definition.probes.length, config.simulation.bufferLength);
    this.sequentialList = this.graph.getSequential();
    this.dt = config.simulation.physicsDt;
  }

  tick(realDt: number): void {
    this.accumulator += Math.min(realDt, 0.1);
    while (this.accumulator >= this.dt) {
      this.stepPhysics(this.dt);
      this.accumulator -= this.dt;
    }
  }

  getBuffer(): WaveformBuffer {
    return this.buffer;
  }

  getComponent(id: string): Component {
    return this.graph.getComponent(id);
  }

  getAllComponents(): Iterable<Component> {
    return this.graph.getAllComponents();
  }

  getProbeVoltages(): number[] {
    return this.graph.collectProbeVoltages(this.probes);
  }

  private stepPhysics(dt: number): void {
    for (const seq of this.sequentialList) seq.update(dt);
    this.graph.propagate();
    for (const seq of this.sequentialList) seq.clock(dt);
    this.graph.evaluateCombinational();
    this.graph.updateCombinational(dt);
    this.graph.propagate();
    this.buffer.push(this.graph.collectProbeVoltages(this.probes));
  }
}
