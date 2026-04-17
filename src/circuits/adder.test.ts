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
});
