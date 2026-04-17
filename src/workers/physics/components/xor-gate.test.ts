import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import type { Port } from "@/lib/types";
import { XORGate } from "./xor-gate";

const deps = { config: DefaultPhysicsConfig, rng: Math.random };
const { logicHighMin, outputHighMax } = DefaultPhysicsConfig.voltage;

function makeXor(): { gate: XORGate; a: Port; b: Port; out: Port } {
  const gate = new XORGate("xor0", {}, deps);
  const a = gate.inputs.get("a");
  const b = gate.inputs.get("b");
  const out = gate.outputs.get("out");
  if (!a || !b || !out) throw new Error("XOR gate port missing");
  return { gate, a, b, out };
}

describe("XORGate", () => {
  it("has a, b input ports, out output port, and kind combinational", () => {
    const { gate } = makeXor();
    expect(gate.inputs.has("a")).toBe(true);
    expect(gate.inputs.has("b")).toBe(true);
    expect(gate.outputs.has("out")).toBe(true);
    expect(gate.kind).toBe("combinational");
  });

  it("0 XOR 0 = 0", () => {
    const { gate, a, b, out } = makeXor();
    a.voltage = 0.0;
    b.voltage = 0.0;
    gate.evaluate();
    expect(out.voltage).toBeLessThan(logicHighMin);
  });

  it("1 XOR 0 = 1", () => {
    const { gate, a, b, out } = makeXor();
    a.voltage = outputHighMax;
    b.voltage = 0.0;
    gate.evaluate();
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });

  it("0 XOR 1 = 1", () => {
    const { gate, a, b, out } = makeXor();
    a.voltage = 0.0;
    b.voltage = outputHighMax;
    gate.evaluate();
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });

  it("1 XOR 1 = 0", () => {
    const { gate, a, b, out } = makeXor();
    a.voltage = outputHighMax;
    b.voltage = outputHighMax;
    gate.evaluate();
    expect(out.voltage).toBeLessThan(logicHighMin);
  });
});
