import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import { AnalogOutput, mergeGateParams } from "./analog-output";

function makeOutput() {
  const cfg = mergeGateParams(DefaultPhysicsConfig, {});
  return new AnalogOutput(cfg, createSeededRng(1));
}

describe("AnalogOutput", () => {
  it("starts at rest near baseLow", () => {
    const out = makeOutput();
    expect(out.voltage).toBeLessThan(DefaultPhysicsConfig.voltage.logicHighMin);
  });

  it("set(1) schedules a pending target; voltage does not change immediately", () => {
    const out = makeOutput();
    const before = out.voltage;
    out.set(1);
    expect(out.voltage).toBe(before);
  });

  it("after tPD of update() the Signal starts slewing toward HIGH", () => {
    const out = makeOutput();
    out.set(1);
    const dt = DefaultPhysicsConfig.simulation.physicsDt;
    for (let i = 0; i < 100; i++) out.update(dt);
    const mid =
      (DefaultPhysicsConfig.voltage.logicHighMin + DefaultPhysicsConfig.voltage.logicLowMax) / 2;
    expect(out.voltage).toBeGreaterThan(mid);
  });

  it("after enough update() calls the Signal settles above logicHighMin", () => {
    const out = makeOutput();
    out.set(1);
    const dt = DefaultPhysicsConfig.simulation.physicsDt;
    for (let i = 0; i < 1000; i++) out.update(dt);
    expect(out.voltage).toBeGreaterThan(DefaultPhysicsConfig.voltage.logicHighMin);
  });

  it("calling set(x) with the current target is a no-op", () => {
    const out = makeOutput();
    out.set(0);
    const before = out.voltage;
    out.set(0);
    expect(out.voltage).toBe(before);
  });

  it("snapTo(1) bypasses tPD and slew; voltage jumps to baseHigh", () => {
    const cfg = mergeGateParams(DefaultPhysicsConfig, {});
    const out = new AnalogOutput(cfg, createSeededRng(99));
    out.snapTo(1, cfg);
    expect(out.voltage).toBeCloseTo(cfg.baseHigh, 5);
  });

  it("mergeGateParams lets per-instance params override defaults", () => {
    const cfg = mergeGateParams(DefaultPhysicsConfig, { tPD: 0.005, zeta: 0.7 });
    expect(cfg.tPD).toBe(0.005);
    expect(cfg.zeta).toBe(0.7);
    expect(cfg.ringFreq).toBe(DefaultPhysicsConfig.gates.ringFreq);
  });

  it("mergeGateParams ignores unknown params", () => {
    const cfg = mergeGateParams(DefaultPhysicsConfig, { banana: 42 });
    expect(cfg.tPD).toBe(DefaultPhysicsConfig.gates.tPD);
  });
});
