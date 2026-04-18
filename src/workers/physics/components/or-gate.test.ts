import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { Port } from "@/lib/types";
import { settle } from "../test-helpers";
import { ORGate } from "./or-gate";

const deps = { config: DefaultPhysicsConfig, rng: createSeededRng(2) };
const { logicHighMin, outputHighMax } = DefaultPhysicsConfig.voltage;
const dt = DefaultPhysicsConfig.simulation.physicsDt;
const settleTime = DefaultPhysicsConfig.gates.tPD * 20;

function makeOr(): { gate: ORGate; a: Port; b: Port; out: Port } {
  const gate = new ORGate("or0", {}, deps);
  const a = gate.inputs.get("a");
  const b = gate.inputs.get("b");
  const out = gate.outputs.get("out");
  if (!a || !b || !out) throw new Error("OR gate port missing");
  return { gate, a, b, out };
}

describe("ORGate", () => {
  it("0 OR 0 = 0", () => {
    const { gate, a, b, out } = makeOr();
    a.voltage = 0;
    b.voltage = 0;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin);
  });
  it("1 OR 0 = 1", () => {
    const { gate, a, b, out } = makeOr();
    a.voltage = outputHighMax;
    b.voltage = 0;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });
  it("0 OR 1 = 1", () => {
    const { gate, a, b, out } = makeOr();
    a.voltage = 0;
    b.voltage = outputHighMax;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });
  it("1 OR 1 = 1", () => {
    const { gate, a, b, out } = makeOr();
    a.voltage = outputHighMax;
    b.voltage = outputHighMax;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });
});
