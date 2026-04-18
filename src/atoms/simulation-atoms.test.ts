import { createStore } from "jotai";
import { circuitDefAtom, paramAtomFamily, voltageAtomFamily } from "./simulation-atoms";

describe("simulation-atoms", () => {
  it("voltageAtomFamily creates independent atoms per netId", () => {
    const store = createStore();
    store.set(voltageAtomFamily("clk_net"), 1.5);
    store.set(voltageAtomFamily("d_net"), 0.3);
    expect(store.get(voltageAtomFamily("clk_net"))).toBe(1.5);
    expect(store.get(voltageAtomFamily("d_net"))).toBe(0.3);
  });

  it("paramAtomFamily holds number and boolean values independently", () => {
    const store = createStore();
    store.set(paramAtomFamily("clk.speed"), 50);
    store.set(paramAtomFamily("d.targetLogic"), true);
    expect(store.get(paramAtomFamily("clk.speed"))).toBe(50);
    expect(store.get(paramAtomFamily("d.targetLogic"))).toBe(true);
  });

  it("circuitDefAtom defaults to null", () => {
    const store = createStore();
    expect(store.get(circuitDefAtom)).toBe(null);
  });
});
