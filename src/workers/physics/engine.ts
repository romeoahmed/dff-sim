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

interface ConfigurableComponent {
  applyConfig(cfg: PhysicsConfig): void;
}

function isConfigurable(c: Component): c is Component & ConfigurableComponent {
  return typeof (c as Component & Partial<ConfigurableComponent>).applyConfig === "function";
}

export class SimulationEngine {
  private readonly graph: CircuitGraph;
  private readonly buffer: WaveformBuffer;
  private readonly probes: CircuitDefinition["probes"];
  private readonly sequentialList: readonly SequentialComponent[];
  private readonly probeScratch: Float64Array;
  private config: PhysicsConfig;
  private dt: number;
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
    this.probeScratch = new Float64Array(definition.probes.length);
    this.config = config;
    this.dt = config.simulation.physicsDt;
  }

  tick(realDt: number): void {
    if (realDt < 0) return;
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

  applyConfig(config: PhysicsConfig): void {
    this.config = config;
    this.dt = config.simulation.physicsDt;
    for (const comp of this.graph.getAllComponents()) {
      if (isConfigurable(comp)) comp.applyConfig(config);
    }
  }

  getConfig(): PhysicsConfig {
    return this.config;
  }

  private stepPhysics(dt: number): void {
    for (const seq of this.sequentialList) seq.update(dt);
    this.graph.propagate();
    for (const seq of this.sequentialList) seq.clock(dt);
    this.graph.evaluateCombinational();
    this.graph.updateCombinational(dt);
    this.graph.propagate();
    this.graph.collectProbeVoltagesInto(this.probes, this.probeScratch);
    this.buffer.push(this.probeScratch);
  }
}
