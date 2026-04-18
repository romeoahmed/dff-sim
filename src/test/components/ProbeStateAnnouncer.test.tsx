import { act, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { describe, expect, it } from "vitest";
import { circuitDefAtom, voltageAtomFamily } from "@/atoms/simulation-atoms";
import { ProbeStateAnnouncer } from "@/components/oscilloscope/ProbeStateAnnouncer";
import type { CircuitDefinition } from "@/lib/types";

const mini: CircuitDefinition = {
  id: "mini",
  name: "Mini",
  description: "",
  components: [],
  nets: [],
  probes: [
    { netId: "a", label: "A", color: "#fff", channelIndex: 0 },
    { netId: "b", label: "B", color: "#fff", channelIndex: 1 },
  ],
  controls: [],
};

describe("ProbeStateAnnouncer", () => {
  it("renders a visually-hidden polite live region", () => {
    const store = createStore();
    store.set(circuitDefAtom, mini);
    render(
      <Provider store={store}>
        <ProbeStateAnnouncer />
      </Provider>,
    );
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region.className).toContain("sr-only");
  });

  it("announces a probe crossing logicHighMin as HIGH", () => {
    const store = createStore();
    store.set(circuitDefAtom, mini);
    store.set(voltageAtomFamily("a"), 0);
    store.set(voltageAtomFamily("b"), 0);
    const { rerender } = render(
      <Provider store={store}>
        <ProbeStateAnnouncer />
      </Provider>,
    );
    act(() => {
      store.set(voltageAtomFamily("a"), 1.5);
      rerender(
        <Provider store={store}>
          <ProbeStateAnnouncer />
        </Provider>,
      );
    });
    expect(screen.getByRole("status").textContent).toContain("A HIGH");
  });

  it("does not announce voltage changes within the Schmitt band", () => {
    const store = createStore();
    store.set(circuitDefAtom, mini);
    store.set(voltageAtomFamily("a"), 0);
    const { rerender } = render(
      <Provider store={store}>
        <ProbeStateAnnouncer />
      </Provider>,
    );
    act(() => {
      store.set(voltageAtomFamily("a"), 0.7);
      rerender(
        <Provider store={store}>
          <ProbeStateAnnouncer />
        </Provider>,
      );
    });
    expect(screen.getByRole("status").textContent ?? "").not.toContain("A HIGH");
    expect(screen.getByRole("status").textContent ?? "").not.toContain("A LOW");
  });
});
