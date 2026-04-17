import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { CircuitDefinition } from "@/lib/types";
import { createDefaultRegistry } from "@/workers/physics/components/default-registry";
import { SimulationEngine } from "@/workers/physics/engine";

const ringOscillatorCircuit: CircuitDefinition = {
  id: "ring-osc",
  name: "3-NOT Ring Oscillator",
  description: "Three NOT gates in a loop; oscillates at ~1 / (6·tPD).",
  components: [
    { type: "NOTGate", id: "n0", params: {} },
    { type: "NOTGate", id: "n1", params: {} },
    { type: "NOTGate", id: "n2", params: {} },
  ],
  nets: [
    {
      id: "n0_to_n1",
      driver: { componentId: "n0", port: "out" },
      loads: [{ componentId: "n1", port: "in" }],
    },
    {
      id: "n1_to_n2",
      driver: { componentId: "n1", port: "out" },
      loads: [{ componentId: "n2", port: "in" }],
    },
    {
      id: "n2_to_n0",
      driver: { componentId: "n2", port: "out" },
      loads: [{ componentId: "n0", port: "in" }],
    },
  ],
  probes: [
    { netId: "n0_to_n1", label: "A", color: "#8aadf4", channelIndex: 0 },
    { netId: "n1_to_n2", label: "B", color: "#c6a0f6", channelIndex: 1 },
    { netId: "n2_to_n0", label: "C", color: "#f5a97f", channelIndex: 2 },
  ],
  controls: [],
};

describe("3-NOT ring oscillator", () => {
  it("instantiates without rejecting the feedback loop", () => {
    const registry = createDefaultRegistry();
    const rng = createSeededRng(1);
    expect(
      () => new SimulationEngine(ringOscillatorCircuit, registry, DefaultPhysicsConfig, rng),
    ).not.toThrow();
  });

  it("oscillates at approximately 1 / (6 * tPD) Hz", () => {
    const registry = createDefaultRegistry();
    const rng = createSeededRng(1);
    const engine = new SimulationEngine(ringOscillatorCircuit, registry, DefaultPhysicsConfig, rng);
    const dt = DefaultPhysicsConfig.simulation.physicsDt;
    const tPD = DefaultPhysicsConfig.gates.tPD;
    const expectedPeriod = 6 * tPD;
    const { logicHighMin } = DefaultPhysicsConfig.voltage;

    const simDuration = 15 * expectedPeriod;
    const buffer = engine.getBuffer();
    const steps = Math.ceil(simDuration / dt);
    for (let i = 0; i < steps; i++) engine.tick(dt);

    const channel = buffer.getChannel(0);
    const high = Array.from(channel).map((v) => v > logicHighMin);
    let transitions = 0;
    for (let i = 1; i < high.length; i++) {
      if (high[i] !== high[i - 1]) transitions++;
    }
    expect(transitions).toBeGreaterThan(0);

    const bufferDuration = buffer.length * dt;
    const measuredFrequency = transitions / (2 * bufferDuration);
    const expectedFrequency = 1 / expectedPeriod;
    const ratio = measuredFrequency / expectedFrequency;
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(3);
  });
});
