import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { Port } from "@/lib/types";
import { settle } from "../test-helpers";
import { XORGate } from "./xor-gate";

const deps = { config: DefaultPhysicsConfig, rng: createSeededRng(3) };
const { logicHighMin, outputHighMax } = DefaultPhysicsConfig.voltage;
const dt = DefaultPhysicsConfig.simulation.physicsDt;
const settleTime = DefaultPhysicsConfig.gates.tPD * 20;

function makeXor(): { gate: XORGate; a: Port; b: Port; out: Port } {
  const gate = new XORGate("xor0", {}, deps);
  const a = gate.inputs.get("a");
  const b = gate.inputs.get("b");
  const out = gate.outputs.get("out");
  if (!a || !b || !out) throw new Error("XOR gate port missing");
  return { gate, a, b, out };
}

describe("XORGate", () => {
  it("0 XOR 0 = 0", () => {
    const { gate, a, b, out } = makeXor();
    a.voltage = 0;
    b.voltage = 0;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin);
  });
  it("1 XOR 0 = 1", () => {
    const { gate, a, b, out } = makeXor();
    a.voltage = outputHighMax;
    b.voltage = 0;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });
  it("0 XOR 1 = 1", () => {
    const { gate, a, b, out } = makeXor();
    a.voltage = 0;
    b.voltage = outputHighMax;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });
  it("1 XOR 1 = 0", () => {
    const { gate, a, b, out } = makeXor();
    a.voltage = outputHighMax;
    b.voltage = outputHighMax;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin);
  });
});
