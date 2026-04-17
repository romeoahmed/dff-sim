import { describe, expect, it } from "vitest";
import { ComponentRegistry } from "./registry";
import { createPort } from "./base";
import type { Component, ComponentDeps } from "@/lib/types";
import { DefaultPhysicsConfig } from "@/lib/constants";

class MockComponent implements Component {
  readonly kind = "combinational" as const;
  readonly inputs = new Map();
  readonly outputs = new Map([["out", createPort("out")]]);

  constructor(
    readonly id: string,
    readonly receivedParams: Record<string, unknown>,
  ) {}

  evaluate() {}
}

const mockDeps: ComponentDeps = {
  config: DefaultPhysicsConfig,
  rng: Math.random,
};

describe("ComponentRegistry", () => {
  it("creates a registered component", () => {
    const registry = new ComponentRegistry();
    registry.register("Mock", (id, params, _deps) => new MockComponent(id, params));

    const comp = registry.create("Mock", "m1", { foo: 42 }, mockDeps);
    expect(comp.id).toBe("m1");
    expect((comp as MockComponent).receivedParams).toEqual({ foo: 42 });
  });

  it("throws for unregistered type", () => {
    const registry = new ComponentRegistry();
    expect(() => registry.create("Unknown", "u1", {}, mockDeps)).toThrow(
      "Unknown component type: Unknown",
    );
  });

  it("passes deps to factory", () => {
    const registry = new ComponentRegistry();
    let capturedDeps: ComponentDeps | null = null;
    registry.register("Spy", (_id, _params, deps) => {
      capturedDeps = deps;
      return new MockComponent("spy", {});
    });

    registry.create("Spy", "s1", {}, mockDeps);
    expect(capturedDeps).toBe(mockDeps);
  });
});
