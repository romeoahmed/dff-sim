// Default component registry: register all built-in component types

import { ANDGate } from "./and-gate";
import { ClockSource } from "./clock-source";
import { DFlipFlop } from "./flip-flop";
import { FullAdder } from "./full-adder";
import { NOTGate } from "./not-gate";
import { ORGate } from "./or-gate";
import { ComponentRegistry } from "./registry";
import { SignalSource } from "./signal-source";
import { XORGate } from "./xor-gate";

export function createDefaultRegistry(): ComponentRegistry {
  const r = new ComponentRegistry();
  // Constructor accepts ComponentDeps as the third parameter
  r.register("ClockSource", (id, p, d) => new ClockSource(id, p, d));
  r.register("SignalSource", (id, p, d) => new SignalSource(id, p, d));
  r.register("DFlipFlop", (id, p, d) => new DFlipFlop(id, p, d));
  r.register("ANDGate", (id, p, d) => new ANDGate(id, p, d));
  r.register("ORGate", (id, p, d) => new ORGate(id, p, d));
  r.register("XORGate", (id, p, d) => new XORGate(id, p, d));
  r.register("NOTGate", (id, p, d) => new NOTGate(id, p, d));
  r.register("FullAdder", (id, p, d) => new FullAdder(id, p, d));
  return r;
}
