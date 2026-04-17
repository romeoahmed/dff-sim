# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

D-FlipFlop Simulation (D触发器物理仿真) — a web-based physics simulation of D Flip-Flops modeling analog characteristics: voltage fluctuation, Gaussian noise, RC delay (slew rate), and metastability. Built with TypeScript, PixiJS v8, and Vite. Uses Bun as primary package manager.

## Commands

```bash
bun install              # Install dependencies
bun run dev              # Vite dev server (localhost:5173)
bun run build            # Production build to dist/
bun run preview          # Preview production build
bun run typecheck        # tsc --noEmit
bun run lint             # ESLint (TypeScript files)
bun run lint:scss        # Stylelint (SCSS files)
bun run lint:all         # Both lint and lint:scss
bun run format           # Prettier (write)
bun run format:check     # Prettier (check only)
```

No automated test framework is configured.

## Architecture

### Thread Model (Actor Pattern)

The app splits work across two threads connected by a message protocol:

- **Main thread** (`src/main/`): DOM operations, UI event binding, ResizeObserver. `SimulationApp` in `app.ts` caches DOM elements, spawns the Worker, and bridges UI controls to the simulation.
- **Worker thread** (`src/worker/`): Physics simulation + PixiJS rendering via OffscreenCanvas. `entry.ts` handles the message loop and owns the `SimulationEngine` instance.

Messages flow Main→Worker (`INIT`, `RESIZE`, `PARAM_UPDATE`, `SETTINGS_UPDATE`, `SWITCH_RENDERER`) and Worker→Main (`STATUS_UPDATE` with current voltages). Types are in `src/common/types.ts`.

### Physics Engine (`src/worker/physics/`)

- **Signal** (`engine.ts`): Gaussian noise (Marsaglia Polar Method), frame-rate-independent RC filtering via exponential decay adjusted by deltaTime, voltage clamping.
- **DFlipFlop** (`engine.ts`): Rising-edge detection with Schmitt trigger hysteresis (thresholds at 0.6V/1.0V). Metastability: D in the undefined zone on a clock edge triggers random output collapse.
- **WaveformBuffer** (`buffer.ts`): Ring buffer backed by Float32Array. Length must be power of 2 for O(1) bitwise wraparound.

### Rendering (`src/worker/render/`)

- **PixiHost** (`host.ts`): Manages two separate PixiJS Applications — analog waveform oscilloscope and digital logic display. WebGPU preferred, WebGL fallback.
- **Render backends** (`backends/`): `IRenderer` interface with two implementations — `StdRenderer` (Graphics-based, stable) and `ExpRenderer` (MeshRope-based, experimental).

### Shared Config (`src/common/`)

- `constants.ts`: Color palette (Catppuccin Macchiato), voltage specs, simulation params, layout dimensions. All exported as `as const satisfies <Type>`.
- `types.ts`: All TypeScript interfaces including worker message unions, UI element types, and physics config shapes.

### UI (`src/main/ui/`)

- `settings.ts`: Settings sidebar for editing voltage parameters.
- `about.ts`: About sidebar. DOM element IDs must match `index.html`.

### Styles (`src/styles/`)

SCSS with `main.scss` as the import root. Organized into `base/` (variables, reset, layout, responsive) and `components/` (oscilloscope, chip, controls, sidebar).

## Code Style

- **TypeScript strict mode** with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- ESLint: `no-var` (error), `prefer-const` (warn), `eqeqeq` (always), unused vars with `_` prefix allowed
- Console: `console.warn`, `console.error`, `console.info` allowed; other `console.*` warns
- Prettier with default settings; format-on-save via VS Code
- Comments in source files are in Chinese (中文注释)

## Deployment

Push to `main` triggers GitHub Actions (`.github/workflows/deploy.yaml`) that builds with Bun and deploys to GitHub Pages.
