import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { Port } from "@/lib/types";
import { settle } from "../test-helpers";
import { ANDGate } from "./and-gate";

const deps = { config: DefaultPhysicsConfig, rng: createSeededRng(1) };
const { logicHighMin, outputHighMax } = DefaultPhysicsConfig.voltage;
const dt = DefaultPhysicsConfig.simulation.physicsDt;
const settleTime = DefaultPhysicsConfig.gates.tPD * 20;

function makeAnd(): { gate: ANDGate; a: Port; b: Port; out: Port } {
  const gate = new ANDGate("and0", {}, deps);
  const a = gate.inputs.get("a");
  const b = gate.inputs.get("b");
  const out = gate.outputs.get("out");
  if (!a || !b || !out) throw new Error("AND gate port missing");
  return { gate, a, b, out };
}

describe("ANDGate", () => {
  it("0 AND 0 = 0 after settling", () => {
    const { gate, a, b, out } = makeAnd();
    a.voltage = 0.0;
    b.voltage = 0.0;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin);
  });

  it("1 AND 0 = 0 after settling", () => {
    const { gate, a, b, out } = makeAnd();
    a.voltage = outputHighMax;
    b.voltage = 0.0;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin);
  });

  it("0 AND 1 = 0 after settling", () => {
    const { gate, a, b, out } = makeAnd();
    a.voltage = 0.0;
    b.voltage = outputHighMax;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin);
  });

  it("1 AND 1 = 1 after settling", () => {
    const { gate, a, b, out } = makeAnd();
    a.voltage = outputHighMax;
    b.voltage = outputHighMax;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });
});
