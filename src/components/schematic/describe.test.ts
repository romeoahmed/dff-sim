import { describe, expect, it } from "vitest";
import { adderCircuit } from "@/circuits/adder";
import { buildSchematicDescriptionParts } from "./describe";

describe("buildSchematicDescriptionParts", () => {
  it("returns structural parts for adderCircuit", () => {
    const parts = buildSchematicDescriptionParts(adderCircuit);
    expect(parts.description).toBe(adderCircuit.description);
    expect(parts.componentCount).toBe(adderCircuit.components.length);
    expect(parts.netCount).toBe(adderCircuit.nets.length);
    expect(parts.typeSummary.length).toBeGreaterThan(0);
    const fullAdderEntry = parts.typeSummary.find((p) => p.type === "FullAdder");
    expect(fullAdderEntry?.count).toBeGreaterThan(0);
  });
});
