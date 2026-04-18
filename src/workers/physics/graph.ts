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
  private readonly combinationalList: CombinationalComponent[] = [];

  constructor(
    definition: CircuitDefinition,
    registry: ComponentRegistry,
    config: PhysicsConfig,
    rng: RngFn,
  ) {
    for (const def of definition.components) {
      const comp = registry.create(def.type, def.id, def.params, { config, rng });
      this.components.set(def.id, comp);
      if (isSequential(comp)) this.sequentialList.push(comp);
      if (isCombinational(comp)) this.combinationalList.push(comp);
    }

    const drivenOutputs = new Set<Port>();
    for (const netDef of definition.nets) {
      const driverComp = this.components.get(netDef.driver.componentId);
      if (!driverComp) {
        throw new Error(`Unknown component: ${netDef.driver.componentId}`);
      }
      const driverPort = driverComp.outputs.get(netDef.driver.port);
      if (!driverPort) {
        throw new Error(`Unknown output port: ${netDef.driver.componentId}.${netDef.driver.port}`);
      }
      if (drivenOutputs.has(driverPort)) {
        throw new Error(
          `Output port already driven: ${netDef.driver.componentId}.${netDef.driver.port}`,
        );
      }
      drivenOutputs.add(driverPort);
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

  getCombinational(): readonly CombinationalComponent[] {
    return this.combinationalList;
  }

  getAllComponents(): Iterable<Component> {
    return this.components.values();
  }

  propagate(): void {
    for (const net of this.nets.values()) {
      net.voltage = net.driverPort.voltage;
      for (const load of net.loadPorts) {
        load.voltage = net.voltage;
      }
    }
  }

  evaluateCombinational(): void {
    for (const comp of this.combinationalList) {
      comp.evaluate();
    }
  }

  updateCombinational(dt: number): void {
    for (const comp of this.combinationalList) {
      comp.update(dt);
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

  // Writes probe voltages into a caller-owned buffer to avoid per-tick allocation.
  collectProbeVoltagesInto(probes: readonly Probe[], out: Float64Array): void {
    out.fill(0);
    for (const probe of probes) {
      const net = this.nets.get(probe.netId);
      if (net) out[probe.channelIndex] = net.voltage;
    }
  }
}
