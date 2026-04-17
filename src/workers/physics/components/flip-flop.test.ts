import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import { DFlipFlop } from "./flip-flop";

function createDFF(seed: number = 42) {
  return new DFlipFlop("dff0", {}, { config: DefaultPhysicsConfig, rng: createSeededRng(seed) });
}

describe("DFlipFlop", () => {
  it("has d, clk input ports and q output port", () => {
    const dff = createDFF();
    expect(dff.inputs.has("d")).toBe(true);
    expect(dff.inputs.has("clk")).toBe(true);
    expect(dff.outputs.has("q")).toBe(true);
    expect(dff.kind).toBe("sequential");
  });

  it("captures D=HIGH on CLK rising edge", () => {
    const dff = createDFF();
    dff.inputs.get("d")!.voltage = 2.0;
    dff.inputs.get("clk")!.voltage = 0.0;
    dff.clock(0.0001);
    dff.inputs.get("clk")!.voltage = 2.0;
    dff.clock(0.0001);
    for (let i = 0; i < 3000; i++) dff.update(0.0001);
    expect(dff.outputs.get("q")!.voltage).toBeGreaterThan(1.0);
  });

  it("captures D=LOW on CLK rising edge", () => {
    const dff = createDFF();
    dff.inputs.get("d")!.voltage = 0.0;
    dff.inputs.get("clk")!.voltage = 0.0;
    dff.clock(0.0001);
    dff.inputs.get("clk")!.voltage = 2.0;
    dff.clock(0.0001);
    for (let i = 0; i < 3000; i++) dff.update(0.0001);
    expect(dff.outputs.get("q")!.voltage).toBeLessThan(0.6);
  });

  it("ignores D changes on CLK falling edge", () => {
    const dff = createDFF();
    dff.inputs.get("d")!.voltage = 0.0;
    dff.inputs.get("clk")!.voltage = 0.0;
    dff.clock(0.0001);
    dff.inputs.get("clk")!.voltage = 2.0;
    dff.clock(0.0001);
    for (let i = 0; i < 3000; i++) dff.update(0.0001);

    dff.inputs.get("d")!.voltage = 2.0;
    dff.inputs.get("clk")!.voltage = 0.0;
    dff.clock(0.0001);
    for (let i = 0; i < 3000; i++) dff.update(0.0001);
    expect(dff.outputs.get("q")!.voltage).toBeLessThan(0.6);
  });

  it("Schmitt trigger: holds state in hysteresis band", () => {
    const dff = createDFF();
    dff.inputs.get("d")!.voltage = 2.0;
    dff.inputs.get("clk")!.voltage = 0.0;
    dff.clock(0.0001);
    dff.inputs.get("clk")!.voltage = 0.8;
    dff.clock(0.0001);
    for (let i = 0; i < 3000; i++) dff.update(0.0001);
    expect(dff.outputs.get("q")!.voltage).toBeLessThan(1.0);
  });

  it("metastability: D in undefined zone produces ~50/50 output over many trials", () => {
    let highCount = 0;
    const trials = 200;

    for (let seed = 0; seed < trials; seed++) {
      const dff = createDFF(seed);
      dff.inputs.get("d")!.voltage = 0.8;
      dff.inputs.get("clk")!.voltage = 0.0;
      dff.clock(0.0001);
      dff.inputs.get("clk")!.voltage = 2.0;
      dff.clock(0.0001);
      for (let i = 0; i < 10000; i++) dff.update(0.0001);
      if (dff.outputs.get("q")!.voltage > 1.0) highCount++;
    }

    const ratio = highCount / trials;
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(0.7);
  });

  it("async reset drives Q low", () => {
    const dff = createDFF();
    dff.inputs.get("d")!.voltage = 2.0;
    dff.inputs.get("clk")!.voltage = 0.0;
    dff.clock(0.0001);
    dff.inputs.get("clk")!.voltage = 2.0;
    dff.clock(0.0001);
    for (let i = 0; i < 3000; i++) dff.update(0.0001);
    expect(dff.outputs.get("q")!.voltage).toBeGreaterThan(1.0);

    dff.setReset(true);
    for (let i = 0; i < 3000; i++) {
      dff.clock(0.0001);
      dff.update(0.0001);
    }
    expect(dff.outputs.get("q")!.voltage).toBeLessThan(0.6);
  });
});
