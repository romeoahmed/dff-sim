import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createDefaultRegistry } from "./default-registry";

const deps = { config: DefaultPhysicsConfig, rng: Math.random };

describe("createDefaultRegistry", () => {
  it("creates ANDGate", () => {
    const r = createDefaultRegistry();
    expect(() => r.create("ANDGate", "and0", {}, deps)).not.toThrow();
  });

  it("creates ORGate", () => {
    const r = createDefaultRegistry();
    expect(() => r.create("ORGate", "or0", {}, deps)).not.toThrow();
  });

  it("creates XORGate", () => {
    const r = createDefaultRegistry();
    expect(() => r.create("XORGate", "xor0", {}, deps)).not.toThrow();
  });

  it("creates NOTGate", () => {
    const r = createDefaultRegistry();
    expect(() => r.create("NOTGate", "not0", {}, deps)).not.toThrow();
  });

  it("creates FullAdder", () => {
    const r = createDefaultRegistry();
    expect(() => r.create("FullAdder", "fa0", {}, deps)).not.toThrow();
  });
});
