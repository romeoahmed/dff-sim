import { describe, expect, it } from "vitest";
import { Signal } from "./signal";
import { NoiseGenerator } from "./noise";
import { createSeededRng } from "@/lib/rng";
import type { SignalConfig } from "@/lib/types";

const BASE_CONFIG: SignalConfig = {
  baseHigh: 2.0,
  baseLow: 0.0,
  zeta: 0.6,
  ringFreq: 100,
  clampMin: -0.5,
  clampMax: 2.5,
};

function createZeroNoise(): NoiseGenerator {
  return new NoiseGenerator(createSeededRng(0), 0);
}

describe("Signal", () => {
  it("converges to baseHigh when targetLogic is 1 (no noise)", () => {
    const sig = new Signal(BASE_CONFIG, createZeroNoise());
    sig.targetLogic = 1;
    const dt = 0.0001;
    for (let i = 0; i < 5000; i++) {
      sig.update(dt);
    }
    expect(sig.voltage).toBeCloseTo(2.0, 1);
  });

  it("converges to baseLow when targetLogic is 0 (no noise)", () => {
    const sig = new Signal(BASE_CONFIG, createZeroNoise());
    sig.targetLogic = 1;
    for (let i = 0; i < 5000; i++) sig.update(0.0001);
    sig.targetLogic = 0;
    for (let i = 0; i < 5000; i++) sig.update(0.0001);
    expect(sig.voltage).toBeCloseTo(0.0, 1);
  });

  it("exhibits overshoot for underdamped system (zeta=0.6)", () => {
    const sig = new Signal(BASE_CONFIG, createZeroNoise());
    sig.targetLogic = 1;
    const dt = 0.0001;
    let maxVoltage = 0;
    for (let i = 0; i < 2000; i++) {
      sig.update(dt);
      if (sig.voltage > maxVoltage) maxVoltage = sig.voltage;
    }
    expect(maxVoltage).toBeGreaterThan(BASE_CONFIG.baseHigh);
    expect(maxVoltage).toBeLessThan(BASE_CONFIG.baseHigh * 1.20);
  });

  it("clamps voltage within bounds", () => {
    const sig = new Signal(BASE_CONFIG, createZeroNoise());
    sig.targetLogic = 1;
    for (let i = 0; i < 10000; i++) sig.update(0.0001);
    expect(sig.voltage).toBeLessThanOrEqual(BASE_CONFIG.clampMax);
    expect(sig.voltage).toBeGreaterThanOrEqual(BASE_CONFIG.clampMin);
  });

  it("is frame-rate independent (same result at different dt)", () => {
    const configHigh: SignalConfig = { ...BASE_CONFIG, zeta: 0.9 };

    const fast = new Signal(configHigh, createZeroNoise());
    const slow = new Signal(configHigh, createZeroNoise());

    fast.targetLogic = 1;
    slow.targetLogic = 1;

    for (let i = 0; i < 10000; i++) fast.update(0.0001);
    for (let i = 0; i < 2000; i++) slow.update(0.0005);

    expect(fast.voltage).toBeCloseTo(slow.voltage, 0);
  });
});
