import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import { ClockSource } from "./clock-source";

describe("ClockSource", () => {
  it("produces a periodic signal", () => {
    const clk = new ClockSource(
      "clk",
      { speed: 50 },
      { config: DefaultPhysicsConfig, rng: createSeededRng(1) },
    );
    const dt = 0.0001;
    let transitions = 0;
    let lastLogic = -1;

    for (let i = 0; i < 50000; i++) {
      clk.update(dt);
      clk.clock(dt);
      const logic = clk.outputs.get("out")!.voltage > 1.0 ? 1 : 0;
      if (lastLogic >= 0 && logic !== lastLogic) transitions++;
      lastLogic = logic;
    }
    expect(transitions).toBeGreaterThan(4);
  });

  it("jitter affects edge timing (non-zero jitterRms)", () => {
    const clk = new ClockSource(
      "clk",
      { speed: 50, jitterRms: 0.05 },
      { config: DefaultPhysicsConfig, rng: createSeededRng(42) },
    );
    const dt = 0.0001;
    const edgeTimes: number[] = [];
    let lastLogic = 0;
    let time = 0;

    for (let i = 0; i < 100000; i++) {
      clk.update(dt);
      clk.clock(dt);
      const logic = clk.outputs.get("out")!.voltage > 1.0 ? 1 : 0;
      if (logic === 1 && lastLogic === 0) {
        edgeTimes.push(time);
      }
      lastLogic = logic;
      time += dt;
    }

    const periods: number[] = [];
    for (let i = 1; i < edgeTimes.length; i++) {
      periods.push(edgeTimes[i]! - edgeTimes[i - 1]!);
    }

    if (periods.length >= 2) {
      const uniquePeriods = new Set(periods.map((p) => p.toFixed(4)));
      expect(uniquePeriods.size).toBeGreaterThan(1);
    }
  });

  it("has an output port named 'out'", () => {
    const clk = new ClockSource(
      "clk",
      { speed: 30 },
      { config: DefaultPhysicsConfig, rng: createSeededRng(1) },
    );
    expect(clk.outputs.has("out")).toBe(true);
    expect(clk.kind).toBe("sequential");
  });
});
