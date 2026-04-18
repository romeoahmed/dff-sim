# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**DFF·SIM** — a web-based physics simulation of digital logic circuits. Rather than modelling ideal 0/1 transitions, the engine simulates the underlying analog behaviour: Gaussian noise (white + 1/f flicker), RC-slew via a damped second-order signal model, Schmitt-trigger hysteresis, and metastability resolution. The UI is a React instrument panel with a real-time WebGPU oscilloscope.

Built with **React 19**, **TypeScript 6**, **Vite 8** (rolldown + SWC), **Biome 2**, **Jotai 2**, **shadcn/ui** (Radix primitives), **Lingui 5** (SWC macro transform), and **Bun**.

## Commands

```bash
bun install            # Install dependencies
bun run dev            # Vite dev server → http://localhost:5173
bun run build          # Production build → dist/
bun run preview        # Serve production build locally
bun run typecheck      # tsc --noEmit
bun run check          # Biome lint + format check (no writes)
bun run check:fix      # Biome auto-fix
bun run test           # Vitest (single run)
bun run test:watch     # Vitest in watch mode
bun run test:ui        # Vitest browser UI
bun run lingui:extract # Scan src for Trans/t/msg/Plural macros → .po
bun run lingui:compile # Compile .po → .mjs catalogs (committed)
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
- `activeProbeIdsAtom` / `activeProbesAtom` — probe selection
- `shaderStyleAtom` — `"clean" | "glow" | "phosphor"`
- `themeAtom` — `"dark" | "light"` (`atomWithStorage`, persists across reloads)
- `localeAtom` — `"en" | "zh-CN"`
- `settingsOpenAtom`, `aboutOpenAtom`, `shortcutsOpenAtom` — sheet/dialog visibility
- `voltageSpecsAtom` (in `settings-atoms.ts`) — overridable voltage band config

### UI components

`src/components/` — React components grouped by role:

| Directory | Contents |
|-----------|----------|
| `ui/` | shadcn/ui primitives (`button`, `slider`, `switch`, `toggle`, `toggle-group`, `dialog`, `sheet`) — generated via `npx shadcn add`, owned in-tree, wrap the `radix-ui` umbrella package. Edit only when forced (e.g. `slider.tsx` patched for `exactOptionalPropertyTypes`). |
| `controls/` | `ControlPanel` (parent grid `[1fr_auto]`), `ParamSlider`, `ParamToggle`, `ParamMomentary`, `ProbeSelector` — every param row uses `col-span-2 grid grid-cols-subgrid` so labels/values align across rows |
| `nav/` | `Toolbar` (glass nav with theme/locale/shader toggles), `CircuitSelector` |
| `oscilloscope/` | `OscilloscopePanel`, `WaveformCanvas`, `DigitalCanvas`, `InstrumentBezel`, `LiveVoltageReadouts`, `Legend`, `ProbeStateAnnouncer` (a11y live region) |
| `schematic/` | `CircuitSchematic` (SVG net diagram, landscape `< 1440px` / portrait `≥ 1440px`), `SchematicGrid`, `SchematicNode`, `SchematicWire`, `describe` helper for a11y `<desc>` |
| `settings/` | `SettingsSheet` — voltage-band overrides, also uses subgrid for label/input alignment |
| `about/` | `AboutSheet` |
| `shortcuts/` | `ShortcutsOverlay` — keyboard help (centered Dialog) |
| `status/` | `StatusStrip` |
| `fallback/` | `WebGPUUnavailable` |
| `layout/` | `AppLayout` — responsive grid: 1 col stack `< md` / 2 cols `md..2xl` / 3 cols `2xl+` |

### Styling

Tailwind CSS v4 (CSS-first config in `src/styles/globals.css`). Apple-inspired **dual theme** keyed off `data-theme="dark"` / `[data-theme="light"]` on `<html>`, mirrored from `themeAtom` by `useThemeSync`. The token layer is two-tiered:

1. **Project semantic tokens** under both theme blocks: `--color-canvas`, `--color-panel`, `--color-panel-raised`, `--color-panel-muted`, `--color-border`, `--color-border-strong`, `--color-fg`, `--color-fg-muted`, `--color-fg-subtle`, `--color-accent` (Apple Blue), `--color-accent-pressed`, `--color-success` (iOS green), `--color-danger` (iOS red), `--color-focus`.
2. **shadcn alias tokens** in the same blocks: `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius` — all forwarded to project tokens. `@theme inline { --color-*: var(--*); … }` exposes both layers as Tailwind utilities. Generated `src/components/ui/*.tsx` files stay pristine because shadcn class names like `bg-primary` resolve to our Apple Blue automatically.

Body font is the SF Pro system stack; `IBM Plex Mono` is loaded for the `.readout` class (instrument numerics with slashed zero + tabular nums). Generated catalog `.mjs` files in `src/i18n/locales/**` are excluded from Biome via `biome.json` `files.includes`.

### i18n

Lingui 5 with the SWC macro plugin (NOT the babel plugin — `@vitejs/plugin-react@6` dropped Babel support, so the build uses `@vitejs/plugin-react-swc` + `@lingui/swc-plugin`).

- Catalogs: `src/i18n/locales/{en,zh-CN}/messages.po` (source) + `messages.mjs` (compiled, **committed**, ESM via `compileNamespace: "es"`)
- Loader: `src/i18n/index.ts` exports `activateLocale(locale)` which dynamic-imports the matching `.mjs` and calls `i18n.loadAndActivate`. An empty English catalog is sync-activated at module load so first paint never crashes.
- Bridge: `src/hooks/useLocaleSync.ts` watches `localeAtom` and calls `activateLocale` on change.
- Macros: `<Trans>…</Trans>`, `` t`…` `` (in attributes), `` msg`…` `` (for `MessageDescriptor`s in module-scope arrays — render via `i18n._(desc)`), `<Plural value one other />`. Imported from `@lingui/react/macro` and `@lingui/core/macro`.
- **Test caveat:** Vitest does NOT run the SWC macro transform. `src/test/setup.ts` mocks `@lingui/react/macro` and `@lingui/core/macro` with runtime shims so `<Trans>` renders children verbatim, `<Plural>` picks one/other by value, `t\`…\`` interpolates, and `msg\`…\`` returns a `MessageDescriptor`-shaped object. Real translation behaviour is verified by `src/test/i18n/locale-switch.test.tsx` which calls `activateLocale` directly and asserts `i18n._(hashedId)` returns Chinese strings.
- Source code and code comments stay English-only; only user-visible strings get wrapped.

## Code Style

- **TypeScript** strict mode: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- **Biome 2** handles all formatting and linting (no ESLint, no Prettier)
- **No `!` non-null assertions** in production code; extract port refs as `private readonly` fields in component constructors instead
- **No `as any` or `as unknown as T`** double-casts; use type predicates or runtime checks
- **No comments** unless the WHY is non-obvious (hidden constraint, subtle invariant, workaround). Never comment what the code already says.
- **All source comments in English**

## Testing

Vitest 4 + `@testing-library/react` 16 + happy-dom. Vitest config is intentionally minimal — it does NOT inherit Vite's plugins, so:

- Physics / logic tests are colocated with source files (e.g., `and-gate.test.ts` next to `and-gate.ts`)
- React component tests live in `src/test/components/`
- i18n + hook tests live in `src/test/i18n/` and `src/test/hooks/`
- `src/test/setup.ts` shims Lingui macros (`@lingui/react/macro`, `@lingui/core/macro`) since the SWC transform does not run in test environment — see the i18n section above
- Wrap components with Jotai `<Provider store={createStore()}>` to isolate atom state per test
- Atom updates that trigger React effects must be wrapped in `act(() => store.set(...))` — otherwise the subsequent state-setter call lands outside the act boundary and React warns
- Port extraction in tests: `get("portName")` + `toBeDefined()` guard + early return — never `!`

## Deployment

Push to `main` → GitHub Actions (`.github/workflows/deploy.yaml`) builds with Bun and deploys to GitHub Pages.
