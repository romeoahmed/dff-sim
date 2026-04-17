import { describe, expect, it } from "vitest";
import { CircuitGraph } from "./graph";
import { ComponentRegistry } from "./components/registry";
import { DFlipFlop } from "./components/flip-flop";
import { ClockSource } from "./components/clock-source";
import { SignalSource } from "./components/signal-source";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { CircuitDefinition } from "@/lib/types";

// NOTE: constructors take ComponentDeps as third arg after the refactor
const testRegistry = new ComponentRegistry();
testRegistry.register("ClockSource", (id, p, d) => new ClockSource(id, p, d));
testRegistry.register("SignalSource", (id, p, d) => new SignalSource(id, p, d));
testRegistry.register("DFlipFlop", (id, p, d) => new DFlipFlop(id, p, d));

const dffDef: CircuitDefinition = {
  id: "test-dff",
  name: "Test DFF",
  description: "test",
  components: [
    { type: "ClockSource", id: "clk", params: {} },
    { type: "SignalSource", id: "d", params: {} },
    { type: "DFlipFlop", id: "dff0", params: {} },
  ],
  nets: [
    {
      id: "clk_net",
      driver: { componentId: "clk", port: "out" },
      loads: [{ componentId: "dff0", port: "clk" }],
    },
    {
      id: "d_net",
      driver: { componentId: "d", port: "out" },
      loads: [{ componentId: "dff0", port: "d" }],
    },
    { id: "q_net", driver: { componentId: "dff0", port: "q" }, loads: [] },
  ],
  probes: [
    { netId: "clk_net", label: "CLK", color: "#0f0", channelIndex: 0 },
    { netId: "d_net", label: "D", color: "#00f", channelIndex: 1 },
    { netId: "q_net", label: "Q", color: "#f00", channelIndex: 2 },
  ],
  controls: [],
};

describe("CircuitGraph", () => {
  it("instantiates all components from definition", () => {
    const graph = new CircuitGraph(dffDef, testRegistry, DefaultPhysicsConfig, createSeededRng(1));
    expect(graph.getComponent("clk")).toBeDefined();
    expect(graph.getComponent("d")).toBeDefined();
    expect(graph.getComponent("dff0")).toBeDefined();
  });

  it("creates nets with driver and loads", () => {
    const graph = new CircuitGraph(dffDef, testRegistry, DefaultPhysicsConfig, createSeededRng(1));
    const clkNet = graph.getNet("clk_net");
    expect(clkNet.loadPorts.length).toBe(1);
  });

  it("propagates driver voltage to loads", () => {
    const graph = new CircuitGraph(dffDef, testRegistry, DefaultPhysicsConfig, createSeededRng(1));
    const clkOut = graph.getComponent("clk").outputs.get("out")!;
    clkOut.voltage = 2.0;
    graph.propagate();
    const dffClk = graph.getComponent("dff0").inputs.get("clk")!;
    expect(dffClk.voltage).toBe(2.0);
  });

  it("throws on unknown net driver component", () => {
    const badDef: CircuitDefinition = {
      ...dffDef,
      nets: [{ id: "bad", driver: { componentId: "ghost", port: "out" }, loads: [] }],
    };
    expect(() =>
      new CircuitGraph(badDef, testRegistry, DefaultPhysicsConfig, createSeededRng(1)),
    ).toThrow("Unknown component");
  });

  it("collects probed net voltages", () => {
    const graph = new CircuitGraph(dffDef, testRegistry, DefaultPhysicsConfig, createSeededRng(1));
    graph.getComponent("clk").outputs.get("out")!.voltage = 1.5;
    graph.getComponent("d").outputs.get("out")!.voltage = 0.3;
    graph.propagate();
    const voltages = graph.collectProbeVoltages(dffDef.probes);
    expect(voltages[0]).toBe(1.5);
    expect(voltages[1]).toBe(0.3);
  });
});
