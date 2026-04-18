import * as Comlink from "comlink";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { CircuitDefinition, PhysicsConfig, RngFn, VoltageSpecConfig } from "@/lib/types";
import { createDefaultRegistry } from "./components/default-registry";
import { SimulationEngine } from "./engine";

const TICK_INTERVAL_MS = 8;

/** Looks up a setter method by name on an arbitrary object without unsafe double-casts. */
function resolveMethod(target: unknown, name: string): ((v: number | boolean) => void) | undefined {
  if (target === null || typeof target !== "object") return undefined;
  const method = (target as Record<string, unknown>)[name];
  return typeof method === "function" ? (method as (v: number | boolean) => void) : undefined;
}

export interface LoadCircuitOptions {
  /** Optional RNG seed for deterministic simulation (tests / bug repro). */
  readonly seed?: number;
}

export interface PhysicsAPI {
  loadCircuit(definition: CircuitDefinition, opts?: LoadCircuitOptions): void;
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
  private statusCallback: Comlink.Remote<(v: number[]) => void> | null = null;
  private lastStatusTime: number = 0;
  private lastTickTime: number = 0;
  private lastSentWritePointer: number = 0;
  private firstFrameSent: boolean = false;

  loadCircuit(definition: CircuitDefinition, opts?: LoadCircuitOptions): void {
    this.stop();
    const rng: RngFn = opts?.seed !== undefined ? createSeededRng(opts.seed) : Math.random;
    this.engine = new SimulationEngine(definition, this.registry, this.config, rng);
    this.lastSentWritePointer = 0;
    this.firstFrameSent = false;
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
    this.engine?.applyConfig(this.config);
  }

  registerRenderPort(port: MessagePort): void {
    this.renderPort = port;
  }

  registerStatusCallback(cb: (voltages: number[]) => void): void {
    // Comlink delivers the callback as Remote<fn> on the worker side, which carries [releaseProxy]
    this.statusCallback = cb as Comlink.Remote<(v: number[]) => void>;
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
    if (this.statusCallback) {
      this.statusCallback[Comlink.releaseProxy]();
      this.statusCallback = null;
    }
  }

  private tick(dt: number): void {
    if (!this.engine) return;
    this.engine.tick(dt);

    if (this.renderPort) this.sendDeltaFrame();

    const now = performance.now();
    if (now - this.lastStatusTime >= 50 && this.statusCallback) {
      this.statusCallback(this.engine.getProbeVoltages());
      this.lastStatusTime = now;
    }
  }

  private sendDeltaFrame(): void {
    if (!this.engine || !this.renderPort) return;
    const buf = this.engine.getBuffer();
    const writePointer = buf.writePointer;
    const length = buf.length;
    const channelCount = buf.channelCount;
    const mask = length - 1;

    // First frame: send the full buffer so the render worker has an initial snapshot.
    if (!this.firstFrameSent) {
      const payload = buf.toChannelMajorBuffer();
      this.renderPort.postMessage(
        {
          type: "frame",
          data: payload,
          startPointer: 0,
          newSamples: length,
          writePointer,
          channelCount,
          bufferLength: length,
        },
        [payload.buffer],
      );
      this.firstFrameSent = true;
      this.lastSentWritePointer = writePointer;
      return;
    }

    const newSamples = (writePointer - this.lastSentWritePointer) & mask;
    if (newSamples === 0) return;

    const payload = new Float32Array(channelCount * newSamples);
    const startPointer = this.lastSentWritePointer;
    for (let c = 0; c < channelCount; c++) {
      const channel = buf.getChannel(c);
      const base = c * newSamples;
      for (let i = 0; i < newSamples; i++) {
        payload[base + i] = channel[(startPointer + i) & mask] ?? 0;
      }
    }

    this.renderPort.postMessage(
      {
        type: "frame",
        data: payload,
        startPointer,
        newSamples,
        writePointer,
        channelCount,
        bufferLength: length,
      },
      [payload.buffer],
    );
    this.lastSentWritePointer = writePointer;
  }
}

const api = new PhysicsWorker();
Comlink.expose(api);
