import { render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { describe, expect, it } from "vitest";
import { circuitDefAtom } from "@/atoms/simulation-atoms";
import { adderCircuit } from "@/circuits/adder";
import { dffCircuit } from "@/circuits/dff";
import { CircuitSchematic } from "@/components/schematic/CircuitSchematic";
import type { CircuitDefinition } from "@/lib/types";

function renderWith(def: CircuitDefinition) {
  const store = createStore();
  store.set(circuitDefAtom, def);
  return render(
    <Provider store={store}>
      <CircuitSchematic />
    </Provider>,
  );
}

describe("CircuitSchematic", () => {
  it("renders an svg with role=img and aria-labelledby for the DFF", () => {
    renderWith(dffCircuit);
    const svg = screen.getByRole("img");
    const titleId = svg.getAttribute("aria-labelledby");
    expect(titleId).not.toBeNull();
    const title = titleId ? document.getElementById(titleId) : null;
    expect(title?.textContent).toContain(dffCircuit.name);
  });

  it("exposes a desc linked via aria-describedby for the adder", () => {
    renderWith(adderCircuit);
    const svg = screen.getByRole("img");
    const descId = svg.getAttribute("aria-describedby");
    expect(descId).not.toBeNull();
    const desc = descId ? document.getElementById(descId) : null;
    expect(desc?.textContent).toContain("13 components");
    expect(desc?.textContent).toContain(`${adderCircuit.nets.length} nets`);
  });
});
