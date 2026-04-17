import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import { settle } from "../test-helpers";
import { ANDGate } from "./and-gate";
import { NOTGate } from "./not-gate";
import { ORGate } from "./or-gate";
import { XORGate } from "./xor-gate";

const deps = { config: DefaultPhysicsConfig, rng: createSeededRng(1) };
const { logicHighMin, logicLowMax, outputHighMax } = DefaultPhysicsConfig.voltage;
const dt = DefaultPhysicsConfig.simulation.physicsDt;
const settleTime = DefaultPhysicsConfig.gates.tPD * 20;

describe("gate Schmitt hysteresis", () => {
  it("AND gate: input lingering in dead-band holds last logic value (no chatter)", () => {
    const gate = new ANDGate("and", {}, deps);
    const a = gate.inputs.get("a");
    const b = gate.inputs.get("b");
    const out = gate.outputs.get("out");
    if (!a || !b || !out) throw new Error("port missing");

    // Settle HIGH first
    a.voltage = outputHighMax;
    b.voltage = outputHighMax;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);

    // Drop A into the dead-band; hysteresis should keep logic HIGH
    const midVoltage = (logicHighMin + logicLowMax) / 2;
    a.voltage = midVoltage;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);

    // Push A fully LOW; output should now go LOW
    a.voltage = logicLowMax - 0.1;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin);
  });

  it("OR gate: same hysteresis behavior", () => {
    const gate = new ORGate("or", {}, deps);
    const a = gate.inputs.get("a");
    const b = gate.inputs.get("b");
    const out = gate.outputs.get("out");
    if (!a || !b || !out) throw new Error("port missing");

    a.voltage = 0;
    b.voltage = 0;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin);

    // Raise A into dead-band; should stay LOW
    a.voltage = (logicHighMin + logicLowMax) / 2;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin);

    // Push A HIGH; output should go HIGH
    a.voltage = outputHighMax;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });

  it("NOT gate: hysteresis on single input", () => {
    const gate = new NOTGate("not", {}, deps);
    const inp = gate.inputs.get("in");
    const out = gate.outputs.get("out");
    if (!inp || !out) throw new Error("port missing");

    inp.voltage = 0;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin); // NOT 0 = 1

    inp.voltage = (logicHighMin + logicLowMax) / 2;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin); // still 1 (hysteresis)

    inp.voltage = outputHighMax;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin); // now flipped
  });

  it("XOR gate: hysteresis holds through dead-band", () => {
    const gate = new XORGate("xor", {}, deps);
    const a = gate.inputs.get("a");
    const b = gate.inputs.get("b");
    const out = gate.outputs.get("out");
    if (!a || !b || !out) throw new Error("port missing");

    a.voltage = outputHighMax;
    b.voltage = 0;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);

    b.voltage = (logicHighMin + logicLowMax) / 2; // dead-band
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin); // holds
  });
});
