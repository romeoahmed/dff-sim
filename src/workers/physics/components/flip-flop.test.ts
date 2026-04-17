import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { Port } from "@/lib/types";
import { DFlipFlop } from "./flip-flop";

function createDFF(seed: number = 42) {
  return new DFlipFlop("dff0", {}, { config: DefaultPhysicsConfig, rng: createSeededRng(seed) });
}

function getPorts(dff: DFlipFlop): { d: Port; clk: Port; q: Port } {
  const d = dff.inputs.get("d");
  const clk = dff.inputs.get("clk");
  const q = dff.outputs.get("q");
  if (!d || !clk || !q) throw new Error("DFlipFlop port missing in test fixture");
  return { d, clk, q };
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
    const { d, clk, q } = getPorts(dff);
    d.voltage = 2.0;
    clk.voltage = 0.0;
    dff.clock(0.0001);
    clk.voltage = 2.0;
    dff.clock(0.0001);
    for (let i = 0; i < 3000; i++) dff.update(0.0001);
    expect(q.voltage).toBeGreaterThan(1.0);
  });

  it("captures D=LOW on CLK rising edge", () => {
    const dff = createDFF();
    const { d, clk, q } = getPorts(dff);
    d.voltage = 0.0;
    clk.voltage = 0.0;
    dff.clock(0.0001);
    clk.voltage = 2.0;
    dff.clock(0.0001);
    for (let i = 0; i < 3000; i++) dff.update(0.0001);
    expect(q.voltage).toBeLessThan(0.6);
  });

  it("ignores D changes on CLK falling edge", () => {
    const dff = createDFF();
    const { d, clk, q } = getPorts(dff);
    d.voltage = 0.0;
    clk.voltage = 0.0;
    dff.clock(0.0001);
    clk.voltage = 2.0;
    dff.clock(0.0001);
    for (let i = 0; i < 3000; i++) dff.update(0.0001);

    d.voltage = 2.0;
    clk.voltage = 0.0;
    dff.clock(0.0001);
    for (let i = 0; i < 3000; i++) dff.update(0.0001);
    expect(q.voltage).toBeLessThan(0.6);
  });

  it("Schmitt trigger: holds state in hysteresis band", () => {
    const dff = createDFF();
    const { d, clk, q } = getPorts(dff);
    d.voltage = 2.0;
    clk.voltage = 0.0;
    dff.clock(0.0001);
    clk.voltage = 0.8;
    dff.clock(0.0001);
    for (let i = 0; i < 3000; i++) dff.update(0.0001);
    expect(q.voltage).toBeLessThan(1.0);
  });

  it("metastability: D in undefined zone produces ~50/50 output over many trials", () => {
    let highCount = 0;
    const trials = 200;

    for (let seed = 0; seed < trials; seed++) {
      const dff = createDFF(seed);
      const { d, clk, q } = getPorts(dff);
      d.voltage = 0.8;
      clk.voltage = 0.0;
      dff.clock(0.0001);
      clk.voltage = 2.0;
      dff.clock(0.0001);
      for (let i = 0; i < 10000; i++) dff.update(0.0001);
      if (q.voltage > 1.0) highCount++;
    }

    const ratio = highCount / trials;
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(0.7);
  });

  it("async reset drives Q low", () => {
    const dff = createDFF();
    const { d, clk, q } = getPorts(dff);
    d.voltage = 2.0;
    clk.voltage = 0.0;
    dff.clock(0.0001);
    clk.voltage = 2.0;
    dff.clock(0.0001);
    for (let i = 0; i < 3000; i++) dff.update(0.0001);
    expect(q.voltage).toBeGreaterThan(1.0);

    dff.setReset(true);
    for (let i = 0; i < 3000; i++) {
      dff.clock(0.0001);
      dff.update(0.0001);
    }
    expect(q.voltage).toBeLessThan(0.6);
  });
});

describe("DFlipFlop metastability (biased)", () => {
  const { logicHighMin, logicLowMax } = DefaultPhysicsConfig.voltage;
  const vMid = (logicHighMin + logicLowMax) / 2;
  const band = logicHighMin - logicLowMax;
  const dt = DefaultPhysicsConfig.simulation.physicsDt;
  const tauMeta = DefaultPhysicsConfig.timing.tauMeta;

  function runTrial(seed: number, dVoltage: number): 0 | 1 {
    const dff = new DFlipFlop(
      "dff0",
      {},
      {
        config: DefaultPhysicsConfig,
        rng: createSeededRng(seed),
      },
    );
    const dPort = dff.inputs.get("d");
    const clkPort = dff.inputs.get("clk");
    const qPort = dff.outputs.get("q");
    if (!dPort || !clkPort || !qPort) throw new Error("DFF port missing");
    dPort.voltage = dVoltage;
    clkPort.voltage = DefaultPhysicsConfig.voltage.outputHighMax;
    dff.clock(dt);
    for (let i = 0; i < 1000; i++) dff.update(dt);
    return qPort.voltage > vMid ? 1 : 0;
  }

  it("D clearly HIGH in band resolves to HIGH in most trials", () => {
    const trials = 200;
    let highs = 0;
    const dHigh = vMid + 0.5 * band;
    for (let s = 0; s < trials; s++) {
      if (runTrial(s, dHigh) === 1) highs++;
    }
    expect(highs / trials).toBeGreaterThan(0.8);
  });

  it("D clearly LOW in band resolves to LOW in most trials", () => {
    const trials = 200;
    let lows = 0;
    const dLow = vMid - 0.5 * band;
    for (let s = 0; s < trials; s++) {
      if (runTrial(s, dLow) === 0) lows++;
    }
    expect(lows / trials).toBeGreaterThan(0.8);
  });

  it("D exactly at mid resolves roughly 50/50", () => {
    const trials = 400;
    let highs = 0;
    for (let s = 0; s < trials; s++) {
      if (runTrial(s, vMid) === 1) highs++;
    }
    const ratio = highs / trials;
    expect(ratio).toBeGreaterThan(0.35);
    expect(ratio).toBeLessThan(0.65);
  });

  it("during metastable interval Q voltage hovers at mid", () => {
    const dff = new DFlipFlop(
      "dff0",
      {},
      {
        config: DefaultPhysicsConfig,
        rng: createSeededRng(12345),
      },
    );
    const dPort = dff.inputs.get("d");
    const clkPort = dff.inputs.get("clk");
    const qPort = dff.outputs.get("q");
    if (!dPort || !clkPort || !qPort) throw new Error("DFF port missing");
    dPort.voltage = vMid;
    clkPort.voltage = DefaultPhysicsConfig.voltage.outputHighMax;
    dff.clock(dt);
    const shortTime = tauMeta * 0.1;
    const steps = Math.max(1, Math.floor(shortTime / dt));
    // Average the voltage over the window: metastable Q now carries its full noise floor,
    // so point-sample deviation can exceed 0.05 V. The mean stays close to vMid.
    let sum = 0;
    for (let i = 0; i < steps; i++) {
      dff.update(dt);
      sum += qPort.voltage;
    }
    const mean = sum / steps;
    expect(Math.abs(mean - vMid)).toBeLessThan(0.08);
  });

  it("after metaResolveTime Q settles to a rail", () => {
    const dff = new DFlipFlop(
      "dff0",
      {},
      {
        config: DefaultPhysicsConfig,
        rng: createSeededRng(99),
      },
    );
    const dPort = dff.inputs.get("d");
    const clkPort = dff.inputs.get("clk");
    const qPort = dff.outputs.get("q");
    if (!dPort || !clkPort || !qPort) throw new Error("DFF port missing");
    dPort.voltage = vMid;
    clkPort.voltage = DefaultPhysicsConfig.voltage.outputHighMax;
    dff.clock(dt);
    for (let i = 0; i < 10_000; i++) dff.update(dt);
    const settled = qPort.voltage > logicHighMin || qPort.voltage < logicLowMax;
    expect(settled).toBe(true);
  });
});
