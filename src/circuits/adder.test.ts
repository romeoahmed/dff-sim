import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import { createDefaultRegistry } from "@/workers/physics/components/default-registry";
import { CircuitGraph } from "@/workers/physics/graph";
import { adderCircuit } from "./adder";

const registry = createDefaultRegistry();

describe("adderCircuit definition", () => {
  it("instantiates without error", () => {
    expect(
      () => new CircuitGraph(adderCircuit, registry, DefaultPhysicsConfig, createSeededRng(1)),
    ).not.toThrow();
  });

  it("has 13 components", () => {
    const g = new CircuitGraph(adderCircuit, registry, DefaultPhysicsConfig, createSeededRng(1));
    let count = 0;
    for (const _ of g.getAllComponents()) count++;
    expect(count).toBe(13);
  });

  it("carry chain propagates: fa0.cout drives fa1.cin", () => {
    const g = new CircuitGraph(adderCircuit, registry, DefaultPhysicsConfig, createSeededRng(1));
    const fa0 = g.getComponent("fa0");
    const fa1 = g.getComponent("fa1");
    const fa0cout = fa0.outputs.get("cout");
    const fa1cin = fa1.inputs.get("cin");
    expect(fa0cout).toBeDefined();
    expect(fa1cin).toBeDefined();
    if (!fa0cout || !fa1cin) return;
    fa0cout.voltage = 2.0;
    g.propagate();
    expect(fa1cin.voltage).toBe(2.0);
  });

  it("fa0 computes 1+0+0 correctly (cin is undriven, defaults to 0V)", () => {
    const g = new CircuitGraph(adderCircuit, registry, DefaultPhysicsConfig, createSeededRng(1));
    const { logicHighMin, outputHighMax } = DefaultPhysicsConfig.voltage;
    const fa0 = g.getComponent("fa0");
    const fa0a = fa0.inputs.get("a");
    const fa0b = fa0.inputs.get("b");
    const fa0sum = fa0.outputs.get("sum");
    const fa0cout = fa0.outputs.get("cout");
    expect(fa0a).toBeDefined();
    expect(fa0b).toBeDefined();
    expect(fa0sum).toBeDefined();
    expect(fa0cout).toBeDefined();
    if (!fa0a || !fa0b || !fa0sum || !fa0cout) return;
    fa0a.voltage = outputHighMax;
    fa0b.voltage = 0.0;
    g.evaluateCombinational();
    expect(fa0sum.voltage).toBeGreaterThan(logicHighMin);
    expect(fa0cout.voltage).toBeLessThan(logicHighMin);
  });
});
