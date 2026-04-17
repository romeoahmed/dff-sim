# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**DFF·SIM** — a web-based physics simulation of digital logic circuits. Rather than modelling ideal 0/1 transitions, the engine simulates the underlying analog behaviour: Gaussian noise (white + 1/f flicker), RC-slew via a damped second-order signal model, Schmitt-trigger hysteresis, and metastability resolution. The UI is a React instrument panel with a real-time WebGPU oscilloscope.

Built with **React 19**, **TypeScript 6**, **Vite 8**, **Biome 2**, **Jotai 2**, and **Bun**.

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Vite dev server → http://localhost:5173
bun run build        # Production build → dist/
bun run preview      # Serve production build locally
bun run typecheck    # tsc --noEmit
bun run check        # Biome lint + format check (no writes)
bun run test         # Vitest (single run)
bun run test:watch   # Vitest in watch mode
bun run test:ui      # Vitest browser UI
```

## Architecture

### Thread model

Three threads communicate via Comlink and a direct MessagePort channel:

```
Main thread (React UI)
   │  Comlink RPC
   ▼
Physics Worker          ──MessagePort──▶  Render Worker
(simulation engine)                       (WebGPU, OffscreenCanvas)
```

- **Main thread** (`src/`): React 19 + Jotai atoms. Mounts the UI, reads atom state, calls physics/render worker methods via `useSimulation` hook.
- **Physics worker** (`src/workers/physics/physics.worker.ts`): owns `SimulationEngine` → `CircuitGraph` → component tick loop. Posts frame buffers directly to the render worker via a MessagePort so frame data never touches the main thread.
- **Render worker** (`src/workers/render/render.worker.ts`): WebGPU pipeline. Receives `Float32Array` frames and draws waveforms via custom WGSL shaders. Three shader styles: `clean`, `glow`, `phosphor`.

### Physics engine

`src/workers/physics/`

- **`signal.ts`** — `Signal` class: damped second-order oscillator (ζ, ω) for voltage transitions with analog overshoot/ringing. Frame-rate-independent via explicit `dt`.
- **`noise.ts`** — `NoiseGenerator`: Marsaglia Polar Method for Gaussian white noise plus a Voss-McCartney octave accumulator for 1/f flicker noise.
- **`graph.ts`** — `CircuitGraph`: instantiates components from a `CircuitDefinition` and wires nets. Combinational components are evaluated in insertion order each tick; intra-tick ordering is no longer required because each gate has its own `tPD` and Signal dynamics. Feedback loops (SR latches, ring oscillators) are valid circuits.
- **`engine.ts`** — `SimulationEngine`: orchestrates one physics step: `seq.update → propagate → seq.clock → evaluateCombinational → updateCombinational(dt) → propagate → buffer.push`. `evaluate` queues pending output targets on each gate's `AnalogOutput`; `update(dt)` ticks the tPD timer and advances the Signal.
- **`analog-output.ts`** — `AnalogOutput`: shared helper composing a `Signal` + `NoiseGenerator` + pending-`tPD` timer. Each combinational gate owns one per output port (`FullAdder` owns two).
- **`gaussian.ts`** — `createGaussianSampler(rng)`: free-function Marsaglia polar sampler, reused by `NoiseGenerator` and `DFlipFlop`'s metastability resolution.
- **`waveform-buffer.ts`** — `WaveformBuffer`: multi-channel ring buffer (`Float32Array`). Length is a power of 2; wraparound uses bitwise `&`.
- **`components/`** — all components implement either `SequentialComponent` (`update`, `clock`) or `CombinationalComponent` (`evaluate`, `update`):
  - Sequential: `DFlipFlop`, `ClockSource`, `SignalSource`
  - Combinational: `ANDGate`, `ORGate`, `XORGate`, `NOTGate`, `FullAdder`

### Circuit definitions

`src/circuits/` — each file exports a `CircuitDefinition` object (components, nets, probes, controls). Currently: `dffCircuit` (single D flip-flop) and `adderCircuit` (4-bit ripple-carry accumulator). `src/circuits/index.ts` exports the combined `circuits` array consumed by `CircuitSelector`.

### State management

`src/atoms/` — Jotai 2 atoms:

- `circuitDefAtom` — the loaded `CircuitDefinition | null`
- `paramAtomFamily(key)` — per-control parameter values (`number | boolean`)
- `voltageAtomFamily(netId)` — live probe voltages from the physics worker
- `settingsOpenAtom`, `shaderStyleAtom`, `localeAtom`, etc.

### UI components

`src/components/` — React components grouped by role:

| Directory | Contents |
|-----------|----------|
| `controls/` | `ControlPanel`, `ParamSlider` (Radix), `ParamToggle` (Radix Switch), `ParamMomentary` |
| `nav/` | `Toolbar`, `CircuitSelector`, `SettingsSheet` |
| `oscilloscope/` | `OscilloscopePanel` (canvas host) |
| `schematic/` | `CircuitSchematic` (SVG net diagram) |

### Styling

Tailwind CSS v4. Theme colours come from `src/styles/theme.ts` which pulls Catppuccin Macchiato hex values from `@catppuccin/palette`. All CSS variable names follow the pattern `--color-<name>`.

### i18n

Lingui 5. Catalogs live in `src/locales/`. Active locale is stored in `localeAtom` (`"en"` | `"zh-CN"`). Only user-visible strings are translated; source code and comments are English-only.

## Code Style

- **TypeScript** strict mode: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- **Biome 2** handles all formatting and linting (no ESLint, no Prettier)
- **No `!` non-null assertions** in production code; extract port refs as `private readonly` fields in component constructors instead
- **No `as any` or `as unknown as T`** double-casts; use type predicates or runtime checks
- **No comments** unless the WHY is non-obvious (hidden constraint, subtle invariant, workaround). Never comment what the code already says.
- **All source comments in English**

## Testing

Vitest 4 + `@testing-library/react` 16 + happy-dom.

- Physics / logic tests are colocated with source files (e.g., `and-gate.test.ts` next to `and-gate.ts`)
- React component tests live in `src/test/components/`
- Wrap components with Jotai `<Provider store={createStore()}>` to isolate atom state per test
- Port extraction in tests: `get("portName")` + `toBeDefined()` guard + early return — never `!`

## Deployment

Push to `main` → GitHub Actions (`.github/workflows/deploy.yaml`) builds with Bun and deploys to GitHub Pages.
