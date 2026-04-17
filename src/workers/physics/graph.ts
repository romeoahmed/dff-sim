// CircuitGraph: 从定义实例化组件和网络，传播电压，拓扑排序组合逻辑
import type {
  CircuitDefinition,
  CombinationalComponent,
  Component,
  Net,
  PhysicsConfig,
  Port,
  Probe,
  RngFn,
  SequentialComponent,
} from "@/lib/types";
import { isCombinational, isSequential } from "./components/base";
import type { ComponentRegistry } from "./components/registry";

export class CircuitGraph {
  private readonly components = new Map<string, Component>();
  private readonly nets = new Map<string, Net>();
  private readonly sequentialList: SequentialComponent[] = [];
  private readonly combinationalOrder: CombinationalComponent[] = [];

  constructor(
    definition: CircuitDefinition,
    registry: ComponentRegistry,
    config: PhysicsConfig,
    rng: RngFn,
  ) {
    // 实例化所有组件
    for (const def of definition.components) {
      const comp = registry.create(def.type, def.id, def.params, { config, rng });
      this.components.set(def.id, comp);
      if (isSequential(comp)) this.sequentialList.push(comp);
    }

    // 建立网络连接
    for (const netDef of definition.nets) {
      const driverComp = this.components.get(netDef.driver.componentId);
      if (!driverComp) {
        throw new Error(`Unknown component: ${netDef.driver.componentId}`);
      }
      const driverPort = driverComp.outputs.get(netDef.driver.port);
      if (!driverPort) {
        throw new Error(`Unknown output port: ${netDef.driver.componentId}.${netDef.driver.port}`);
      }
      const loadPorts: Port[] = [];
      for (const load of netDef.loads) {
        const loadComp = this.components.get(load.componentId);
        if (!loadComp) throw new Error(`Unknown component: ${load.componentId}`);
        const loadPort = loadComp.inputs.get(load.port);
        if (!loadPort) {
          throw new Error(`Unknown input port: ${load.componentId}.${load.port}`);
        }
        loadPorts.push(loadPort);
      }
      this.nets.set(netDef.id, { id: netDef.id, driverPort, loadPorts, voltage: 0 });
    }

    this.combinationalOrder.push(...this.levelize());
  }

  getComponent(id: string): Component {
    const c = this.components.get(id);
    if (!c) throw new Error(`Unknown component: ${id}`);
    return c;
  }

  getNet(id: string): Net {
    const n = this.nets.get(id);
    if (!n) throw new Error(`Unknown net: ${id}`);
    return n;
  }

  getSequential(): readonly SequentialComponent[] {
    return this.sequentialList;
  }

  getAllComponents(): Iterable<Component> {
    return this.components.values();
  }

  // 传播驱动端电压到负载端
  propagate(): void {
    for (const net of this.nets.values()) {
      net.voltage = net.driverPort.voltage;
      for (const load of net.loadPorts) {
        load.voltage = net.voltage;
      }
    }
  }

  evaluateCombinational(): void {
    for (const comp of this.combinationalOrder) {
      comp.evaluate();
    }
  }

  collectProbeVoltages(probes: readonly Probe[]): number[] {
    const out: number[] = new Array(probes.length).fill(0);
    for (const probe of probes) {
      const net = this.nets.get(probe.netId);
      if (net) out[probe.channelIndex] = net.voltage;
    }
    return out;
  }

  // Kahn 算法拓扑排序组合逻辑组件
  private levelize(): CombinationalComponent[] {
    const combinational: CombinationalComponent[] = [];
    for (const comp of this.components.values()) {
      if (isCombinational(comp)) combinational.push(comp);
    }
    if (combinational.length === 0) return [];

    const levelOf = new Map<string, number>();
    for (const seq of this.sequentialList) levelOf.set(seq.id, 0);

    const unresolved = new Set(combinational);
    let iteration = 0;
    const maxIterations = combinational.length + 1;

    while (unresolved.size > 0) {
      if (iteration++ > maxIterations) {
        throw new Error("Combinational feedback loop detected");
      }
      for (const comp of Array.from(unresolved)) {
        let maxInputLevel = -1;
        let allResolved = true;
        for (const port of comp.inputs.values()) {
          const driverId = this.findDriverOf(port);
          if (driverId === null) {
            maxInputLevel = Math.max(maxInputLevel, 0);
            continue;
          }
          const lvl = levelOf.get(driverId);
          if (lvl === undefined) {
            allResolved = false;
            break;
          }
          maxInputLevel = Math.max(maxInputLevel, lvl);
        }
        if (allResolved) {
          levelOf.set(comp.id, maxInputLevel + 1);
          unresolved.delete(comp);
        }
      }
    }

    return combinational.sort((a, b) => (levelOf.get(a.id) ?? 0) - (levelOf.get(b.id) ?? 0));
  }

  private findDriverOf(port: Port): string | null {
    for (const net of this.nets.values()) {
      if (net.loadPorts.includes(port)) {
        for (const [compId, comp] of this.components) {
          for (const outPort of comp.outputs.values()) {
            if (outPort === net.driverPort) return compId;
          }
        }
      }
    }
    return null;
  }
}
