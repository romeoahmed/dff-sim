// Probe trace colors. Chosen for visibility against both the dark (#000) and
// light (#f5f5f7) canvas. These are rendered on the WebGPU surface as waveform
// strokes, so they live outside the semantic chrome palette in globals.css.
export const theme = {
  green: "#30d158",
  blue: "#2997ff",
  red: "#ff453a",
  yellow: "#ffd60a",
  mauve: "#bf5af2",
  peach: "#ff9f0a",
  teal: "#64d2ff",
  pink: "#ff375f",
} as const;

export type ProbeColorName = keyof typeof theme;
