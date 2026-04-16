# D-FlipFlop Simulation: React + WebGPU Rewrite

Complete ground-up rewrite of the D flip-flop physics simulation. Replaces the imperative vanilla TypeScript + PixiJS + SCSS codebase with a modern declarative stack: React 19, Tailwind CSS v4, raw WebGPU/WGSL, multi-Worker Actor Model, and Zustand state management.

The architecture is built on a **generic circuit graph model** so that future demos (adder, counter, shift register) require only new component classes and circuit definitions — zero engine changes.

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
┌───────────────────────────────────────────────────────────┐
│                    React (Main Thread)                     │
│                                                           │
│  ┌─────────┐  ┌───────────┐  ┌──────┐  ┌──────────────┐ │
│  │ Zustand  │  │ shadcn/ui │  │Lingui│  │ Circuit      │ │
│  │ Stores   │  │ Components│  │ i18n │  │ Definitions  │ │
│  └────┬─────┘  └─────┬─────┘  └──────┘  └──────┬───────┘ │
│       │              │                          │         │
│  ┌────┴──────────────┴──────────────────────────┴───┐    │
│  │  useSimulation(circuitDef) — React hook           │    │
│  │  Owns Worker lifecycle, Comlink proxies            │    │
│  │  Sends circuit definition to Physics Worker        │    │
│  │  Subscribes to probe voltage updates               │    │
│  └──────┬────────────────────┬──────────────────────┘    │
└─────────┼────────────────────┼───────────────────────────┘
          │ Comlink            │ Comlink
          │                    │
┌─────────┴──────────┐   ┌────┴────────────────┐
│ Physics Worker      │   │ Render Worker        │
│                     │   │                      │
│ CircuitGraph        │   │ WebGPU Device        │
│   Components[]      │   │ WGSL Shaders         │
│   Nets[]            │   │ OffscreenCanvas x2   │
│   Levelized eval    │   │ N-channel rendering  │
│ WaveformBuffer (N)  │   │ Analog + Digital     │
└────────┬────────────┘   └────────┬─────────────┘
         │  MessageChannel         │
         └─────────────────────────┘
```

**Main Thread (React)**: UI rendering, user interaction, Zustand state. Holds the circuit definition (data) and passes it to Workers. Zero physics computation, zero canvas rendering. UI components are driven by the circuit definition's `controls` and `probes` arrays — not hardcoded for a specific circuit.

**Physics Worker**: Receives a `CircuitDefinition`, instantiates the circuit graph (components, nets, levelized evaluation order), and runs the simulation loop via `setTimeout` at ~120Hz. Exposes a generic API via Comlink:
- `loadCircuit(def)` — instantiate circuit graph from definition
- `setParam(componentId, key, value)` — set parameter on any component
- `setSettings(specs)` — voltage threshold updates (global)
- Status callback: pushes probed net voltages to main thread at ~20Hz

**Render Worker**: Owns the WebGPU device, pipeline, and both OffscreenCanvases. Runs at display vsync via `requestAnimationFrame`. Accepts **N channels** (not hardcoded 3). Exposes an API via Comlink:
- `init(canvases, width, height, dpr, probes)` — canvas setup + WebGPU init with N-channel config (labels, colors, offsets)
- `resize(width, height, dpr)` — responsive resize
- `setShaderStyle(style)` — switch between "clean", "glow", "phosphor" WGSL fragment shaders
- `updateProbes(probes)` — reconfigure displayed channels

**Physics → Render**: Direct communication via `MessageChannel`. Physics Worker sends frame data as a single `Float32Array` (N channels interleaved, length = N * bufferLength) + write pointer + channel count. Render Worker consumes the latest frame on its next `requestAnimationFrame`.

### Data Flow

```
User loads circuit (or app starts with default DFF circuit)
  → CircuitDefinition passed to useSimulation()
  → Comlink → Physics Worker: loadCircuit(def)
  → Comlink → Render Worker: init(canvases, probes from def)

User interaction
  → Zustand store update
  → useSimulation effect
  → Comlink → Physics Worker: setParam(componentId, key, value)

Physics Worker tick loop:
  → accumulator sub-stepping at 10kHz
  → per sub-step:
      1. Update stimulus sources (clock, inputs)
      2. Set sequential outputs (Q) from captured values
      3. Evaluate combinational gates in level order
      4. Sequential elements: edge detect, setup/hold, capture
      5. Push probed voltages to ring buffer
  → MessageChannel.postMessage(frameData) → Render Worker
  → postMessage(probeVoltages) → Main Thread → Zustand

Render Worker frame loop (rAF):
  → receive latest frame data (N channels)
  → device.queue.writeBuffer() → GPU storage buffer (N channels)
  → encode render pass (waveform pipeline, N instances)
  → encode render pass (digital pipeline, N instances)
  → submit + present
```

## WebGPU Rendering Pipeline

### Overview

Two separate render pipelines targeting two OffscreenCanvases (analog waveform and digital logic). Both use the same underlying technique: triangle strip extrusion for thick, anti-aliased lines.

### Analog Waveform Pipeline

**Storage buffer**: Ring buffer data — N channels x 2048 samples as Float32 (interleaved: `channel_0[0..2047], channel_1[0..2047], ...`). Updated each frame via `device.queue.writeBuffer()`. Buffer size = `N * 2048 * 4` bytes. N is dynamic — determined by the circuit definition's probe count.

**Uniform buffer**: Canvas dimensions, line width, voltage scale (30px/V), write pointer offset, voltage headroom, channel count N.

**Per-channel config buffer**: Array of `{ yOffset: f32, color: vec4<f32> }` for each channel. Updated when probes change. Channel Y-offsets are computed dynamically: evenly spaced across canvas height, or using a layout algorithm that groups related signals.

**Vertex shader** (`waveform.vert.wgsl`):
- Input: `vertex_index` (0..4095 per channel), `instance_index` (0..N-1 for channel selection)
- Reads channel config (yOffset, color) from per-channel buffer using `instance_index`
- Reads current sample and adjacent sample from storage buffer via: `let idx = (ringOffset + vertex_index / 2u) % 2048u; let bufferIdx = instance_index * 2048u + idx;`
- Computes line direction between adjacent points
- Derives perpendicular normal
- Offsets vertex position by +/- half-thickness along normal (even/odd vertex_index)
- Outputs position and channel color

**Fragment shaders** (three styles, switchable at runtime by swapping the pipeline):

1. **Clean** (`waveform-clean.wgsl`): Solid channel color with smooth edge alpha falloff for anti-aliasing. Minimal computation.

2. **Glow** (`waveform-glow.wgsl`): Bright core (full channel color) with a soft neon bloom halo. Uses distance-from-center-line to compute alpha: core is opaque, edges fade with Gaussian falloff. CRT/retro oscilloscope aesthetic.

3. **Phosphor** (`waveform-phosphor.wgsl`): Brightness decays based on sample age (distance from write pointer in ring buffer). Newest samples render at full brightness, older samples fade toward a dim minimum. Simulates phosphor persistence on a real CRT oscilloscope. The age factor is passed from the vertex shader as a varying.

All three share the same vertex shader (triangle strip extrusion). Pipeline switching is done by pre-compiling all three `GPURenderPipeline` objects on init and selecting the active one per frame based on `shaderStyle`.

**Draw call**: `draw(4096, N)` — 2048 sample points x 2 vertices per point, N channel instances. N is the probe count from the circuit definition.

**Static elements**: Threshold dashed lines (VIH, VIL) and channel labels rendered as additional draw calls or a lightweight second pipeline. Labels and colors are sourced from the probe configuration.

### Digital Logic Pipeline

**Same storage buffer** as analog pipeline (shared).

**Vertex shader** (`digital.wgsl`):
- Reads sample, applies threshold: `sample > logicHighMin ? yHigh : yLow`
- Creates step-function waveform (discrete jumps)
- Triangle strip extrusion for line thickness
- Uses `instance_index` to select channel (same N-channel pattern)

**Fragment shader**: Uses the same three styles as analog pipeline (clean/glow/phosphor). Same pipeline switching mechanism.

**Draw call**: `draw(4096, N)` — same geometry, different Y mapping. N channels.

### GPU Resource Lifecycle

- `GPUDevice`, `GPUCanvasContext`: Created once on Worker init
- `GPURenderPipeline`: Compiled once per pipeline type, reused every frame
- Storage buffer (`STORAGE | COPY_DST`): Sized to `N * 2048 * 4` bytes on circuit load, recreated if N changes, updated every frame
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
│   │   ├── OscilloscopePanel.tsx  # Container: canvas refs, resize observer, auto-height
│   │   ├── WaveformCanvas.tsx     # Analog waveform canvas element
│   │   ├── DigitalCanvas.tsx      # Digital logic canvas element
│   │   └── Legend.tsx             # Channel legend (driven by probes[], N channels)
│   ├── schematic/
│   │   ├── CircuitSchematic.tsx   # Interactive SVG circuit topology (driven by circuit def)
│   │   ├── SchematicNode.tsx      # Single component in schematic (DFF, gate, source)
│   │   └── SchematicWire.tsx      # Wire between nodes (highlights with voltage color)
│   ├── controls/
│   │   ├── ControlPanel.tsx       # Renders controls from circuit def's controls[]
│   │   ├── ParamSlider.tsx        # Generic slider control (noise, speed, etc.)
│   │   ├── ParamToggle.tsx        # Generic toggle control (input signals)
│   │   ├── ParamMomentary.tsx     # Generic momentary button (reset)
│   │   ├── ShaderStyleToggle.tsx  # Clean/Glow/Phosphor toggle group
│   │   └── ProbeSelector.tsx      # Toggle which nets are displayed on oscilloscope
│   ├── nav/
│   │   ├── CircuitSelector.tsx    # Tab/dropdown to switch between circuit demos
│   │   └── Toolbar.tsx            # Top toolbar: circuit selector, settings, about, lang
│   ├── settings/
│   │   └── SettingsSheet.tsx      # Voltage parameter editing sidebar
│   ├── about/
│   │   └── AboutSheet.tsx         # About sidebar (content from circuit def's description)
│   ├── fallback/
│   │   └── WebGPUUnavailable.tsx  # Fallback for unsupported browsers
│   └── layout/
│       └── AppLayout.tsx          # Dashboard grid layout
│
├── stores/
│   ├── simulation-store.ts        # Zustand: generic circuit params, probe voltages
│   ├── settings-store.ts          # Zustand: voltage spec config (global)
│   └── ui-store.ts                # Zustand: sidebar state, shader style, locale
│
├── hooks/
│   ├── useSimulation.ts           # Worker lifecycle, Comlink proxies, circuit loading
│   ├── useResizeObserver.ts       # Canvas container resize tracking
│   └── useProbeVoltages.ts        # Subscribes to probed net voltage updates
│
├── workers/
│   ├── physics/
│   │   ├── physics.worker.ts      # Worker entry, Comlink.expose(), accumulator tick loop
│   │   ├── engine.ts              # SimulationEngine: circuit graph, levelized evaluation
│   │   ├── graph.ts               # CircuitGraph: component/net instantiation, topological sort
│   │   ├── components/
│   │   │   ├── base.ts            # Component, CombinationalComponent, SequentialComponent interfaces
│   │   │   ├── clock-source.ts    # ClockSource: phase tracking, jitter
│   │   │   ├── signal-source.ts   # SignalSource: user-controlled input
│   │   │   ├── flip-flop.ts       # DFlipFlop: Schmitt trigger, setup/hold, metastability
│   │   │   ├── and-gate.ts        # ANDGate: 2-input combinational (day 2)
│   │   │   ├── or-gate.ts         # ORGate: 2-input combinational (day 2)
│   │   │   ├── xor-gate.ts        # XORGate: 2-input combinational (day 2)
│   │   │   ├── not-gate.ts        # NOTGate: inverter (day 2)
│   │   │   └── registry.ts        # ComponentRegistry: maps type string → constructor
│   │   ├── signal.ts              # Signal: state-space RLC model, noise injection
│   │   ├── noise.ts               # NoiseGenerator: Marsaglia white + Voss-McCartney 1/f
│   │   └── waveform-buffer.ts     # WaveformBuffer: N-channel ring buffer (Float32Array)
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
├── circuits/
│   ├── dff.ts                     # D Flip-Flop circuit definition (day 1)
│   └── adder.ts                   # 4-Bit Accumulator circuit definition (day 2)
│
├── lib/
│   ├── constants.ts               # Colors (Catppuccin Macchiato), VoltageSpecs, Simulation, Layout, Timing
│   ├── types.ts                   # Circuit model types: Component, Port, Net, Probe, CircuitDefinition
│   ├── validation.ts              # Zod schemas for voltage spec, timing, and circuit definition validation
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
    │   ├── flip-flop.test.ts      # Edge detection, setup/hold, t_CQ, metastability
    │   └── graph.test.ts          # Levelization, net propagation, circuit validation
    ├── stores/
    │   └── simulation-store.test.ts
    ├── components/
    │   ├── ControlPanel.test.tsx   # Control interaction tests
    │   └── SettingsSheet.test.tsx  # Validation, save/reset
    └── setup.ts                   # Vitest setup (happy-dom, testing library matchers)
```

## Zustand Stores

### simulation-store.ts

Generic simulation state driven by the active circuit definition:

```ts
interface SimulationState {
  // Active circuit
  circuitId: string;                          // e.g., "dff", "adder"

  // Component parameters — keyed by "componentId.paramKey"
  // Populated from circuit definition's controls[]
  params: Record<string, number | boolean>;   // e.g., { "clk_src.speed": 30, "d_src.targetLogic": false }

  // Probed voltages (updated ~20Hz from Physics Worker)
  // Keyed by probe netId, values are current voltage
  voltages: Record<string, number>;           // e.g., { "clk_net": 1.82, "d_net": 0.15, "q_net": 1.90 }

  // Actions
  setCircuit: (id: string) => void;
  setParam: (componentId: string, key: string, value: number | boolean) => void;
  updateVoltages: (v: Record<string, number>) => void;
}
```

This store is fully generic — no DFF-specific fields. Adding a new circuit doesn't change the store interface.

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
  activeProbeIds: Set<string>;     // which probe netIds are displayed on oscilloscope
  settingsOpen: boolean;
  aboutOpen: boolean;
  locale: "en" | "zh-CN";

  setShaderStyle: (s: "clean" | "glow" | "phosphor") => void;
  toggleProbe: (netId: string) => void;
  resetProbes: (probes: Probe[]) => void;  // reset to all-on when circuit changes
  toggleSettings: () => void;
  toggleAbout: () => void;
  setLocale: (l: "en" | "zh-CN") => void;
}
```

## React Component Design

### UI Layout

Dashboard-style layout designed to scale from 3 channels (DFF) to 10+ channels (adder). The layout adapts to circuit complexity.

```
Desktop (lg+):
┌───────────────────────────────────────────────────────────────┐
│ Toolbar: [DFF ▾ | 4-Bit Acc ▾]    [Clean|Glow|Phos]  [⚙][i][🌐] │
├────────────────────────────────┬──────────────────────────────┤
│                                │                              │
│  Digital Logic View            │  Circuit Schematic (SVG)     │
│  ┌────────────────────────┐   │  ┌──────────────────────┐   │
│  │  N-channel square waves │   │  │  [CLK]──┐            │   │
│  └────────────────────────┘   │  │         ├──[DFF]──Q  │   │
│                                │  │  [D]────┘            │   │
│  Real-time Oscilloscope        │  └──────────────────────┘   │
│  ┌────────────────────────┐   │                              │
│  │  N-channel analog       │   │  Controls                   │
│  │  waveforms with         │   │  ┌──────────────────────┐   │
│  │  threshold markers      │   │  │ Noise     [━━━●━━━]  │   │
│  └────────────────────────┘   │  │ Speed     [━━━━━●━]  │   │
│  Legend: ● CLK  ● D  ● Q     │  │ Input D   [ON/OFF]   │   │
│                                │  │ Reset     [HOLD]     │   │
│                                │  │ Probes    [☑CLK ☑D…] │   │
│                                │  └──────────────────────┘   │
└────────────────────────────────┴──────────────────────────────┘

Mobile (< lg):
┌─────────────────────────┐
│ Toolbar (sticky)        │
├─────────────────────────┤
│ Digital Logic View      │
│ Oscilloscope            │
│ Legend                  │
├─────────────────────────┤
│ Circuit Schematic       │
├─────────────────────────┤
│ Controls                │
└─────────────────────────┘
```

**Key layout decisions:**
- **Toolbar** replaces the old floating buttons. Contains circuit selector (tabs or dropdown), shader style toggle, settings/about/language buttons. Always visible.
- **Oscilloscope panel** takes the majority of screen width — this is the primary output. Canvas height scales dynamically with probe count (each channel gets a fixed row height).
- **Circuit schematic** (new) — interactive SVG showing the circuit topology. Components are labeled boxes, wires connect ports. Active signals highlight in their channel color. Driven entirely by `CircuitDefinition`.
- **Controls panel** — renders dynamic controls from `circuitDef.controls[]`. Includes a **probe selector** (checkbox list) for circuits with many nets — user toggles which nets appear on the oscilloscope.
- **Responsive**: `grid-cols-1` stacked on mobile, `grid-cols-[1fr_20rem]` on desktop. Oscilloscope always takes priority.

### CSS Subgrid Strategy

The dashboard uses **CSS Subgrid** (Tailwind v4: `grid-rows-subgrid`) to align nested children across the two-column layout. This continues the project's existing Subgrid pattern (the current codebase already uses it).

```
<main> — parent grid
  grid-template-columns: 1fr 20rem       (desktop)
  grid-template-rows: auto 1fr auto      (toolbar / content / legend)

  <OscilloscopePanel> — spans col 1, inherits row tracks via subgrid
    grid-row: 1 / -1
    display: grid
    grid-template-rows: subgrid           ← aligns digital/analog/legend rows
                                            with schematic/controls/probes rows

  <aside> — spans col 2, inherits row tracks via subgrid
    grid-row: 1 / -1
    display: grid
    grid-template-rows: subgrid           ← schematic/controls/probes align
                                            with oscilloscope internal rows
```

**Where Subgrid is used:**
1. **Main content area**: Two columns share row tracks — oscilloscope rows align with sidebar sections
2. **Control groups**: `label + input` pairs within `ControlPanel` use `grid-cols-subgrid` to align labels and inputs across all control groups
3. **Probe selector**: Checkbox rows align with the control group grid
4. **Settings form**: Voltage spec `label + input` pairs use subgrid for consistent alignment

**Tailwind v4 classes:**
- `grid-rows-subgrid` — inherit parent's row tracks
- `grid-cols-subgrid` — inherit parent's column tracks
- `row-span-full` — span all rows of the parent
- Standard `grid`, `grid-cols-*`, `grid-rows-*` for the parent grid

This eliminates the need for hardcoded heights or JavaScript-based height synchronization between panels. The browser's grid engine handles alignment natively.

### Component Tree

All components are **circuit-agnostic** — driven by `CircuitDefinition` data.

```
<App>
  <LinguiProvider>
    <AppLayout>
      <Toolbar>
        <CircuitSelector circuits={[dffCircuit, adderCircuit]} />
        <ShaderStyleToggle />
        <SettingsButton /> <AboutButton /> <LocaleToggle />
      </Toolbar>

      <main className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-4">
        {/* Left: Oscilloscope */}
        <OscilloscopePanel probes={circuitDef.probes}>
          <DigitalCanvas />
          <WaveformCanvas />
          <Legend probes={activeProbes} />
        </OscilloscopePanel>

        {/* Right: Schematic + Controls */}
        <aside className="flex flex-col gap-4">
          <CircuitSchematic circuit={circuitDef}>
            {circuitDef.components.map(comp =>
              <SchematicNode />
            )}
          </CircuitSchematic>

          <ControlPanel controls={circuitDef.controls}>
            {circuitDef.controls.map(ctrl =>
              <ParamSlider /> | <ParamToggle /> | <ParamMomentary />
            )}
          </ControlPanel>

          <ProbeSelector
            probes={circuitDef.probes}
            active={activeProbes}
            onToggle={toggleProbe}
          />
        </aside>
      </main>

      <SettingsSheet />
      <AboutSheet description={circuitDef.description} />
    </AppLayout>
  </LinguiProvider>
</App>
```

### Key Hook: useSimulation

```ts
function useSimulation(
  circuitDef: CircuitDefinition,
  activeProbes: Probe[],             // subset of circuitDef.probes user has enabled
  waveformRef: RefObject<HTMLCanvasElement>,
  digitalRef: RefObject<HTMLCanvasElement>,
): void {
  // 1. On mount: create Physics Worker + Render Worker
  // 2. Wrap both with Comlink.wrap<PhysicsAPI>() and Comlink.wrap<RenderAPI>()
  // 3. Create MessageChannel, transfer port1 to Physics, port2 to Render
  // 4. Send circuitDef to Physics Worker: physicsProxy.loadCircuit(def)
  // 5. Transfer OffscreenCanvases + activeProbes to Render Worker
  // 6. Subscribe to Zustand store params:
  //    - params changes → physicsProxy.setParam(componentId, key, value)
  //    - settings changes → physicsProxy.setSettings()
  //    - shaderStyle changes → renderProxy.setShaderStyle()
  // 7. Physics Worker posts probe voltages → Comlink → updateVoltages()
  // 8. On circuitDef change: teardown + rebuild both Workers
  // 9. On activeProbes change: renderProxy.updateProbes(activeProbes)
  // 10. On unmount: terminate both Workers, clean up subscriptions
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
  --color-accent-green: #a6da95;
  --color-accent-blue: #8aadf4;
  --color-accent-red: #ed8796;
  --color-accent-yellow: #eed49f;
  --color-accent-mauve: #c6a0f6;
  --color-accent-teal: #7dc4e4;
  --color-accent-lavender: #b7bdf8;
  --color-overlay: #363a4f;
}
```

Dark theme only. Responsive grid: single column on mobile, two columns on desktop.

## Circuit Graph Model

The simulation is built on a generic circuit graph that separates **circuit topology** (what components exist, how they connect) from **simulation mechanics** (physics stepping, rendering). This means adding new demos requires only new component classes and a circuit definition — the engine, renderer, and UI are circuit-agnostic.

### Core Type Interfaces (`lib/types.ts`)

```ts
// Port: a named connection point on a component, carrying a voltage
interface Port {
  readonly name: string;
  voltage: number;
}

// Base component interface
interface Component {
  readonly id: string;
  readonly kind: "combinational" | "sequential";
  readonly inputs: ReadonlyMap<string, Port>;
  readonly outputs: ReadonlyMap<string, Port>;
}

// Combinational: output = f(inputs), evaluated every sub-step in level order
interface CombinationalComponent extends Component {
  kind: "combinational";
  evaluate(): void;
}

// Sequential: state changes on clock edges, has internal Signal with RLC/noise
interface SequentialComponent extends Component {
  kind: "sequential";
  clock(dt: number): void;   // edge detection, setup/hold, state capture
  update(dt: number): void;  // signal physics (RLC response, noise)
}

// Net: single-driver wire connecting one output port to N input ports
interface Net {
  readonly id: string;
  readonly driver: { componentId: string; port: string };
  readonly loads: Array<{ componentId: string; port: string }>;
  voltage: number;  // driven by the output port
}

// Probe: marks a net for oscilloscope display
interface Probe {
  readonly netId: string;
  readonly label: string;
  readonly color: string;
  readonly channelIndex: number;
}

// Control: a UI element bound to a component parameter
interface ControlDef {
  readonly type: "slider" | "toggle" | "momentary";
  readonly targetComponent: string;  // componentId
  readonly param: string;            // parameter key on the component
  readonly label: string;
  readonly min?: number;
  readonly max?: number;
  readonly defaultValue?: number | boolean;
}

// Circuit definition: complete declarative description of a circuit
interface CircuitDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly components: ComponentDef[];
  readonly nets: NetDef[];
  readonly probes: Probe[];
  readonly controls: ControlDef[];
}
```

### Circuit Graph Instantiation (`workers/physics/graph.ts`)

`CircuitGraph` takes a `CircuitDefinition` and:
1. Instantiates component objects via `ComponentRegistry` (type string → constructor)
2. Creates `Net` objects and wires output ports to input ports
3. Separates components into combinational and sequential sets
4. **Levelizes** combinational components via topological sort:
   - Primary inputs (SignalSource outputs) and sequential outputs (DFF Q) = level 0
   - Each gate's level = `max(level of each input's driver) + 1`
   - Evaluate in ascending level order → guarantees all inputs resolved before gate evaluates
5. Detects combinational feedback loops (rejects with error)

### Evaluation Order (per sub-step)

```
1. Sequential components: update() — advance Signal physics (RLC, noise)
2. Sequential components: clock() — edge detection, setup/hold check, capture D
3. Propagate sequential outputs to nets
4. Evaluate combinational gates in level order
5. Propagate combinational outputs to nets
6. Collect probed net voltages → push to WaveformBuffer
```

### DFF Demo Circuit Definition (`circuits/dff.ts`)

```ts
export const dffCircuit: CircuitDefinition = {
  id: "dff",
  name: "D Flip-Flop",
  description: "Single D flip-flop with clock, demonstrating edge triggering, noise, and metastability",
  components: [
    { type: "ClockSource", id: "clk", params: { speed: 30, jitterRms: 0.02 } },
    { type: "SignalSource", id: "d", params: { baseHigh: 1.5, baseLow: 0.1 } },
    { type: "DFlipFlop", id: "dff0", params: { /* timing defaults */ } },
  ],
  nets: [
    { id: "clk_net", driver: { componentId: "clk", port: "out" },
      loads: [{ componentId: "dff0", port: "clk" }] },
    { id: "d_net", driver: { componentId: "d", port: "out" },
      loads: [{ componentId: "dff0", port: "d" }] },
    { id: "q_net", driver: { componentId: "dff0", port: "q" }, loads: [] },
  ],
  probes: [
    { netId: "clk_net", label: "CLK", color: "#a6da95", channelIndex: 0 },
    { netId: "d_net", label: "D", color: "#8aadf4", channelIndex: 1 },
    { netId: "q_net", label: "Q", color: "#ed8796", channelIndex: 2 },
  ],
  controls: [
    { type: "toggle", targetComponent: "d", param: "targetLogic", label: "Input D", defaultValue: false },
    { type: "slider", targetComponent: "clk", param: "speed", label: "Clock Speed", min: 1, max: 100, defaultValue: 30 },
    { type: "slider", targetComponent: "global", param: "noise", label: "Noise Level", min: 0, max: 100, defaultValue: 10 },
    { type: "momentary", targetComponent: "dff0", param: "reset", label: "Reset (Hold)", defaultValue: false },
  ],
};
```

### Future: 4-Bit Accumulator (`circuits/adder.ts`)

Adding an adder requires **zero engine changes** — only new component classes and a new definition:

```ts
export const adderCircuit: CircuitDefinition = {
  id: "adder-4bit",
  name: "4-Bit Accumulator",
  description: "4-bit register with ripple-carry adder, accumulating on each clock cycle",
  components: [
    { type: "ClockSource", id: "clk", params: { ... } },
    // 4 input signal sources (A[3:0])
    { type: "SignalSource", id: "a0", params: { ... } },
    { type: "SignalSource", id: "a1", params: { ... } },
    { type: "SignalSource", id: "a2", params: { ... } },
    { type: "SignalSource", id: "a3", params: { ... } },
    // 4 full adders
    { type: "FullAdder", id: "fa0", params: {} },
    { type: "FullAdder", id: "fa1", params: {} },
    { type: "FullAdder", id: "fa2", params: {} },
    { type: "FullAdder", id: "fa3", params: {} },
    // 4 D flip-flops (register)
    { type: "DFlipFlop", id: "reg0", params: { ... } },
    { type: "DFlipFlop", id: "reg1", params: { ... } },
    { type: "DFlipFlop", id: "reg2", params: { ... } },
    { type: "DFlipFlop", id: "reg3", params: { ... } },
  ],
  nets: [
    // Clock to all DFFs
    { id: "clk_net", driver: { componentId: "clk", port: "out" },
      loads: [
        { componentId: "reg0", port: "clk" },
        { componentId: "reg1", port: "clk" },
        { componentId: "reg2", port: "clk" },
        { componentId: "reg3", port: "clk" },
      ] },
    // A inputs → full adder A ports
    // DFF Q outputs → full adder B ports (feedback)
    // Full adder Sum → DFF D inputs
    // Carry chain: fa0.cout → fa1.cin → fa2.cin → fa3.cin
    // ... (full net list omitted for brevity)
  ],
  probes: [
    // User selects which nets to observe — e.g., CLK + 4 sum outputs + carry
    { netId: "clk_net", label: "CLK", color: "#a6da95", channelIndex: 0 },
    { netId: "sum0_net", label: "SUM[0]", color: "#8aadf4", channelIndex: 1 },
    { netId: "sum1_net", label: "SUM[1]", color: "#7dc4e4", channelIndex: 2 },
    { netId: "sum2_net", label: "SUM[2]", color: "#b7bdf8", channelIndex: 3 },
    { netId: "sum3_net", label: "SUM[3]", color: "#c6a0f6", channelIndex: 4 },
    { netId: "cout_net", label: "CARRY", color: "#ed8796", channelIndex: 5 },
  ],
  controls: [ /* sliders, toggles for A[3:0] inputs, noise, speed, reset */ ],
};
```

### Component Registry (`workers/physics/components/registry.ts`)

DI-aware factory that maps type strings to constructors. Receives shared dependencies (config, RNG) and threads them into component constructors:

```ts
interface ComponentDeps {
  config: PhysicsConfig;
  rng: RngFn;
}

class ComponentRegistry {
  private factories = new Map<string, (id: string, params: Record<string, unknown>, deps: ComponentDeps) => Component>();

  register(type: string, factory: ComponentFactory): void { ... }
  create(type: string, id: string, params: Record<string, unknown>, deps: ComponentDeps): Component { ... }
}

// Default registry:
const registry = new ComponentRegistry();
registry.register("ClockSource", (id, params, deps) => new ClockSource(id, params, deps.config, deps.rng));
registry.register("SignalSource", (id, params, deps) => new SignalSource(id, params, deps.config));
registry.register("DFlipFlop", (id, params, deps) => new DFlipFlop(id, params, deps.config, deps.rng));
// Day 2:
registry.register("ANDGate", (id, params, _deps) => new ANDGate(id, params));
registry.register("ORGate", (id, params, _deps) => new ORGate(id, params));
registry.register("XORGate", (id, params, _deps) => new XORGate(id, params));
registry.register("NOTGate", (id, params, _deps) => new NOTGate(id, params));
registry.register("FullAdder", (id, params, _deps) => new FullAdder(id, params));
```

Adding a new component type: implement the `Component` interface, register a factory function, use it in a circuit definition. No other files change. Tests can create a custom registry with mock components.

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

Receives `RngFn` via constructor injection — never calls `Math.random()` directly. This makes noise generation fully deterministic when a seeded RNG is provided.

```ts
class NoiseGenerator {
  constructor(
    private readonly rng: RngFn,      // injected — Math.random in prod, seeded in tests
    private sigmaWhite: number,
    private sigmaFlicker: number,     // default: 4 * sigmaWhite
    private readonly octaves: number = 8,
  ) { ... }

  setSigma(sigmaWhite: number): void { ... }  // called when user changes noise slider
  sample(): number { ... }                     // returns composite noise value
}
```

**White noise** — Marsaglia Polar Method (uses injected `rng`):
```
u = rng() * 2 - 1; v = rng() * 2 - 1
rejection sample until s = u²+v² < 1
mul = sqrt(-2 * log(s) / s)
yield u*mul (cache v*mul for next call)
```

**1/f (flicker) noise** — Voss-McCartney algorithm, 8 octaves:
```
8 Gaussian generators (each initialized via rng), updated at halving rates
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

**Constructor** receives `SignalConfig` (immutable) and a `NoiseGenerator` instance (injected):
```ts
interface SignalConfig {
  baseHigh: number;
  baseLow: number;
  zeta: number;       // damping ratio
  ringFreq: number;   // natural frequency (Hz)
  clampMin: number;
  clampMax: number;
}

class Signal {
  constructor(
    private readonly config: SignalConfig,
    private readonly noise: NoiseGenerator,  // injected — tests can pass zero-noise
  ) { ... }
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

Generalized for N channels (determined by circuit definition's probe count):
- Ring buffer: **N x Float32Array**, length 2048 (power of 2)
- N set at construction time from `circuitDef.probes.length`
- O(1) wraparound via bitwise AND: `(ptr + 1) & (length - 1)`
- `push(values: number[])` — accepts N voltage values per sub-step
- Data layout for GPU transfer: contiguous per-channel (`channel_0[0..2047], channel_1[0..2047], ...`) for efficient `writeBuffer()`
- Reset, read pointer access

With 10kHz sub-stepping, data is pushed per sub-step (not per frame), giving ~80x higher temporal resolution in the waveform display than the current implementation.

### Dependency Injection Architecture

All physics classes use **constructor injection**. No class imports global constants or creates its own collaborators. This enables deterministic testing and clean isolation.

**Seedable PRNG** — The most impactful DI decision. Every class that uses randomness (noise generation, metastability resolution, clock jitter) receives an RNG function:

```ts
// Simple interface: returns uniform [0, 1) — same as Math.random()
type RngFn = () => number;

// Production: Math.random
// Testing: seedable PRNG (e.g., mulberry32) for deterministic, reproducible tests
function createSeededRng(seed: number): RngFn {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

**Injection chain:**

```
SimulationEngine (receives PhysicsConfig, RngFn, timer fn)
  └─ CircuitGraph (receives ComponentRegistry, PhysicsConfig, RngFn)
       └─ ComponentRegistry.create(type, id, params, deps)
            └─ ClockSource (receives SignalConfig, NoiseGenerator, RngFn)
            └─ SignalSource (receives SignalConfig, NoiseGenerator)
            └─ DFlipFlop (receives TimingConfig, SignalConfig, NoiseGenerator, RngFn)
                 └─ Signal (receives SignalConfig, NoiseGenerator)
                      └─ NoiseGenerator (receives sigma config, RngFn)
```

**Key DI rules:**
- `NoiseGenerator` is injected into `Signal`, not created internally. Tests can pass a zero-noise generator to isolate RLC behavior.
- `ComponentRegistry` is injected into `CircuitGraph`, not imported as a global. Tests can register mock components.
- `RngFn` is threaded through the entire chain. Production passes `Math.random`; tests pass `createSeededRng(42)` for reproducibility.
- `SimulationEngine` receives a timer function (`(callback: () => void, ms: number) => number`) instead of calling `setTimeout` directly. Tests can use synchronous stepping.
- `WaveformBuffer` receives `length` and `channelCount` as constructor params, not from global constants.

**Immutable config:**

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
- Small component count with sequential frame-to-frame dependencies (RLC state, Schmitt trigger state, metastability state). Even the DFF demo has 3 signals; a 4-bit accumulator has ~20 components. No meaningful parallelism to exploit at this scale.
- Even with sub-stepping, CPU cost is <50us per tick for the largest planned circuit. GPU dispatch overhead (5-50us) exceeds the benefit.
- `mapAsync()` readback latency (1-3 frames) would make UI voltage display stale.
- 1/f noise generation (Voss-McCartney) is inherently sequential (counter-based octave updates).

Compute shaders are the right tool for massive parallelism (particle systems, fluid grids, per-pixel processing). Even a 4-bit accumulator (4 DFFs + 4 full adders + carry chain) is ~20 components with sequential dependencies — CPU handles this in <50us per tick. The circuit graph's levelized evaluation is inherently sequential. GPU parallelism would only help at scales of thousands of independent components, which is far beyond this project's scope.

### File Structure (physics)

```
workers/physics/
├── physics.worker.ts       # Worker entry, Comlink.expose(), accumulator tick loop
├── engine.ts               # SimulationEngine: owns graph, runs sub-stepping loop
├── graph.ts                # CircuitGraph: instantiates components/nets, topological sort
├── components/
│   ├── base.ts             # Component, CombinationalComponent, SequentialComponent
│   ├── clock-source.ts     # ClockSource: phase tracking, jitter (sequential)
│   ├── signal-source.ts    # SignalSource: user-controlled input (sequential)
│   ├── flip-flop.ts        # DFlipFlop: Schmitt trigger, setup/hold, metastability
│   ├── and-gate.ts         # ANDGate: 2-input (combinational, day 2)
│   ├── or-gate.ts          # ORGate: 2-input (combinational, day 2)
│   ├── xor-gate.ts         # XORGate: 2-input (combinational, day 2)
│   ├── not-gate.ts         # NOTGate: inverter (combinational, day 2)
│   └── registry.ts         # ComponentRegistry: type string → constructor map
├── signal.ts               # Signal: state-space RLC, noise injection, clamping
├── noise.ts                # NoiseGenerator: Marsaglia white + Voss-McCartney 1/f
└── waveform-buffer.ts      # WaveformBuffer: N-channel ring buffer
```

## Internationalization (Lingui)

### Configuration

Lingui with compile-time extraction. Two locales: `en` (default), `zh-CN`.

### Usage in components

```tsx
import { Trans, t } from "@lingui/react/macro";

// Static UI strings (not circuit-specific):
<Trans>Real-time Oscilloscope</Trans>
<Trans>Digital Logic View</Trans>
<Trans>Settings</Trans>

// In attributes:
<button aria-label={t`Toggle shader style`}>
```

Note: Circuit-specific labels (probe names, control labels) come from the `CircuitDefinition` and are stored in message catalogs per locale. The definition itself uses message IDs that Lingui extracts.

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
- `graph.test.ts`: Levelization produces correct evaluation order, combinational feedback loop detected and rejected, net voltage propagation from driver to loads, N-channel waveform buffer push with correct probe mapping, circuit definition validation (missing nets, dangling ports)

**Stores** (`test/stores/`):
- Store action tests: setParam(componentId, key, value) updates params record, updateVoltages merges new probe readings, setCircuit switches active circuit ID

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
