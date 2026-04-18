import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "./constants";

describe("DefaultPhysicsConfig.gates", () => {
  it("has tPD in seconds, positive and reasonable for a 100 us dt", () => {
    expect(DefaultPhysicsConfig.gates.tPD).toBeGreaterThan(0);
    expect(DefaultPhysicsConfig.gates.tPD).toBeLessThan(0.1);
  });

  it("has zeta in (0, 1] for underdamped-to-critical slew", () => {
    expect(DefaultPhysicsConfig.gates.zeta).toBeGreaterThan(0);
    expect(DefaultPhysicsConfig.gates.zeta).toBeLessThanOrEqual(1);
  });

  it("has ringFreq in Hz, positive", () => {
    expect(DefaultPhysicsConfig.gates.ringFreq).toBeGreaterThan(0);
  });
});
