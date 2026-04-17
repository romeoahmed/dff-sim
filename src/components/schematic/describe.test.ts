import { describe, expect, it } from "vitest";
import { adderCircuit } from "@/circuits/adder";
import { dffCircuit } from "@/circuits/dff";
import { buildSchematicDescription } from "./describe";

describe("buildSchematicDescription", () => {
  it("includes the circuit description for the DFF", () => {
    const text = buildSchematicDescription(dffCircuit);
    expect(text).toContain(dffCircuit.description);
  });

  it("includes a count of components and nets for the adder", () => {
    const text = buildSchematicDescription(adderCircuit);
    expect(text).toContain(`${adderCircuit.components.length} components`);
    expect(text).toContain(`${adderCircuit.nets.length} nets`);
  });

  it("groups components by type with their counts", () => {
    const text = buildSchematicDescription(adderCircuit);
    expect(text).toContain("4 DFlipFlop");
    expect(text).toContain("4 FullAdder");
    expect(text).toContain("4 SignalSource");
    expect(text).toContain("1 ClockSource");
  });
});
