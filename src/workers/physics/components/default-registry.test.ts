import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createDefaultRegistry } from "./default-registry";

const deps = { config: DefaultPhysicsConfig, rng: Math.random };

describe("createDefaultRegistry", () => {
  it("creates ANDGate", () => {
    const r = createDefaultRegistry();
    const gate = r.create("ANDGate", "and0", {}, deps);
    expect(gate.kind).toBe("combinational");
    expect(typeof (gate as { evaluate?: unknown }).evaluate).toBe("function");
  });

  it("creates ORGate", () => {
    const r = createDefaultRegistry();
    const gate = r.create("ORGate", "or0", {}, deps);
    expect(gate.kind).toBe("combinational");
    expect(typeof (gate as { evaluate?: unknown }).evaluate).toBe("function");
  });

  it("creates XORGate", () => {
    const r = createDefaultRegistry();
    const gate = r.create("XORGate", "xor0", {}, deps);
    expect(gate.kind).toBe("combinational");
    expect(typeof (gate as { evaluate?: unknown }).evaluate).toBe("function");
  });

  it("creates NOTGate", () => {
    const r = createDefaultRegistry();
    const gate = r.create("NOTGate", "not0", {}, deps);
    expect(gate.kind).toBe("combinational");
    expect(typeof (gate as { evaluate?: unknown }).evaluate).toBe("function");
  });

  it("creates FullAdder", () => {
    const r = createDefaultRegistry();
    const gate = r.create("FullAdder", "fa0", {}, deps);
    expect(gate.kind).toBe("combinational");
    expect(typeof (gate as { evaluate?: unknown }).evaluate).toBe("function");
  });
});
