import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import { SignalSource } from "./signal-source";

describe("SignalSource", () => {
  it("converges to baseHigh when targetLogic is 1", () => {
    const src = new SignalSource(
      "d",
      { baseHigh: 1.5, baseLow: 0.1 },
      { config: DefaultPhysicsConfig, rng: createSeededRng(1) },
    );
    src.setTargetLogic(1);
    for (let i = 0; i < 5000; i++) {
      src.update(0.0001);
    }
    expect(src.outputs.get("out")!.voltage).toBeCloseTo(1.5, 0);
  });

  it("converges to baseLow when targetLogic is 0", () => {
    const src = new SignalSource(
      "d",
      { baseHigh: 1.5, baseLow: 0.1 },
      { config: DefaultPhysicsConfig, rng: createSeededRng(1) },
    );
    src.setTargetLogic(0);
    for (let i = 0; i < 5000; i++) {
      src.update(0.0001);
    }
    expect(src.outputs.get("out")!.voltage).toBeCloseTo(0.1, 0);
  });

  it("has output port named 'out'", () => {
    const src = new SignalSource(
      "d",
      {},
      { config: DefaultPhysicsConfig, rng: createSeededRng(1) },
    );
    expect(src.outputs.has("out")).toBe(true);
    expect(src.kind).toBe("sequential");
  });

  it("setTargetLogic coerces booleans", () => {
    const src = new SignalSource(
      "d",
      { baseHigh: 1.5, baseLow: 0.1 },
      { config: DefaultPhysicsConfig, rng: createSeededRng(1) },
    );
    src.setTargetLogic(true);
    for (let i = 0; i < 5000; i++) src.update(0.0001);
    expect(src.outputs.get("out")!.voltage).toBeCloseTo(1.5, 0);
    src.setTargetLogic(false);
    for (let i = 0; i < 5000; i++) src.update(0.0001);
    expect(src.outputs.get("out")!.voltage).toBeCloseTo(0.1, 0);
  });

  it("setNoise adjusts noise amplitude", () => {
    const src = new SignalSource(
      "d",
      {},
      { config: DefaultPhysicsConfig, rng: createSeededRng(1) },
    );
    src.setNoise(0);
    const samples: number[] = [];
    for (let i = 0; i < 1000; i++) {
      src.update(0.0001);
      samples.push(src.outputs.get("out")!.voltage);
    }
    const late = samples.slice(-100);
    const mean = late.reduce((a, b) => a + b, 0) / late.length;
    const variance = late.reduce((a, b) => a + (b - mean) ** 2, 0) / late.length;
    expect(variance).toBeLessThan(0.01);
  });
});
