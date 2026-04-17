import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import type { Port } from "@/lib/types";
import { ANDGate } from "./and-gate";

const deps = { config: DefaultPhysicsConfig, rng: Math.random };
const { logicHighMin, outputHighMax } = DefaultPhysicsConfig.voltage;

function makeAnd(): { gate: ANDGate; a: Port; b: Port; out: Port } {
  const gate = new ANDGate("and0", {}, deps);
  const a = gate.inputs.get("a");
  const b = gate.inputs.get("b");
  const out = gate.outputs.get("out");
  if (!a || !b || !out) throw new Error("AND gate port missing");
  return { gate, a, b, out };
}

describe("ANDGate", () => {
  it("has a, b input ports, out output port, and kind combinational", () => {
    const { gate } = makeAnd();
    expect(gate.inputs.has("a")).toBe(true);
    expect(gate.inputs.has("b")).toBe(true);
    expect(gate.outputs.has("out")).toBe(true);
    expect(gate.kind).toBe("combinational");
  });

  it("0 AND 0 = 0", () => {
    const { gate, a, b, out } = makeAnd();
    a.voltage = 0.0;
    b.voltage = 0.0;
    gate.evaluate();
    expect(out.voltage).toBeLessThan(logicHighMin);
  });

  it("1 AND 0 = 0", () => {
    const { gate, a, b, out } = makeAnd();
    a.voltage = outputHighMax;
    b.voltage = 0.0;
    gate.evaluate();
    expect(out.voltage).toBeLessThan(logicHighMin);
  });

  it("0 AND 1 = 0", () => {
    const { gate, a, b, out } = makeAnd();
    a.voltage = 0.0;
    b.voltage = outputHighMax;
    gate.evaluate();
    expect(out.voltage).toBeLessThan(logicHighMin);
  });

  it("1 AND 1 = 1", () => {
    const { gate, a, b, out } = makeAnd();
    a.voltage = outputHighMax;
    b.voltage = outputHighMax;
    gate.evaluate();
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });
});
