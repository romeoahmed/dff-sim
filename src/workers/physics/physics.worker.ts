import * as Comlink from "comlink";
import { DefaultPhysicsConfig } from "@/lib/constants";
import type { CircuitDefinition, PhysicsConfig, VoltageSpecConfig } from "@/lib/types";
import { createDefaultRegistry } from "./components/default-registry";
import { SimulationEngine } from "./engine";

const TICK_INTERVAL_MS = 8;

/** Looks up a setter method by name on an arbitrary object without unsafe double-casts. */
function resolveMethod(target: unknown, name: string): ((v: number | boolean) => void) | undefined {
  if (target === null || typeof target !== "object") return undefined;
  const method = (target as Record<string, unknown>)[name];
  return typeof method === "function" ? (method as (v: number | boolean) => void) : undefined;
}

export interface PhysicsAPI {
  loadCircuit(definition: CircuitDefinition): void;
  setParam(componentId: string, key: string, value: number | boolean): void;
  setSettings(specs: Partial<VoltageSpecConfig>): void;
  registerRenderPort(port: MessagePort): void;
  registerStatusCallback(cb: (voltages: number[]) => void): void;
  start(): void;
  stop(): void;
}

class PhysicsWorker implements PhysicsAPI {
  private engine: SimulationEngine | null = null;
  private config: PhysicsConfig = DefaultPhysicsConfig;
  private readonly registry = createDefaultRegistry();
  private tickHandle: ReturnType<typeof setTimeout> | null = null;
  private renderPort: MessagePort | null = null;
  private statusCallback: ((v: number[]) => void) | null = null;
  private lastStatusTime: number = 0;
  private lastTickTime: number = 0;

  loadCircuit(definition: CircuitDefinition): void {
    this.engine = new SimulationEngine(definition, this.registry, this.config, Math.random);
  }

  setParam(componentId: string, key: string, value: number | boolean): void {
    if (!this.engine) return;

    const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;

    if (componentId === "global") {
      for (const comp of this.engine.getAllComponents()) {
        resolveMethod(comp, setterName)?.call(comp, value);
      }
      return;
    }

    const comp = this.engine.getComponent(componentId);
    resolveMethod(comp, setterName)?.call(comp, value);
  }

  setSettings(specs: Partial<VoltageSpecConfig>): void {
    this.config = {
      ...this.config,
      voltage: { ...this.config.voltage, ...specs },
    };
  }

  registerRenderPort(port: MessagePort): void {
    this.renderPort = port;
  }

  registerStatusCallback(cb: (voltages: number[]) => void): void {
    this.statusCallback = cb;
  }

  start(): void {
    if (this.tickHandle !== null) return;
    this.lastTickTime = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = (now - this.lastTickTime) / 1000;
      this.lastTickTime = now;
      this.tick(dt);
      this.tickHandle = setTimeout(loop, TICK_INTERVAL_MS);
    };
    loop();
  }

  stop(): void {
    if (this.tickHandle !== null) {
      clearTimeout(this.tickHandle);
      this.tickHandle = null;
    }
  }

  private tick(dt: number): void {
    if (!this.engine) return;
    this.engine.tick(dt);

    if (this.renderPort) {
      const buf = this.engine.getBuffer();
      const payload = buf.toChannelMajorBuffer();
      this.renderPort.postMessage(
        {
          type: "frame",
          data: payload,
          writePointer: buf.writePointer,
          channelCount: buf.channelCount,
          length: buf.length,
        },
        [payload.buffer],
      );
    }

    const now = performance.now();
    if (now - this.lastStatusTime >= 50 && this.statusCallback) {
      this.statusCallback(this.engine.getProbeVoltages());
      this.lastStatusTime = now;
    }
  }
}

const api = new PhysicsWorker();
Comlink.expose(api);
