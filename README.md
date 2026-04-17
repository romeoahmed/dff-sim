# DFF·SIM

**Physics-accurate digital logic simulation in the browser.**

English · [中文](./README.zh-CN.md)

![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![WebGPU](https://img.shields.io/badge/WebGPU-enabled-ff6b35)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Overview

DFF·SIM is a browser simulator of digital logic circuits at the **analog voltage level**, not as ideal binary transitions. Every wire carries a continuous voltage that rises and falls with real physics — Gaussian noise, RC slew, second-order ringing, Schmitt-trigger hysteresis, per-gate propagation delay, and metastability that visibly hovers at the midpoint before snapping to a rail.

It is an instrument panel, not an HDL simulator. The goal is to see the physics of digital logic on an oscilloscope the way a lab bench would show it — with all the imperfections that textbook diagrams hide.

The oscilloscope renders at 60+ FPS on a dedicated WebGPU thread. The UI is a React instrument panel styled with Catppuccin Macchiato.

---

## Physics model

| Effect | Implementation |
|--------|----------------|
| Gaussian white noise | Marsaglia polar method |
| 1/f flicker noise | Voss-McCartney octave accumulator |
| Voltage slew & ringing | Damped second-order oscillator (ζ, ωₙ) |
| Schmitt-trigger hysteresis | Two-level threshold band; sub-band voltages latch the previous state |
| Propagation delay | Per-gate `tPD` via a pending-target timer on each analog output |
| Metastability | Exponential-distributed resolution time; Q visibly hovers at mid-voltage; resolution is biased by the D voltage at the clock edge plus Gaussian jitter, not a fair coin |
| Frame-rate independence | All physics stepped by an explicit `dt` |

Every combinational gate (`ANDGate`, `ORGate`, `XORGate`, `NOTGate`, `FullAdder`) owns its own `AnalogOutput` — a `Signal` plus a `NoiseGenerator` plus a `tPD` timer — so the same dynamics DFFs have are present end-to-end. Feedback circuits (SR latches, ring oscillators, astables) are valid; there is no topological-sort rejection.

---

## Circuits

| Circuit | What you see |
|---------|--------------|
| **D Flip-Flop** | A single DFF demonstrating edge-triggered capture, clock jitter, output noise, and metastability. Park the D input inside the Schmitt band just before a rising edge and Q hovers at mid for a visible random interval before snapping to HIGH or LOW, biased by where D actually sat. |
| **4-bit Accumulator** | Ripple-carry adder feeding four DFFs. Each full adder has its own `tPD`, so on every clock edge you can watch the carry cascade through the chain — Q0 settles, then Q1, then Q2, then Q3 — instead of all four bits flipping simultaneously. |

---

## Rendering

- **WebGPU** oscilloscope rendered entirely on a dedicated worker thread via `OffscreenCanvas`. The main thread never blocks waveform drawing.
- Three fragment-shader styles: **Clean**, **Glow** (bloom halo), and **Phosphor** (CRT scanline with age fade).
- **Per-channel dash patterns** (solid, long-dash, dot, dash-dot) so traces are distinguishable without colour — the patterns apply to both the analog waveform and the digital-logic views under every shader style.
- Direct physics → render `MessagePort` channel: frame data bypasses the main thread entirely.

---

## UI and accessibility

- Per-circuit parameter controls (sliders, toggles, momentary buttons) via Radix primitives.
- Probe selector — choose which signals appear on the oscilloscope.
- Circuit selector — switch between loaded circuit definitions at runtime.
- Settings sheet and localisation toggle (English / 中文).
- **Accessibility**: canvases and SVG schematic carry proper `aria-label` / `role="img"` / `<title>` / `<desc>`; the schematic description is derived from the `CircuitDefinition` (component-type counts + net count + definition text). A visually-hidden live region announces probe logic transitions (HIGH ↔ LOW) only on Schmitt-band crossings — no 60 Hz voltage flood. Dash patterns give a second, non-colour channel for distinguishing traces.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| UI framework | React 19 |
| Language | TypeScript 6 (strict) |
| Build | Vite 8 + Bun |
| State | Jotai 2 (atomic) |
| Worker RPC | Comlink 4 |
| GPU | WebGPU (`@webgpu/types`) |
| Styling | Tailwind CSS v4 + Catppuccin Macchiato |
| Components | Radix UI primitives |
| Animation | Motion (Framer Motion) |
| i18n | Lingui 5 (en / zh-CN) |
| Lint + format | Biome 2 |
| Tests | Vitest 4 + Testing Library + happy-dom |

---

## Quick start

### Requirements

- [Bun](https://bun.sh/) v1.0+
- Chrome 113+ or another WebGPU-capable browser

### Install and run

```bash
git clone https://github.com/romeoahmed/dff-sim.git
cd dff-sim
bun install
bun run dev
```

Open `http://localhost:5173`.

### Other commands

```bash
bun run build        # Production build → dist/
bun run preview      # Serve production build
bun run typecheck    # Type-check without emitting
bun run check        # Biome lint + format check
bun run test         # Run all tests (Vitest)
bun run test:watch   # Watch mode
bun run test:ui      # Browser test UI
```

---

## Architecture

Three threads, two hops:

```
┌─────────────────────────────────────┐
│         Main thread (React)         │
│   Jotai atoms · hooks · components  │
│            Comlink RPC ↕            │
└──────────┬──────────────────────────┘
           │
┌──────────▼──────────┐   MessagePort   ┌─────────────────────┐
│   Physics worker    │ ─────────────▶  │   Render worker     │
│  SimulationEngine   │  Float32 frames │  WebGPU pipelines   │
│  CircuitGraph       │                 │  WGSL shaders       │
│  Component tick     │                 │  OffscreenCanvas    │
└─────────────────────┘                 └─────────────────────┘
```

Each physics tick runs the following phases in order:

```
seq.update(dt)           // DFF Signal step, pending Q timer
propagate                // DFF outputs fan out to nets
seq.clock(dt)            // DFF edge detect, sample D, queue pending
evaluateCombinational()  // gates read inputs, queue pending output
updateCombinational(dt)  // gates tick tPD, advance Signal, write output port
propagate                // gate outputs fan out
buffer.push              // probe voltages written to the ring buffer
```

Frame data flows physics → render through a direct `MessagePort` — never through the main thread. The render worker uploads the frame to a GPU storage buffer and draws each trace as an instanced triangle strip.

---

## Project structure

```
src/
├── atoms/                   # Jotai atoms (simulation state, UI state)
├── circuits/                # Circuit definitions (DFF, accumulator, …)
├── components/
│   ├── controls/            # ParamSlider, ParamToggle, ParamMomentary, ControlPanel, ProbeSelector
│   ├── nav/                 # Toolbar, CircuitSelector, SettingsSheet
│   ├── oscilloscope/        # OscilloscopePanel, WaveformCanvas, DigitalCanvas, LiveVoltageReadouts, ProbeStateAnnouncer, Legend
│   └── schematic/           # CircuitSchematic, SchematicGrid/Node/Wire, describe helper
├── hooks/                   # useSimulation (worker bridge integration)
├── lib/                     # Types, constants, worker bridge, RNG utilities
├── locales/                 # Lingui i18n catalogs (en, zh-CN)
├── styles/                  # Catppuccin theme
├── test/                    # Test setup and component tests
└── workers/
    ├── physics/             # SimulationEngine, CircuitGraph, Signal, NoiseGenerator, AnalogOutput, gaussian, components/
    └── render/              # WebGPU pipelines, gpu-device, WGSL shaders (vert + clean/glow/phosphor/digital)
```

The `docs/superpowers/` directory holds the specs and implementation plans that produced the current behaviour — useful if you want to see the reasoning behind a design decision rather than the code that resulted from it.

---

## License

[MIT](LICENSE)
