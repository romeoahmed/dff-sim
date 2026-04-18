import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { Port } from "@/lib/types";
import { settle } from "../test-helpers";
import { NOTGate } from "./not-gate";

const deps = { config: DefaultPhysicsConfig, rng: createSeededRng(4) };
const { logicHighMin, outputHighMax } = DefaultPhysicsConfig.voltage;
const dt = DefaultPhysicsConfig.simulation.physicsDt;
const settleTime = DefaultPhysicsConfig.gates.tPD * 20;

function makeNot(): { gate: NOTGate; inp: Port; out: Port } {
  const gate = new NOTGate("not0", {}, deps);
  const inp = gate.inputs.get("in");
  const out = gate.outputs.get("out");
  if (!inp || !out) throw new Error("NOT gate port missing");
  return { gate, inp, out };
}

describe("NOTGate", () => {
  it("NOT 0 = 1", () => {
    const { gate, inp, out } = makeNot();
    inp.voltage = 0;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });
  it("NOT 1 = 0", () => {
    const { gate, inp, out } = makeNot();
    inp.voltage = outputHighMax;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin);
  });
});
