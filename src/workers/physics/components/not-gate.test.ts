import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import type { Port } from "@/lib/types";
import { NOTGate } from "./not-gate";

const deps = { config: DefaultPhysicsConfig, rng: Math.random };
const { logicHighMin, outputHighMax } = DefaultPhysicsConfig.voltage;

function makeNot(): { gate: NOTGate; inp: Port; out: Port } {
  const gate = new NOTGate("not0", {}, deps);
  const inp = gate.inputs.get("in");
  const out = gate.outputs.get("out");
  if (!inp || !out) throw new Error("NOT gate port missing");
  return { gate, inp, out };
}

describe("NOTGate", () => {
  it("has in input port, out output port, and kind combinational", () => {
    const { gate } = makeNot();
    expect(gate.inputs.has("in")).toBe(true);
    expect(gate.outputs.has("out")).toBe(true);
    expect(gate.kind).toBe("combinational");
  });

  it("NOT 0 = 1", () => {
    const { gate, inp, out } = makeNot();
    inp.voltage = 0.0;
    gate.evaluate();
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });

  it("NOT 1 = 0", () => {
    const { gate, inp, out } = makeNot();
    inp.voltage = outputHighMax;
    gate.evaluate();
    expect(out.voltage).toBeLessThan(logicHighMin);
  });
});
