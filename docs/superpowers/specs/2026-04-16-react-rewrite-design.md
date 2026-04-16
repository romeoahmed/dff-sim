# D-FlipFlop Simulation: React + WebGPU Rewrite

Complete ground-up rewrite of the D flip-flop physics simulation. Replaces the imperative vanilla TypeScript + PixiJS + SCSS codebase with a modern declarative stack: React 19, Tailwind CSS v4, raw WebGPU/WGSL, multi-Worker Actor Model, and Zustand state management.

## Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| UI Framework | React | 19 | Declarative component model |
| Styling | Tailwind CSS | v4 | Utility-first CSS, CSS-first config |
| Component Library | shadcn/ui | latest | Accessible primitives (Radix + Tailwind) |
| State Management | Zustand | latest | Lightweight store for React-side state |
| Rendering | Raw WebGPU + WGSL | — | GPU-accelerated waveform rendering |
| Physics | TypeScript (pure) | — | Signal, DFlipFlop, WaveformBuffer |
| Worker Comms | Comlink | latest | Ergonomic Worker RPC proxies |
| Build | Vite | 8 | Dev server, bundling, Worker support |
| Lint/Format | Biome | latest | Single tool replacing ESLint + Prettier |
| i18n | Lingui | latest | Compile-time i18n, ICU MessageFormat |
| Icons | Lucide React | latest | Tree-shakable SVG icons |
| Testing | Vitest + Testing Library | latest | Unit + component tests |
| Package Manager | Bun | latest | Install, scripts, runtime |

## Architecture

### Three-Thread Actor Model

```
┌──────────────────────────────────────────────────────┐
│                   React (Main Thread)                 │
│                                                      │
│  ┌─────────┐  ┌───────────┐  ┌────────────────────┐ │
│  │ Zustand  │  │ shadcn/ui │  │ Lingui i18n        │ │
│  │ Store    │  │ Components│  │ (zh-CN, en)        │ │
│  └────┬─────┘  └─────┬─────┘  └────────────────────┘ │
│       │              │                                │
│  ┌────┴──────────────┴──────────────────────┐        │
│  │  useSimulation() — React hook             │        │
│  │  Owns Worker lifecycle, Comlink proxies   │        │
│  │  Subscribes to status updates             │        │
│  └──────┬────────────────────┬──────────────┘        │
└─────────┼────────────────────┼───────────────────────┘
          │ Comlink            │ Comlink
          │                    │
┌─────────┴──────┐   ┌────────┴────────────┐
│ Physics Worker  │   │ Render Worker        │
│                 │   │                      │
│ Signal class    │   │ WebGPU Device        │
│ DFlipFlop class │   │ WGSL Shaders         │
│ WaveformBuffer  │   │ OffscreenCanvas x2   │
│                 │   │ Analog + Digital view │
└────────┬────────┘   └────────┬─────────────┘
         │  MessageChannel     │
         └─────────────────────┘
```

**Main Thread (React)**: UI rendering, user interaction, Zustand state. Zero physics computation, zero canvas rendering.

**Physics Worker**: Runs the simulation loop via a `setTimeout`-based tick (Workers don't have `requestAnimationFrame`). Owns Signal instances, DFlipFlop logic, and the WaveformBuffer ring buffer. Ticks at ~120Hz (8ms interval) for smooth physics, decoupled from display refresh rate. Exposes an API via Comlink:
- `setParam(key, value)` — noise, speed, toggleD, reset
- `setSettings(specs)` — voltage threshold updates
- Status callback: pushes `{ d, clk, q }` voltage readings to main thread at ~20Hz

**Render Worker**: Owns the WebGPU device, pipeline, and both OffscreenCanvases. Runs at display vsync via `requestAnimationFrame`. Exposes an API via Comlink:
- `init(waveformCanvas, digitalCanvas, width, height, dpr)` — canvas setup + WebGPU init
- `resize(width, height, dpr)` — responsive resize
- `setRendererMode(mode)` — switch between "standard" (solid triangle-strip lines) and "experimental" (glow/bloom shader effect on lines) rendering modes. Both are raw WebGPU; the distinction is in the fragment shader.

**Physics → Render**: Direct communication via `MessageChannel`. Physics Worker sends frame data (3 Float32Arrays + write pointer) each simulation tick. Render Worker consumes the latest frame on its next `requestAnimationFrame`.

### Data Flow

```
User interaction
  → Zustand store update
  → useSimulation effect
  → Comlink proxy call to Physics Worker
  → Physics Worker updates simulation state

Physics Worker tick loop:
  → stepPhysics(dt)
  → buffer.push(d, clk, q)
  → MessageChannel.postMessage(frameData) → Render Worker
  → postMessage(voltages) → Main Thread → Zustand updateVoltages()

Render Worker frame loop (rAF):
  → receive latest frame data
  → device.queue.writeBuffer() → GPU storage buffer
  → encode render pass (waveform pipeline)
  → encode render pass (digital pipeline)
  → submit + present
```

## WebGPU Rendering Pipeline

### Overview

Two separate render pipelines targeting two OffscreenCanvases (analog waveform and digital logic). Both use the same underlying technique: triangle strip extrusion for thick, anti-aliased lines.

### Analog Waveform Pipeline

**Storage buffer**: Ring buffer data — 3 channels x 2048 samples as Float32. Updated each frame via `device.queue.writeBuffer()`.

**Uniform buffer**: Canvas dimensions, channel Y-offsets (CLK=20, D=100, Q=180), colors (Catppuccin Macchiato), line width, voltage scale (30px/V), write pointer offset, voltage headroom.

**Vertex shader** (`waveform.wgsl`):
- Input: `vertex_index` (0..4095 per channel), `instance_index` (0..2 for channel selection)
- Reads current sample and adjacent sample from storage buffer via: `let idx = (ringOffset + vertex_index / 2u) % 2048u;`
- Computes line direction between adjacent points
- Derives perpendicular normal
- Offsets vertex position by +/- half-thickness along normal (even/odd vertex_index)
- Outputs position and channel color

**Fragment shader**: Outputs solid channel color. Optional edge alpha falloff for anti-aliasing.

**Draw call**: `draw(4096, 3)` — 2048 sample points x 2 vertices per point, 3 channel instances.

**Static elements**: Threshold dashed lines (VIH, VIL) and channel labels rendered as additional draw calls or a lightweight second pipeline.

### Digital Logic Pipeline

**Same storage buffer** as analog pipeline (shared).

**Vertex shader** (`digital.wgsl`):
- Reads sample, applies threshold: `sample > logicHighMin ? yHigh : yLow`
- Creates step-function waveform (discrete jumps)
- Triangle strip extrusion for line thickness

**Draw call**: `draw(4096, 3)` — same geometry, different Y mapping.

### GPU Resource Lifecycle

- `GPUDevice`, `GPUCanvasContext`: Created once on Worker init
- `GPURenderPipeline`: Compiled once per pipeline type, reused every frame
- Storage buffer (`STORAGE | COPY_DST`): Created once, updated every frame
- Uniform buffer: Created once, updated on resize or settings change
- Canvas contexts: `alphaMode: 'premultiplied'` for transparent background

### WebGPU Compatibility

WebGPU-only (no WebGL fallback). Supported browsers:
- Chrome/Edge 113+ (April 2023)
- Firefox 141+ (July 2025)
- Safari 26+ (June 2025)

Unsupported browser detection: check `navigator.gpu` existence, show `<WebGPUUnavailable />` fallback component.

## Project Structure

```
src/
├── app/
│   ├── App.tsx                    # Root component, providers
│   ├── main.tsx                   # Entry point (React.createRoot)
│   └── providers.tsx              # Compose Lingui + context providers
│
├── components/
│   ├── ui/                        # shadcn/ui components (auto-generated)
│   │   ├── button.tsx
│   │   ├── slider.tsx
│   │   ├── dialog.tsx
│   │   ├── sheet.tsx              # Sidebar (slide-over panel)
│   │   └── ...
│   ├── oscilloscope/
│   │   ├── OscilloscopePanel.tsx  # Container: canvas refs, resize observer
│   │   ├── WaveformCanvas.tsx     # Analog waveform canvas element
│   │   ├── DigitalCanvas.tsx      # Digital logic canvas element
│   │   └── Legend.tsx             # Channel legend (CLK, D, Q)
│   ├── chip/
│   │   ├── ChipDiagram.tsx        # D-FlipFlop chip visualization
│   │   └── PinDisplay.tsx         # Individual pin (voltage + active state)
│   ├── controls/
│   │   ├── ControlPanel.tsx       # All controls container
│   │   ├── NoiseSlider.tsx        # Noise level control
│   │   ├── SpeedSlider.tsx        # Clock speed control
│   │   ├── ToggleDButton.tsx      # Input D toggle
│   │   ├── ResetButton.tsx        # Reset (hold) button
│   │   └── RendererSwitch.tsx     # Standard/Experimental toggle
│   ├── settings/
│   │   └── SettingsSheet.tsx      # Voltage parameter editing sidebar
│   ├── about/
│   │   └── AboutSheet.tsx         # About sidebar
│   ├── fallback/
│   │   └── WebGPUUnavailable.tsx  # Fallback for unsupported browsers
│   └── layout/
│       ├── Header.tsx             # Title + subtitle
│       └── AppLayout.tsx          # Main grid layout
│
├── stores/
│   ├── simulation-store.ts        # Zustand: noise, speed, D state, reset, voltages
│   ├── settings-store.ts          # Zustand: voltage spec config
│   └── ui-store.ts                # Zustand: sidebar state, renderer mode, locale
│
├── hooks/
│   ├── useSimulation.ts           # Worker lifecycle, Comlink proxies, MessageChannel
│   ├── useResizeObserver.ts       # Canvas container resize tracking
│   └── useVoltageDisplay.ts       # Subscribes to voltage status updates from Worker
│
├── workers/
│   ├── physics/
│   │   ├── physics.worker.ts      # Worker entry, Comlink.expose(), tick loop
│   │   ├── signal.ts              # Signal class (Gaussian noise, RC filter)
│   │   ├── flip-flop.ts           # DFlipFlop class (Schmitt trigger, metastability)
│   │   └── waveform-buffer.ts     # Ring buffer (Float32Array, power-of-2)
│   └── render/
│       ├── render.worker.ts       # Worker entry, WebGPU init, Comlink.expose()
│       ├── gpu-device.ts          # WebGPU adapter/device/context setup
│       ├── pipelines/
│       │   ├── waveform.ts        # Analog waveform render pipeline setup
│       │   └── digital.ts         # Digital logic render pipeline setup
│       └── shaders/
│           ├── waveform.wgsl      # Vertex/fragment for analog polylines
│           └── digital.wgsl       # Vertex/fragment for digital square waves
│
├── lib/
│   ├── constants.ts               # Colors (Catppuccin Macchiato), VoltageSpecs, Simulation, Layout
│   ├── types.ts                   # Shared TypeScript interfaces
│   ├── validation.ts              # Zod schemas for voltage spec validation
│   └── worker-bridge.ts           # Comlink + MessageChannel setup utility
│
├── i18n/
│   ├── lingui.config.ts           # Lingui configuration
│   └── locales/
│       ├── en/
│       │   └── messages.po
│       └── zh-CN/
│           └── messages.po
│
├── styles/
│   └── globals.css                # Tailwind v4 directives + Catppuccin CSS custom properties
│
└── test/
    ├── physics/
    │   ├── signal.test.ts         # Gaussian noise distribution, RC filter, clamping
    │   └── flip-flop.test.ts      # Edge detection, Schmitt trigger, metastability
    ├── stores/
    │   └── simulation-store.test.ts
    ├── components/
    │   ├── ControlPanel.test.tsx   # Control interaction tests
    │   └── SettingsSheet.test.tsx  # Validation, save/reset
    └── setup.ts                   # Vitest setup (happy-dom, testing library matchers)
```

## Zustand Stores

### simulation-store.ts

```ts
interface SimulationState {
  // Parameters
  noise: number;           // 0-100, maps to voltage in Worker
  speed: number;           // 1-100, maps to clock speed in Worker
  inputD: boolean;         // D pin logic state
  resetActive: boolean;    // hold-to-reset

  // Live readings (updated ~20Hz from Physics Worker)
  voltages: { d: number; clk: number; q: number };

  // Actions
  setNoise: (v: number) => void;
  setSpeed: (v: number) => void;
  toggleD: () => void;
  setReset: (active: boolean) => void;
  updateVoltages: (v: { d: number; clk: number; q: number }) => void;
}
```

### settings-store.ts

```ts
interface SettingsState {
  specs: VoltageSpecConfig;
  updateSpecs: (partial: Partial<VoltageSpecConfig>) => void;
  resetToDefaults: () => void;
}
```

Validation via Zod schema before dispatching to Worker. Constraints: `outputLowMax < logicLowMax < logicHighMin < outputHighMin < outputHighMax`, all within `[clampMin, systemMax]`.

### ui-store.ts

```ts
interface UIState {
  rendererMode: "standard" | "experimental";
  settingsOpen: boolean;
  aboutOpen: boolean;
  locale: "en" | "zh-CN";

  setRendererMode: (m: "standard" | "experimental") => void;
  toggleSettings: () => void;
  toggleAbout: () => void;
  setLocale: (l: "en" | "zh-CN") => void;
}
```

## React Component Design

### Component Tree

```
<App>
  <LinguiProvider>
    <AppLayout>
      <Header />
      <main className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6">
        <OscilloscopePanel>
          <DigitalCanvas />
          <WaveformCanvas />
          <Legend />
        </OscilloscopePanel>
        <ControlPanel>
          <ChipDiagram>
            <PinDisplay channel="D" />
            <PinDisplay channel="CLK" />
            <PinDisplay channel="Q" />
          </ChipDiagram>
          <RendererSwitch />
          <NoiseSlider />
          <SpeedSlider />
          <ToggleDButton />
          <ResetButton />
          <InfoBox />
        </ControlPanel>
      </main>
      <SettingsSheet />
      <AboutSheet />
    </AppLayout>
  </LinguiProvider>
</App>
```

### Key Hook: useSimulation

```ts
function useSimulation(
  waveformRef: RefObject<HTMLCanvasElement>,
  digitalRef: RefObject<HTMLCanvasElement>,
): void {
  // 1. On mount: create Physics Worker + Render Worker
  // 2. Wrap both with Comlink.wrap<PhysicsAPI>() and Comlink.wrap<RenderAPI>()
  // 3. Create MessageChannel, transfer port1 to Physics, port2 to Render
  // 4. Transfer OffscreenCanvases to Render Worker via Comlink
  // 5. Start physics simulation loop
  // 6. Subscribe to Zustand store slices:
  //    - noise/speed/inputD/resetActive changes → physicsProxy.setParam()
  //    - settings changes → physicsProxy.setSettings()
  //    - rendererMode changes → renderProxy.setMode()
  // 7. Physics Worker posts voltage status → Comlink callback → updateVoltages()
  // 8. On unmount: terminate both Workers, clean up subscriptions
}
```

### Tailwind + Catppuccin

Catppuccin Macchiato colors defined as CSS custom properties in `globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-base: #24273a;
  --color-surface-0: #363a4f;
  --color-surface-1: #494d64;
  --color-surface-2: #5b6078;
  --color-text: #cad3f5;
  --color-subtext: #a5adcb;
  --color-clk: #a6da95;
  --color-d: #8aadf4;
  --color-q: #ed8796;
  --color-highlight: #eed49f;
  --color-overlay: #363a4f;
}
```

Dark theme only. Responsive grid: single column on mobile, two columns on desktop.

## Physics Engine

### Preserved from current codebase (cleaned and modularized):

**Signal class** (`workers/physics/signal.ts`):
- Gaussian noise via Marsaglia Polar Method (double-buffered)
- Frame-rate-independent RC filter: `adjustedFactor = 1 - (1 - baseFactor)^(dt * baseFrameRate)`
- Voltage clamping to `[clampMin, systemMax]`
- Constructor params: `baseHigh`, `baseLow`, `smoothingFactor`

**DFlipFlop class** (`workers/physics/flip-flop.ts`):
- Rising edge detection on CLK (0→1 transition)
- Schmitt trigger hysteresis: `voltage > logicHighMin` → 1, `< logicLowMax` → 0, else hold
- Metastability: D in undefined zone (0.6V-1.0V) at clock edge → random output
- Async reset support
- Output Signal uses faster smoothing (0.4 vs 0.2)

**WaveformBuffer class** (`workers/physics/waveform-buffer.ts`):
- Ring buffer: 3 x Float32Array, length 2048 (power of 2)
- O(1) wraparound via bitwise AND: `(ptr + 1) & (length - 1)`
- Push, reset, read pointer access

### Changes from current codebase:

- Split `engine.ts` into separate `signal.ts` and `flip-flop.ts` files
- Remove direct dependency on global `VoltageSpecs` — pass config as constructor/method params for testability
- Physics Worker entry (`physics.worker.ts`) owns the tick loop and Comlink API surface
- VoltageSpecs updates arrive via Comlink instead of `Object.assign(VoltageSpecs, ...)`

## Internationalization (Lingui)

### Configuration

Lingui with compile-time extraction. Two locales: `en` (default), `zh-CN`.

### Usage in components

```tsx
import { Trans, t } from "@lingui/react/macro";

// In JSX:
<Trans>Input D: LOW</Trans>
<Trans>Noise Level</Trans>

// In attributes:
<button aria-label={t`Toggle input D`}>
```

### Message catalogs

`src/i18n/locales/en/messages.po` and `src/i18n/locales/zh-CN/messages.po`. Extracted via `bun run lingui extract`, compiled via `bun run lingui compile`.

## Error Handling

- **WebGPU unavailable**: Check `navigator.gpu` on mount. Render `<WebGPUUnavailable />` component with browser requirements.
- **Worker initialization failure**: Comlink wraps errors as rejected promises. `useSimulation` catches and surfaces via error state.
- **Settings validation**: Zod schema validates voltage spec constraints. Invalid values show inline error in SettingsSheet. Save button disabled until valid.

## Testing

### Unit Tests (Vitest)

**Physics** (`test/physics/`):
- `signal.test.ts`: Noise distribution (mean ~0, std ~noiseLevel over N samples), RC filter convergence to target, voltage clamping at bounds, frame-rate independence (same result at 30fps vs 120fps)
- `flip-flop.test.ts`: Rising edge captures D, falling edge ignores, Schmitt trigger hysteresis band, metastability (~50% over 1000 runs), async reset overrides, output smoothing

**Stores** (`test/stores/`):
- Store action tests: setNoise updates state, toggleD flips, resetToDefaults restores initial values

### Component Tests (Vitest + React Testing Library)

**Components** (`test/components/`):
- `ControlPanel.test.tsx`: Slider interaction fires store action, toggle button state reflects store
- `SettingsSheet.test.tsx`: Invalid values show error, valid values enable save, reset restores defaults

### Setup

- `test/setup.ts`: happy-dom environment, @testing-library/jest-dom matchers
- Worker mocks: Comlink proxies mocked in component tests (physics runs in-process)

## Lint & Format (Biome)

Single `biome.json` replaces ESLint + Prettier + Stylelint:

```json
{
  "$schema": "https://biomejs.dev/schemas/latest/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "css": {
    "linter": { "enabled": true },
    "formatter": { "enabled": true }
  }
}
```

Scripts:
- `bun run check` → `biome check .`
- `bun run check:fix` → `biome check . --write`
- `bun run format` → `biome format . --write`

## Deployment

Same GitHub Actions pipeline as current project, updated for the new stack:

1. Checkout
2. Setup Bun
3. `bun install`
4. `bun run check` (Biome lint + format check)
5. `bun run typecheck` (tsc --noEmit)
6. `bun run test` (Vitest)
7. `bun run build` (Vite production build)
8. Deploy `dist/` to GitHub Pages

## Dependencies Summary

### Production
- react, react-dom
- pixi.js — REMOVED (replaced by raw WebGPU)
- @fortawesome/fontawesome-free — REMOVED (replaced by Lucide React)
- zustand
- comlink
- @radix-ui/* (via shadcn/ui)
- lucide-react
- @lingui/core, @lingui/react
- zod
- tailwind-merge, class-variance-authority (shadcn/ui utilities)

### Dev
- typescript
- vite, @vitejs/plugin-react
- @biomejs/biome
- vitest, @testing-library/react, @testing-library/jest-dom, happy-dom
- @lingui/cli, @lingui/macro, @lingui/vite-plugin
- tailwindcss
- @types/react, @types/react-dom, @types/bun
