import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { Port } from "@/lib/types";
import { DFlipFlop } from "./flip-flop";

const dt = DefaultPhysicsConfig.simulation.physicsDt;
const { tSetup, tHold } = DefaultPhysicsConfig.timing;
const { logicHighMin, logicLowMax } = DefaultPhysicsConfig.voltage;
const vMid = (logicHighMin + logicLowMax) / 2;

function makeDFF(seed: number) {
  const dff = new DFlipFlop(
    "dff0",
    {},
    { config: DefaultPhysicsConfig, rng: createSeededRng(seed) },
  );
  const d = dff.inputs.get("d");
  const clk = dff.inputs.get("clk");
  const q = dff.outputs.get("q");
  if (!d || !clk || !q) throw new Error("port missing");
  return { dff, d, clk, q } as { dff: DFlipFlop; d: Port; clk: Port; q: Port };
}

function advanceUpdates(dff: DFlipFlop, n: number) {
  for (let i = 0; i < n; i++) dff.update(dt);
}

describe("DFlipFlop setup/hold timing", () => {
  it("setup violation near vMid: D edge inside tSetup window + D near threshold resolves ~50/50", () => {
    // Drive D cleanly LOW for a long time, then flip it to just-above-vMid shortly before
    // the clock edge. The indeterminate D voltage combined with the setup violation means the
    // resolution is dominated by noise, yielding a near-even distribution.
    const trials = 200;
    let highs = 0;
    for (let seed = 0; seed < trials; seed++) {
      const { dff, d, clk, q } = makeDFF(seed);
      d.voltage = logicLowMax - 0.1;
      advanceUpdates(dff, Math.max(1, Math.floor((tSetup * 4) / dt)));
      d.voltage = vMid + 0.02; // ambiguous D + recent edge
      advanceUpdates(dff, Math.max(1, Math.floor(tSetup / dt / 2))); // half-setup
      clk.voltage = logicHighMin + 0.2;
      dff.clock(dt);
      advanceUpdates(dff, 8000);
      if (q.voltage > vMid) highs++;
    }
    const ratio = highs / trials;
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(0.8);
  });

  it("clean capture: D steady long before CLK → deterministic HIGH", () => {
    const trials = 40;
    let highs = 0;
    for (let seed = 0; seed < trials; seed++) {
      const { dff, d, clk, q } = makeDFF(seed);
      d.voltage = logicHighMin + 0.2;
      advanceUpdates(dff, Math.max(1, Math.floor((tSetup * 4) / dt)));
      clk.voltage = logicHighMin + 0.2;
      dff.clock(dt);
      advanceUpdates(dff, 5000);
      if (q.voltage > vMid) highs++;
    }
    expect(highs / trials).toBeGreaterThan(0.9);
  });

  it("hold violation: D flips inside the hold window → metastable path", () => {
    // Clean rising edge captures D=LOW; then D flips to HIGH inside tHold. Without hold
    // tracking, Q would stay LOW. With hold tracking, metastable is entered and resolution
    // is dominated by the post-flip D value (HIGH), so many trials end HIGH.
    const trials = 60;
    let highs = 0;
    for (let seed = 0; seed < trials; seed++) {
      const { dff, d, clk, q } = makeDFF(seed);
      d.voltage = logicLowMax - 0.1;
      advanceUpdates(dff, Math.max(1, Math.floor((tSetup * 4) / dt)));
      clk.voltage = logicHighMin + 0.2;
      dff.clock(dt);
      // Flip D HIGH inside the hold window
      d.voltage = logicHighMin + 0.2;
      advanceUpdates(dff, Math.max(1, Math.floor(tHold / dt / 4)));
      advanceUpdates(dff, 8000);
      if (q.voltage > vMid) highs++;
    }
    // With hold tracking, at least some trials should end HIGH (post-flip D resolves HIGH).
    // Without hold tracking, all trials would be LOW.
    expect(highs).toBeGreaterThan(0);
  });
});
