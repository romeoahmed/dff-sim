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
    // 1. 时序组件 update（RC 滤波、噪声）
    for (const seq of this.sequentialList) seq.update(dt);
    // 2. 传播电压
    this.graph.propagate();
    // 3. 时序组件 clock（边沿检测、触发器采样）
    for (const seq of this.sequentialList) seq.clock(dt);
    // 4. 再次传播（触发器输出已更新）
    this.graph.propagate();
    // 5. 求值组合逻辑
    this.graph.evaluateCombinational();
    // 6. 最终传播
    this.graph.propagate();
    // 7. 写入波形缓冲区
    this.buffer.push(this.graph.collectProbeVoltages(this.probes));
  }
}
