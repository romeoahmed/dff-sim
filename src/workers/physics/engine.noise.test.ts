import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { CircuitDefinition } from "@/lib/types";
import { createDefaultRegistry } from "./components/default-registry";
import { SimulationEngine } from "./engine";

const circuit: CircuitDefinition = {
  id: "noise-test",
  name: "noise test",
  description: "",
  components: [
    { type: "SignalSource", id: "src", params: { baseHigh: 2.0, baseLow: 0.0 } },
    { type: "ANDGate", id: "g", params: {} },
    { type: "NOTGate", id: "n", params: {} },
  ],
  nets: [
    {
      id: "a",
      driver: { componentId: "src", port: "out" },
      loads: [
        { componentId: "g", port: "a" },
        { componentId: "g", port: "b" },
      ],
    },
    {
      id: "mid",
      driver: { componentId: "g", port: "out" },
      loads: [{ componentId: "n", port: "in" }],
    },
    { id: "y", driver: { componentId: "n", port: "out" }, loads: [] },
  ],
  probes: [
    { netId: "mid", label: "MID", color: "#fff", channelIndex: 0 },
    { netId: "y", label: "Y", color: "#fff", channelIndex: 1 },
  ],
  controls: [],
};

function sampleStdDev(engine: SimulationEngine, portGetter: () => number, samples: number): number {
  const dt = DefaultPhysicsConfig.simulation.physicsDt;
  // Let state settle
  for (let i = 0; i < 1000; i++) engine.tick(dt);
  const values: number[] = [];
  for (let i = 0; i < samples; i++) {
    engine.tick(dt);
    values.push(portGetter());
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

describe("engine: global noise slider propagation", () => {
  it("increases gate output jitter when noise is raised via setNoise on every component", () => {
    const engine = new SimulationEngine(
      circuit,
      createDefaultRegistry(),
      DefaultPhysicsConfig,
      createSeededRng(7),
    );
    (engine.getComponent("src") as unknown as { setTargetLogic(v: boolean): void }).setTargetLogic(
      true,
    );

    const mid = engine.getComponent("g").outputs.get("out");
    if (!mid) throw new Error("missing");

    // Baseline: zero global noise on all components
    for (const comp of engine.getAllComponents()) {
      const setter = (comp as { setNoise?: (p: number) => void }).setNoise;
      if (typeof setter === "function") setter.call(comp, 0);
    }
    const stdLow = sampleStdDev(engine, () => mid.voltage, 1000);

    // Ramp: full-scale noise on all components
    for (const comp of engine.getAllComponents()) {
      const setter = (comp as { setNoise?: (p: number) => void }).setNoise;
      if (typeof setter === "function") setter.call(comp, 100);
    }
    const stdHigh = sampleStdDev(engine, () => mid.voltage, 1000);

    expect(stdHigh).toBeGreaterThan(stdLow * 2);
  });

  it("every combinational + sequential component exposes setNoise", () => {
    const engine = new SimulationEngine(
      circuit,
      createDefaultRegistry(),
      DefaultPhysicsConfig,
      createSeededRng(1),
    );
    for (const comp of engine.getAllComponents()) {
      const setter = (comp as { setNoise?: unknown }).setNoise;
      expect(typeof setter).toBe("function");
    }
  });
});
