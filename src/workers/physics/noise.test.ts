import { describe, expect, it } from "vitest";
import { NoiseGenerator } from "./noise";
import { createSeededRng } from "@/lib/rng";

describe("NoiseGenerator", () => {
  it("produces deterministic output with seeded RNG", () => {
    const a = new NoiseGenerator(createSeededRng(42), 0.1);
    const b = new NoiseGenerator(createSeededRng(42), 0.1);
    for (let i = 0; i < 100; i++) {
      expect(a.sample()).toBe(b.sample());
    }
  });

  it("white noise has approximately zero mean", () => {
    const gen = new NoiseGenerator(createSeededRng(99), 0.5);
    let sum = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) {
      sum += gen.sample();
    }
    const mean = sum / N;
    expect(Math.abs(mean)).toBeLessThan(0.1);
  });

  it("noise scales with sigma", () => {
    const small = new NoiseGenerator(createSeededRng(1), 0.01);
    const large = new NoiseGenerator(createSeededRng(1), 1.0);

    let sumSmall = 0;
    let sumLarge = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) {
      sumSmall += small.sample() ** 2;
      sumLarge += large.sample() ** 2;
    }
    expect(sumLarge / N).toBeGreaterThan((sumSmall / N) * 10);
  });

  it("setSigma changes noise amplitude", () => {
    const gen = new NoiseGenerator(createSeededRng(7), 0.0);
    let sum = 0;
    for (let i = 0; i < 100; i++) {
      sum += Math.abs(gen.sample());
    }
    expect(sum / 100).toBeLessThan(0.01);

    gen.setSigma(1.0);
    sum = 0;
    for (let i = 0; i < 100; i++) {
      sum += Math.abs(gen.sample());
    }
    expect(sum / 100).toBeGreaterThan(0.1);
  });
});
