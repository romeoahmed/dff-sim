import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { CircuitDefinition } from "@/lib/types";
import { createDefaultRegistry } from "./components/default-registry";
import { SimulationEngine } from "./engine";

const noGateCircuit: CircuitDefinition = {
  id: "test-apply-config",
  name: "apply-config test",
  description: "",
  components: [
    { type: "SignalSource", id: "src", params: { baseHigh: 2.0, baseLow: 0.0 } },
    { type: "ANDGate", id: "gate", params: {} },
  ],
  nets: [
    {
      id: "a",
      driver: { componentId: "src", port: "out" },
      loads: [
        { componentId: "gate", port: "a" },
        { componentId: "gate", port: "b" },
      ],
    },
    { id: "out", driver: { componentId: "gate", port: "out" }, loads: [] },
  ],
  probes: [{ netId: "out", label: "Y", color: "#ffffff", channelIndex: 0 }],
  controls: [],
};

describe("SimulationEngine.applyConfig", () => {
  it("live-updates gate output rail voltage when systemMax changes", () => {
    const engine = new SimulationEngine(
      noGateCircuit,
      createDefaultRegistry(),
      DefaultPhysicsConfig,
      createSeededRng(1),
    );
    const src = engine.getComponent("src") as unknown as { setTargetLogic(v: boolean): void };
    src.setTargetLogic(true);

    // Warm up to steady-state HIGH
    for (let i = 0; i < 500; i++) engine.tick(DefaultPhysicsConfig.simulation.physicsDt);
    const gate = engine.getComponent("gate");
    const outPort = gate.outputs.get("out");
    if (!outPort) throw new Error("missing out port");
    const baselineV = outPort.voltage;
    expect(baselineV).toBeGreaterThan(1.5);

    // Bump outputHighMax up — the gate should rise toward the new rail.
    const raised = {
      ...DefaultPhysicsConfig,
      voltage: {
        ...DefaultPhysicsConfig.voltage,
        outputHighMin: 2.8,
        outputHighMax: 3.0,
        systemMax: 3.5,
      },
    };
    engine.applyConfig(raised);
    for (let i = 0; i < 500; i++) engine.tick(DefaultPhysicsConfig.simulation.physicsDt);

    expect(outPort.voltage).toBeGreaterThan(baselineV + 0.3);
  });
});
