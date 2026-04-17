import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import type { Port } from "@/lib/types";
import { ORGate } from "./or-gate";

const deps = { config: DefaultPhysicsConfig, rng: Math.random };
const { logicHighMin, outputHighMax } = DefaultPhysicsConfig.voltage;

function makeOr(): { gate: ORGate; a: Port; b: Port; out: Port } {
  const gate = new ORGate("or0", {}, deps);
  const a = gate.inputs.get("a");
  const b = gate.inputs.get("b");
  const out = gate.outputs.get("out");
  if (!a || !b || !out) throw new Error("OR gate port missing");
  return { gate, a, b, out };
}

describe("ORGate", () => {
  it("has a, b input ports, out output port, and kind combinational", () => {
    const { gate } = makeOr();
    expect(gate.inputs.has("a")).toBe(true);
    expect(gate.inputs.has("b")).toBe(true);
    expect(gate.outputs.has("out")).toBe(true);
    expect(gate.kind).toBe("combinational");
  });

  it("0 OR 0 = 0", () => {
    const { gate, a, b, out } = makeOr();
    a.voltage = 0.0;
    b.voltage = 0.0;
    gate.evaluate();
    expect(out.voltage).toBeLessThan(logicHighMin);
  });

  it("1 OR 0 = 1", () => {
    const { gate, a, b, out } = makeOr();
    a.voltage = outputHighMax;
    b.voltage = 0.0;
    gate.evaluate();
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });

  it("0 OR 1 = 1", () => {
    const { gate, a, b, out } = makeOr();
    a.voltage = 0.0;
    b.voltage = outputHighMax;
    gate.evaluate();
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });

  it("1 OR 1 = 1", () => {
    const { gate, a, b, out } = makeOr();
    a.voltage = outputHighMax;
    b.voltage = outputHighMax;
    gate.evaluate();
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });
});
