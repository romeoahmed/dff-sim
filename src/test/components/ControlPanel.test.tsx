import { render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import type { ReactElement } from "react";
import { circuitDefAtom } from "@/atoms/simulation-atoms";
import { ControlPanel } from "@/components/controls/ControlPanel";
import type { CircuitDefinition } from "@/lib/types";

function renderWithStore(ui: ReactElement, store = createStore()) {
  return { ...render(<Provider store={store}>{ui}</Provider>), store };
}

const mockCircuit: CircuitDefinition = {
  id: "test",
  name: "Test Circuit",
  description: "",
  components: [],
  nets: [],
  probes: [],
  controls: [
    {
      type: "slider",
      targetComponent: "clk",
      param: "speed",
      label: "Clock Speed",
      min: 1,
      max: 100,
      defaultValue: 30,
    },
    {
      type: "toggle",
      targetComponent: "d",
      param: "targetLogic",
      label: "Input D",
      defaultValue: false,
    },
    {
      type: "momentary",
      targetComponent: "dff0",
      param: "reset",
      label: "Reset",
    },
  ],
};

describe("ControlPanel", () => {
  it("renders nothing when no circuit is loaded", () => {
    const { container } = renderWithStore(<ControlPanel />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the Controls heading when a circuit is loaded", () => {
    const store = createStore();
    store.set(circuitDefAtom, mockCircuit);
    renderWithStore(<ControlPanel />, store);
    expect(screen.getByText(/controls/i)).toBeInTheDocument();
  });

  it("renders the slider label for a slider control", () => {
    const store = createStore();
    store.set(circuitDefAtom, mockCircuit);
    renderWithStore(<ControlPanel />, store);
    expect(screen.getByText("Clock Speed")).toBeInTheDocument();
  });

  it("renders a Radix slider for a slider control", () => {
    const store = createStore();
    store.set(circuitDefAtom, mockCircuit);
    renderWithStore(<ControlPanel />, store);
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("renders the toggle label for a toggle control", () => {
    const store = createStore();
    store.set(circuitDefAtom, mockCircuit);
    renderWithStore(<ControlPanel />, store);
    expect(screen.getByText("Input D")).toBeInTheDocument();
  });

  it("renders a Radix switch for a toggle control", () => {
    const store = createStore();
    store.set(circuitDefAtom, mockCircuit);
    renderWithStore(<ControlPanel />, store);
    expect(screen.getByRole("switch", { name: "Input D" })).toBeInTheDocument();
  });

  it("renders the momentary label for a momentary control", () => {
    const store = createStore();
    store.set(circuitDefAtom, mockCircuit);
    renderWithStore(<ControlPanel />, store);
    expect(screen.getByText("Reset")).toBeInTheDocument();
  });

  it("renders a Hold button for a momentary control", () => {
    const store = createStore();
    store.set(circuitDefAtom, mockCircuit);
    renderWithStore(<ControlPanel />, store);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders one control per entry in circuitDef.controls", () => {
    const store = createStore();
    store.set(circuitDefAtom, {
      ...mockCircuit,
      controls: [
        { type: "slider", targetComponent: "a", param: "x", label: "Slider A", min: 0, max: 10 },
        { type: "slider", targetComponent: "b", param: "y", label: "Slider B", min: 0, max: 10 },
      ],
    });
    renderWithStore(<ControlPanel />, store);
    expect(screen.getAllByRole("slider")).toHaveLength(2);
  });

  it("renders nothing for an empty controls array", () => {
    const store = createStore();
    store.set(circuitDefAtom, { ...mockCircuit, controls: [] });
    renderWithStore(<ControlPanel />, store);
    expect(screen.getByText(/controls/i)).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
