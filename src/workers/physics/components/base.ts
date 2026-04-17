import type { Component, CombinationalComponent, SequentialComponent, Port } from "@/lib/types";

export type { Component, CombinationalComponent, SequentialComponent };

export function createPort(name: string, initialVoltage: number = 0): Port {
  return { name, voltage: initialVoltage };
}

export function isSequential(c: Component): c is SequentialComponent {
  return c.kind === "sequential";
}

export function isCombinational(c: Component): c is CombinationalComponent {
  return c.kind === "combinational";
}
