# Accessibility Pass — Oscilloscope, Schematic, and Live Readouts

## Context

The 2026-04-17 audit flagged a handful of accessibility gaps in the UI. Closer inspection found that the basics are already in place (`WaveformCanvas` has `aria-label`, `LiveVoltageReadouts` has `aria-live`, the Legend uses `aria-hidden` swatches paired with text). Four real gaps remain:

1. **Waveform / digital traces are distinguishable only by colour.** The WGSL shader renders every channel as a solid line with a per-channel colour. Colourblind users with vision can confuse adjacent probes; the only non-colour identifier is the Legend and the LiveVoltageReadouts, both outside the canvas.
2. **`LiveVoltageReadouts` announcement flood.** The readouts are wrapped in `aria-live="polite"` and subscribe to `voltageAtomFamily`, which updates at the physics tick rate (~60 Hz). This effectively DDoSes screen readers.
3. **`CircuitSchematic` SVG has no semantic markup.** No `role="img"`, no `<title>`, no `<desc>`. A screen reader sees an empty decorative graphic.
4. **`DigitalCanvas` has no `aria-label`.** Minor oversight next to `WaveformCanvas.tsx:9`.

## Goals

1. Each probe trace in the waveform and digital canvases is distinguishable by **line pattern** in addition to colour. Cycles through four patterns per channel index: solid, long-dash, dot, dash-dot.
2. `LiveVoltageReadouts` only announces when a probe crosses the logic threshold (HIGH ↔ LOW), not on every voltage change.
3. `CircuitSchematic` is announced with circuit name + description + component/net summary, all derived from the existing `CircuitDefinition`.
4. `DigitalCanvas` gets an `aria-label`.

## Non-Goals

- No keyboard navigation, zoom, or pan on the canvases. There is nothing to navigate today, so there's nothing to make accessible.
- No full tabular representation of circuit state. The existing Legend + LiveVoltageReadouts + schematic summary cover the need.
- No formal WCAG compliance target. These fixes address concrete user-impacting gaps; chasing a level is outside scope.
- No change to `ParamSlider`, `ParamToggle`, `ParamMomentary`, `Toolbar`, `SettingsSheet`, `CircuitSelector` — they already have correct ARIA semantics.

## Design

### D.1 — Dash patterns in the WGSL shader

The waveform pipeline's `ChannelConfig` storage buffer currently encodes `color: vec4<f32>, yOffset: f32, _pad: vec3<f32>` (`src/workers/render/shaders/waveform.vert.wgsl:11-15`). Replace `_pad` with:

```wgsl
struct ChannelConfig {
  color: vec4<f32>,
  yOffset: f32,
  dashPattern: u32,  // 0=solid, 1=longDash, 2=dot, 3=dashDot
  _pad: vec2<f32>,
};
```

Update the pipeline's uniform packer (`src/workers/render/pipelines/waveform.ts:105-130` — per-channel write loop): write `dashPattern = (channelIndex % 4)` into the `u32` slot.

The vertex shader already computes `x = sampleIdx * stepX`. Pass `x` (or equivalently the sample index) to the fragment shader as a varying `@location(3) distAlongLine: f32`. In the fragment shader, sample the pattern:

```wgsl
fn dashAlpha(pattern: u32, dist: f32) -> f32 {
  let cycle = 24.0;  // world-units per dash cycle; tuned for visual clarity
  let t = fract(dist / cycle);
  switch pattern {
    case 0u: { return 1.0; }                                  // solid
    case 1u: { return step(t, 0.6); }                         // long-dash (60% on)
    case 2u: { return step(t, 0.18); }                        // dot (18% on)
    case 3u: { return select(0.0, 1.0,
                 (t < 0.5 && t > 0.1) || (t > 0.7 && t < 0.85)); } // dash-dot
    default: { return 1.0; }
  }
}
```

Multiply the existing fragment alpha by `dashAlpha`. For the `phosphor` and `glow` shader variants, apply the dash *after* the edge-falloff term so the dash remains visible through bloom.

Apply the same pattern-pack update to the digital canvas pipeline (`src/workers/render/pipelines/digital.ts` + `src/workers/render/shaders/digital.wgsl`) — same four-pattern cycle keyed off `channelIndex`.

### D.2 — Transition-only aria-live announcements

Refactor `LiveVoltageReadouts.tsx`:

- Strip `aria-live`/`aria-atomic` from the visual readout container. The voltages are still displayed, just not announced.
- Add a sibling component `ProbeStateAnnouncer` (same file or a new `ProbeStateAnnouncer.tsx`) that renders a visually-hidden `<div role="status" aria-live="polite" aria-atomic="true">` containing the current transition message.

`ProbeStateAnnouncer` subscribes to the same `voltageAtomFamily(netId)` per active probe but tracks last-known HIGH/LOW state per probe in a `useRef<Map<string, 0 | 1>>`. On each render:

1. For each active probe, compute `current = voltage > logicHighMin ? 1 : voltage < logicLowMax ? 0 : previous` (Schmitt-style so mid-band noise doesn't chatter).
2. Compare to `lastState.current.get(netId)`. If different, update the ref and push a message.
3. Render the latest message in the live region.

Message format: `"Q0 HIGH"`, `"CLK LOW"`, one probe at a time. When multiple transitions happen in the same tick (rising clock edge captures all four DFFs), concatenate: `"CLK HIGH, Q0 LOW, Q1 HIGH, Q2 LOW, Q3 HIGH"`. A single live-region update per render is enough — screen readers read the full string.

Visually-hidden CSS: use the existing `sr-only` utility (Tailwind convention) or add a small class:

```css
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

Tailwind CSS v4 ships `sr-only` by default — check before adding a custom class.

### D.3 — Schematic semantic markup

In `CircuitSchematic.tsx`, modify the `<motion.svg>` element:

```tsx
<motion.svg
  key={circuitDef.id}
  viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
  preserveAspectRatio="xMidYMid meet"
  className="w-full h-full"
  role="img"
  aria-labelledby={`schematic-title-${circuitDef.id}`}
  aria-describedby={`schematic-desc-${circuitDef.id}`}
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -8 }}
  transition={{ duration: 0.2, ease: "easeOut" }}
>
  <title id={`schematic-title-${circuitDef.id}`}>
    Circuit schematic: {circuitDef.name}
  </title>
  <desc id={`schematic-desc-${circuitDef.id}`}>
    {buildSchematicDescription(circuitDef)}
  </desc>
  <SchematicGrid />
  {/* ... */}
</motion.svg>
```

`buildSchematicDescription(def)` is a new pure helper in `src/components/schematic/describe.ts`:

```ts
export function buildSchematicDescription(def: CircuitDefinition): string {
  const base = def.description ?? "";
  const componentSummary = `${def.components.length} components (${
    groupByType(def.components).map(([type, count]) => `${count} ${type}`).join(", ")
  })`;
  const netSummary = `${def.nets.length} nets`;
  return [base, componentSummary, netSummary].filter(Boolean).join(". ");
}
```

`groupByType` returns `[type, count]` pairs (e.g., `[["DFlipFlop", 4], ["FullAdder", 4], ["ClockSource", 1], ["SignalSource", 4]]`). The resulting description for the adder is something like:

> "4-bit ripple-carry accumulator. Each clock edge adds the 4-bit input A[0..3] to the stored register value Q[0..3]. Overflow is shown on the OVF probe. 13 components (1 ClockSource, 4 SignalSource, 4 FullAdder, 4 DFlipFlop). 16 nets."

The DFF definition gets an equivalent derived description automatically.

### D.4 — `DigitalCanvas` aria-label

Trivial. Mirror `WaveformCanvas.tsx:9`:

```tsx
<canvas ref={ref} className="w-full h-full block" aria-label="Digital logic waveform display" />
```

## Data Flow

- **D.1**: no RPC surface change. Pipeline setup gains one `u32` per channel in the storage buffer; the extra bytes are negligible.
- **D.2**: no RPC surface change. The announcer is pure main-thread React. It reads the same atoms the visual readouts read.
- **D.3**: no RPC surface change. SVG semantic markup only.
- **D.4**: none.

## Testing

### Component tests (React Testing Library + happy-dom)

1. **`CircuitSchematic.test.tsx`**: render with `dffCircuit` and `adderCircuit`; assert the SVG has `role="img"`; assert `aria-labelledby` and `aria-describedby` point to elements containing the expected text (circuit name and component/net summary).
2. **`ProbeStateAnnouncer.test.tsx`**: render with a mocked active-probes atom and controlled voltage atoms; simulate a voltage update that crosses the HIGH threshold; assert the live-region text becomes `"Q0 HIGH"`. Simulate a noise-band voltage change; assert the text does *not* update.
3. **`DigitalCanvas.test.tsx`**: existing test file (if present) gets one added assertion on `aria-label`.

### Visual/shader tests

- No automated tests for D.1 (WebGPU shaders are not unit-testable in happy-dom). Manual verification in `bun run dev`: open the adder, confirm each of the 6 probes draws with a distinct dash pattern *and* colour. Switch to each of `clean` / `glow` / `phosphor` shader styles — patterns should remain visible on all three.

### Regression tests

- Existing `SettingsSheet.test.tsx`, `ControlPanel.test.tsx` are unchanged and must still pass.

## Risks

1. **Shader complexity: dash on glow/phosphor.** The bloom and scanline post-processing may interact with the dash alpha term. If glow bleeds across the gaps, dashes become invisible. Mitigation: apply dash as the last step in the fragment shader's alpha pipeline; manual verification is the guard.
2. **Screen-reader verbosity on busy circuits.** On the adder, a single clock edge can transition 5+ probes. The concatenated message is long. Acceptable — the alternative (per-probe message) is worse because they'd interrupt each other.
3. **Description drift.** `buildSchematicDescription` derives from `def.description` + component types. If a circuit definition omits `description`, the output is just the counts. Acceptable (still better than today's nothing).
4. **`dashPattern: u32` alignment in WGSL storage buffer.** WGSL storage-buffer layout for arrays of structs is strict — `u32` after `f32` needs correct padding. Verify the `_pad: vec2<f32>` makes the struct size a multiple of 16 bytes. If alignment is wrong, the shader reads garbage. Unit-testable by uploading a known pattern and reading back in a test harness, but cheapest verification is to inspect the actual render in `bun run dev`.

## Rollout

Four commits — independent enough to split, small enough to bundle if desired:

1. `feat(render): per-channel dash patterns in waveform and digital shaders` — the D.1 work: shader + pipeline changes.
2. `fix(a11y): announce probe logic transitions, not every voltage sample` — the D.2 refactor: `ProbeStateAnnouncer` + `LiveVoltageReadouts` cleanup.
3. `feat(a11y): add title/desc and role=img to CircuitSchematic svg` — the D.3 change + `buildSchematicDescription` helper + test.
4. `fix(a11y): add aria-label to DigitalCanvas` — one-liner D.4.

## Verification Checklist

1. `bun run typecheck` → 0 errors.
2. `bun run check` → 0 Biome warnings.
3. `bun run test` → all existing + new tests pass.
4. `bun run build` → succeeds.
5. Browser check (`bun run dev`):
   - Open the 4-bit accumulator.
   - Inspect the oscilloscope: each probe has a distinct dash pattern on top of its colour; patterns survive all three shader styles.
   - Inspect the schematic in dev tools: `<svg>` has `role="img"`, `<title>` and `<desc>` are present and contain meaningful text.
   - Use a screen reader (NVDA / VoiceOver / Orca) to navigate: the schematic reads the circuit description once on focus; probe state transitions are announced as they happen; no flood of per-tick voltage readings.
   - DigitalCanvas announces its `aria-label` when focused in dev tools' accessibility tree.

## Dependencies

- **Independent of** A (analog gates) and B (metastability bias). Can ship any time.
- Ordering: A, B, C all ship before D has no bearing; D can be first if preferred. Shader-layer D.1 change doesn't collide with any other spec.
