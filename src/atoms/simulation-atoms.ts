import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import type { CircuitDefinition } from "@/lib/types";

export const circuitDefAtom = atom<CircuitDefinition | null>(null);

export const voltageAtomFamily = atomFamily((_netId: string) => atom(0));

export const paramAtomFamily = atomFamily((_key: string) =>
  atom<number | boolean>(0),
);

export function clearCircuitAtoms(def: CircuitDefinition): void {
  for (const probe of def.probes) voltageAtomFamily.remove(probe.netId);
  for (const ctrl of def.controls) {
    paramAtomFamily.remove(`${ctrl.targetComponent}.${ctrl.param}`);
  }
}
