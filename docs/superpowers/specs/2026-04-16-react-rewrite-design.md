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
- `setShaderStyle(style)` — switch between three WGSL fragment shader styles: "clean" (solid crisp lines), "glow" (neon bloom halo), "phosphor" (brightness decay trail). All share the same vertex shader and triangle-strip geometry; only the fragment shader differs.

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

**Fragment shaders** (three styles, switchable at runtime by swapping the pipeline):

1. **Clean** (`waveform-clean.wgsl`): Solid channel color with smooth edge alpha falloff for anti-aliasing. Minimal computation.

2. **Glow** (`waveform-glow.wgsl`): Bright core (full channel color) with a soft neon bloom halo. Uses distance-from-center-line to compute alpha: core is opaque, edges fade with Gaussian falloff. CRT/retro oscilloscope aesthetic.

3. **Phosphor** (`waveform-phosphor.wgsl`): Brightness decays based on sample age (distance from write pointer in ring buffer). Newest samples render at full brightness, older samples fade toward a dim minimum. Simulates phosphor persistence on a real CRT oscilloscope. The age factor is passed from the vertex shader as a varying.

All three share the same vertex shader (triangle strip extrusion). Pipeline switching is done by pre-compiling all three `GPURenderPipeline` objects on init and selecting the active one per frame based on `shaderStyle`.

**Draw call**: `draw(4096, 3)` — 2048 sample points x 2 vertices per point, 3 channel instances.

**Static elements**: Threshold dashed lines (VIH, VIL) and channel labels rendered as additional draw calls or a lightweight second pipeline.

### Digital Logic Pipeline

**Same storage buffer** as analog pipeline (shared).

**Vertex shader** (`digital.wgsl`):
- Reads sample, applies threshold: `sample > logicHighMin ? yHigh : yLow`
- Creates step-function waveform (discrete jumps)
- Triangle strip extrusion for line thickness

**Fragment shader**: Uses the same three styles as analog pipeline (clean/glow/phosphor). Same pipeline switching mechanism.

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
│   │   └── ShaderStyleToggle.tsx   # Clean/Glow/Phosphor toggle group
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
│   └── ui-store.ts                # Zustand: sidebar state, shader style, locale
│
├── hooks/
│   ├── useSimulation.ts           # Worker lifecycle, Comlink proxies, MessageChannel
│   ├── useResizeObserver.ts       # Canvas container resize tracking
│   └── useVoltageDisplay.ts       # Subscribes to voltage status updates from Worker
│
├── workers/
│   ├── physics/
│   │   ├── physics.worker.ts      # Worker entry, Comlink.expose(), accumulator tick loop
│   │   ├── engine.ts              # SimulationEngine: orchestrates all physics components
│   │   ├── noise.ts               # NoiseGenerator: Marsaglia white + Voss-McCartney 1/f
│   │   ├── signal.ts              # Signal: state-space RLC model, noise injection
│   │   ├── clock.ts               # ClockGenerator: phase tracking, jitter, edge detection
│   │   ├── flip-flop.ts           # DFlipFlop: Schmitt trigger, setup/hold, metastability
│   │   └── waveform-buffer.ts     # WaveformBuffer: ring buffer (Float32Array, power-of-2)
│   └── render/
│       ├── render.worker.ts       # Worker entry, WebGPU init, Comlink.expose()
│       ├── gpu-device.ts          # WebGPU adapter/device/context setup
│       ├── pipelines/
│       │   ├── waveform.ts        # Analog waveform render pipeline setup
│       │   └── digital.ts         # Digital logic render pipeline setup
│       └── shaders/
│           ├── waveform.vert.wgsl       # Shared vertex shader (triangle strip extrusion)
│           ├── waveform-clean.frag.wgsl # Fragment: solid crisp lines
│           ├── waveform-glow.frag.wgsl  # Fragment: neon bloom halo
│           ├── waveform-phosphor.frag.wgsl # Fragment: brightness decay trail
│           └── digital.wgsl             # Vertex/fragment for digital square waves
│
├── lib/
│   ├── constants.ts               # Colors (Catppuccin Macchiato), VoltageSpecs, Simulation, Layout, Timing
│   ├── types.ts                   # Shared TypeScript interfaces (incl. TimingConfig, SignalConfig, PhysicsConfig)
│   ├── validation.ts              # Zod schemas for voltage spec and timing validation
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
    │   ├── noise.test.ts          # White + 1/f noise distribution and spectrum
    │   ├── signal.test.ts         # RLC step response, overshoot, clamping
    │   ├── clock.test.ts          # Frequency accuracy, jitter distribution
    │   └── flip-flop.test.ts      # Edge detection, setup/hold, t_CQ, metastability
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
  shaderStyle: "clean" | "glow" | "phosphor";
  settingsOpen: boolean;
  aboutOpen: boolean;
  locale: "en" | "zh-CN";

  setShaderStyle: (s: "clean" | "glow" | "phosphor") => void;
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
          <ShaderStyleToggle />
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
  //    - shaderStyle changes → renderProxy.setShaderStyle()
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

Complete redesign of the physics model for realistic circuit behavior. All classes receive config via constructor (dependency injection), no global mutable state.

### Fixed-Timestep Sub-Stepping

Physics runs at a fixed **10 kHz** rate (dt = 0.1ms) using an accumulator pattern:

```ts
const PHYSICS_DT = 0.0001; // 100 microseconds

tick(realDt: number) {
  this.accumulator += realDt;
  while (this.accumulator >= PHYSICS_DT) {
    this.stepPhysics(PHYSICS_DT);
    this.accumulator -= PHYSICS_DT;
  }
}
```

At the Worker's ~120Hz tick rate, this runs ~8 sub-steps per tick. Benefits:
- Clock edges detected with 0.1ms precision regardless of display refresh rate
- RLC model stays numerically stable (`wn * dt = 0.063`)
- Setup/hold time windows evaluated accurately
- Consistent behavior across 30fps, 60fps, 144fps

Data pushed to ring buffer after each sub-step for higher-resolution waveform data.

### Composite Noise Generator (`workers/physics/noise.ts`)

Combines two noise sources for realistic CMOS noise spectrum:

**White noise** — Marsaglia Polar Method (carried over, double-buffered):
```
rejection sample u,v in [-1,1] until s = u²+v² < 1
mul = sqrt(-2 * log(s) / s)
yield u*mul (cache v*mul for next call)
```

**1/f (flicker) noise** — Voss-McCartney algorithm, 8 octaves:
```
8 Gaussian generators, each updated at half the rate of the previous
counter tracks which generator to update (trailing-zero-bit index)
running_sum maintained incrementally (subtract old, add new)
```

**Composite**: `noise = (voss_sum / 8) * sigma_flicker + white * sigma_white`, where `sigma_flicker = 4 * sigma_white`. This produces realistic "slow drift + fast jitter" — the 1/f component creates wandering baseline visible on the oscilloscope, white noise adds high-frequency jitter. Both scale with the user's noise level control.

### Signal Class (`workers/physics/signal.ts`)

Models a voltage source with second-order edge response.

**State-space RLC model** (replaces single-pole RC filter):
```ts
// Two state variables: voltage (x1) and its derivative (x2)
// Per sub-step (dt = 0.0001):
const error = targetVoltage + noise - this.x1;
this.x2 += (wn * wn * error - 2 * zeta * wn * this.x2) * dt;
this.x1 += this.x2 * dt;
this.voltage = clamp(this.x1, clampMin, systemMax);
```

**Parameters** (per signal type):
- Input signals (D, CLK): `zeta = 0.8` (slightly underdamped, ~1.5% overshoot), `f_ring = 80 Hz`
- Output signal (Q): `zeta = 0.6` (more underdamped, ~9.5% overshoot), `f_ring = 120 Hz`

This produces realistic edge shapes: fast rise with slight overshoot and ringing that settles in ~5ms. Overshoot formula: `exp(-pi * zeta / sqrt(1 - zeta²)) * 100%`.

**Constructor** receives `SignalConfig` (immutable):
```ts
interface SignalConfig {
  baseHigh: number;
  baseLow: number;
  zeta: number;       // damping ratio
  ringFreq: number;   // natural frequency (Hz)
  clampMin: number;
  clampMax: number;
}
```

### Clock Generator (`workers/physics/clock.ts`)

Generates clock signal with **phase jitter**:

```ts
// Phase advances each sub-step:
this.phase += this.speed * dt;

// Edge detection with jitter:
// When phase crosses edge boundary (0 or PI), apply Gaussian offset
if (crossesEdge(oldPhase, this.phase)) {
  const jitteredPhase = this.phase + gaussian(0, this.jitterRms);
  this.signal.targetLogic = sin(jitteredPhase) > 0 ? 1 : 0;
}
```

**Jitter parameter**: `jitter_rms` defaults to ~2% of clock period. Creates variable period lengths. This naturally causes occasional setup/hold window violations, making metastability **spontaneous** — without requiring the user to manually place D in the undefined zone.

### D Flip-Flop (`workers/physics/flip-flop.ts`)

Models a real flip-flop with timing parameters and proper metastability.

**Timing parameters** (in `TimingConfig`):
```ts
interface TimingConfig {
  tSetup: number;    // Setup time: D must be stable before CLK edge (default 3ms)
  tHold: number;     // Hold time: D must remain stable after CLK edge (default 1ms)
  tCQ: number;       // Clock-to-Q propagation delay (default 2ms)
  tauMeta: number;   // Metastability resolution time constant (default 5ms)
}
```

Values are scaled to visible simulation time (not real nanoseconds) so that timing violations and metastability are observable at default clock speed.

**Rising edge detection**: Schmitt trigger with hysteresis (preserved):
```
if clkVoltage > logicHighMin → 1
if clkVoltage < logicLowMax → 0
else → hold previous state (hysteresis band)
```

**Setup/hold violation detection**: On a CLK rising edge, examine D's recent history:
- Track D's logic state over a rolling window
- **Setup violation**: D changed logic state within `[edge - t_su, edge]`
- **Hold violation**: D changes logic state within `[edge, edge + t_h]`
- Either violation → enter metastable state

**Propagation delay (t_CQ)**: After a valid (non-metastable) clock edge captures D, Q's target logic doesn't change immediately. Instead, schedule the Q transition for `t_CQ` later. A pending transition queue handles this.

**Metastability resolution** (the major improvement):

When a setup/hold violation occurs:
1. Q output drives toward **mid-rail voltage** (~VDD/2 = 1.25V) — the unstable equilibrium
2. Q's Signal enters a special metastable mode with very low damping (`zeta = 0.2`), producing visible oscillations around mid-rail
3. Resolution time sampled from exponential distribution: `t_resolve = -tau * ln(random())`
4. After `t_resolve` elapses, Q collapses to 0 or 1 (random) and transitions normally with regular damping

This means a student watching the oscilloscope will **see** metastability: Q goes to ~1.25V, wobbles visibly, then snaps to a logic level — exactly what happens on a real oscilloscope probing a metastable flip-flop.

### Waveform Buffer (`workers/physics/waveform-buffer.ts`)

Preserved from current codebase:
- Ring buffer: 3 x Float32Array, length 2048 (power of 2)
- O(1) wraparound via bitwise AND: `(ptr + 1) & (length - 1)`
- Push, reset, read pointer access

With 10kHz sub-stepping, data is pushed per sub-step (not per frame), giving ~80x higher temporal resolution in the waveform display than the current implementation.

### Immutable Configuration

All physics config is immutable and injected:

```ts
interface PhysicsConfig {
  readonly voltage: Readonly<VoltageSpecConfig>;
  readonly simulation: Readonly<SimulationConfig>;
  readonly timing: Readonly<TimingConfig>;
}
```

Config updates: main thread sends new config via Comlink → physics worker creates a new frozen `PhysicsConfig` → reconstructs or reconfigures engine components. No mutation of shared objects.

### Why Physics Stays on CPU (Not Compute Shader)

Considered and rejected WebGPU Compute Shaders. Reasons:
- Only 3 signals with sequential frame-to-frame dependencies (RLC state, Schmitt trigger state, metastability state). No parallelism to exploit.
- Even with sub-stepping (~800 ops per tick at 120Hz), CPU cost is <10us. GPU dispatch overhead (5-50us) exceeds the computation.
- `mapAsync()` readback latency (1-3 frames) would make UI voltage display stale.
- 1/f noise generation (Voss-McCartney) is inherently sequential (counter-based octave updates).

Compute shaders are the right tool for massive parallelism (particle systems, fluid grids, per-pixel processing). This simulation is 3 tightly coupled sequential state machines — CPU is the correct fit.

### File Structure (physics)

```
workers/physics/
├── physics.worker.ts       # Worker entry, Comlink.expose(), accumulator tick loop
├── engine.ts               # SimulationEngine: orchestrates clock, signals, DFF, buffer
├── noise.ts                # NoiseGenerator: Marsaglia white + Voss-McCartney 1/f
├── signal.ts               # Signal: state-space RLC, noise injection, clamping
├── clock.ts                # ClockGenerator: phase tracking, jitter, edge detection
├── flip-flop.ts            # DFlipFlop: Schmitt trigger, setup/hold, t_CQ, metastability
└── waveform-buffer.ts      # WaveformBuffer: ring buffer (Float32Array)
```

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
- `noise.test.ts`: White noise distribution (mean ~0, std ~sigma_white), 1/f spectral slope verification (power decreases ~linearly with log-frequency over 8 octaves), composite noise scaling with user control
- `signal.test.ts`: RLC step response overshoot (~9.5% for zeta=0.6), settling time, voltage clamping at bounds, frame-rate independence (same result at 30fps vs 120fps via sub-stepping)
- `clock.test.ts`: Frequency accuracy, jitter distribution (mean ~0, std ~jitter_rms), duty cycle within tolerance
- `flip-flop.test.ts`: Rising edge captures D, falling edge ignores, Schmitt trigger hysteresis band, setup violation triggers metastability, hold violation triggers metastability, t_CQ delay (Q changes after delay, not immediately), metastability resolution (~50% distribution over 1000 runs), resolution time follows exponential distribution, async reset overrides metastable state

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
