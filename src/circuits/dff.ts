import type { CircuitDefinition } from "@/lib/types";
import { theme } from "@/styles/theme";

export const dffCircuit: CircuitDefinition = {
  id: "dff",
  name: "D Flip-Flop",
  description:
    "Single D flip-flop demonstrating edge-triggered capture, Schmitt trigger hysteresis, 1/f noise, clock jitter, and metastability resolution.",
  components: [
    { type: "ClockSource", id: "clk", params: { speed: 30, jitterRms: 0.02 } },
    { type: "SignalSource", id: "d", params: { baseHigh: 1.5, baseLow: 0.1 } },
    { type: "DFlipFlop", id: "dff0", params: {} },
  ],
  nets: [
    {
      id: "clk_net",
      driver: { componentId: "clk", port: "out" },
      loads: [{ componentId: "dff0", port: "clk" }],
    },
    {
      id: "d_net",
      driver: { componentId: "d", port: "out" },
      loads: [{ componentId: "dff0", port: "d" }],
    },
    {
      id: "q_net",
      driver: { componentId: "dff0", port: "q" },
      loads: [],
    },
  ],
  probes: [
    { netId: "clk_net", label: "CLK", color: theme.green, channelIndex: 0 },
    { netId: "d_net", label: "D", color: theme.blue, channelIndex: 1 },
    { netId: "q_net", label: "Q", color: theme.red, channelIndex: 2 },
  ],
  controls: [
    {
      type: "toggle",
      targetComponent: "d",
      param: "targetLogic",
      label: "Input D",
      defaultValue: false,
    },
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
      type: "slider",
      targetComponent: "global",
      param: "noise",
      label: "Noise Level",
      min: 0,
      max: 100,
      defaultValue: 10,
    },
    {
      type: "momentary",
      targetComponent: "dff0",
      param: "reset",
      label: "Reset (Hold)",
      defaultValue: false,
    },
  ],
};
