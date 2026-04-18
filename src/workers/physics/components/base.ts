import type { CombinationalComponent, Component, Port, SequentialComponent } from "@/lib/types";

export type { CombinationalComponent, Component, SequentialComponent };

export function createPort(name: string, initialVoltage: number = 0): Port {
  return { name, voltage: initialVoltage };
}

export function isSequential(c: Component): c is SequentialComponent {
  return c.kind === "sequential";
}

export function isCombinational(c: Component): c is CombinationalComponent {
  return c.kind === "combinational";
}

// Schmitt-trigger input: hold last logic value when voltage is inside the dead-band.
// Prevents spurious edges when input voltage lingers near the threshold (e.g. with noise).
export function readLogicInput(
  voltage: number,
  last: 0 | 1,
  highThreshold: number,
  lowThreshold: number,
): 0 | 1 {
  if (voltage > highThreshold) return 1;
  if (voltage < lowThreshold) return 0;
  return last;
}
