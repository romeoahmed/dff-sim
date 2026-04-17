import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/lib/rng";
import { createGaussianSampler } from "./gaussian";

describe("createGaussianSampler", () => {
  it("returns a function that produces finite numbers", () => {
    const sample = createGaussianSampler(createSeededRng(42));
    for (let i = 0; i < 100; i++) {
      const v = sample();
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("produces zero-mean samples with unit variance (loose tolerance)", () => {
    const sample = createGaussianSampler(createSeededRng(7));
    let sum = 0;
    let sumSq = 0;
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      const v = sample();
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(variance - 1)).toBeLessThan(0.1);
  });

  it("two independent samplers with the same seed produce the same sequence", () => {
    const a = createGaussianSampler(createSeededRng(1234));
    const b = createGaussianSampler(createSeededRng(1234));
    for (let i = 0; i < 20; i++) {
      expect(a()).toBeCloseTo(b(), 10);
    }
  });
});
