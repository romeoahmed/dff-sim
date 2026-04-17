# Accessibility Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close four concrete accessibility gaps: (1) waveform and digital traces distinguishable by line pattern in addition to colour, (2) screen-reader announcements fire only on logic transitions instead of every physics tick, (3) `CircuitSchematic` SVG gains `<title>` / `<desc>` / `role="img"`, (4) `DigitalCanvas` gains an `aria-label`.

**Architecture:** Two WGSL shader modifications add a per-channel `dashPattern: u32` to the storage buffer; both the waveform and digital pipelines upload `channelIndex % 4` as the pattern. React side: split `LiveVoltageReadouts` into a visual readout (no `aria-live`) plus a new `ProbeStateAnnouncer` component that watches probe voltages through a Schmitt-style threshold and pushes one concatenated `"NAME STATE, NAME STATE"` string into a visually-hidden live region on each transition. A pure helper `buildSchematicDescription(def)` derives a summary from the existing `CircuitDefinition.description` + component type counts + net count.

**Tech Stack:** React 19, Jotai 2, TypeScript 6, Vitest 4, Testing Library 16, happy-dom, WebGPU / WGSL, Tailwind CSS v4, Biome 2.

**Spec reference:** `docs/superpowers/specs/2026-04-17-accessibility-pass-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/workers/render/shaders/waveform.vert.wgsl` | Modify | Add `dashPattern: u32` to ChannelConfig; pass `distAlongLine` to frag |
| `src/workers/render/shaders/waveform-clean.frag.wgsl` | Modify | Multiply alpha by `dashAlpha()` |
| `src/workers/render/shaders/waveform-glow.frag.wgsl` | Modify | Same; dash applied after bloom |
| `src/workers/render/shaders/waveform-phosphor.frag.wgsl` | Modify | Same |
| `src/workers/render/shaders/digital.wgsl` | Modify | Add dashPattern + dashAlpha multiply (single-file shader) |
| `src/workers/render/pipelines/waveform.ts` | Modify | `uploadChannels` writes dashPattern at byte offset 20 |
| `src/workers/render/pipelines/digital.ts` | Modify | (Mirror) |
| `src/workers/render/shaders/dash.wgsl` | Create | Shared `dashAlpha(pattern, dist)` function |
| `src/workers/render/shaders/index.ts` | Modify | Import and re-export `dash.wgsl` if needed |
| `src/components/oscilloscope/LiveVoltageReadouts.tsx` | Modify | Remove aria-live; visual-only |
| `src/components/oscilloscope/ProbeStateAnnouncer.tsx` | Create | Transition-only live region |
| `src/components/oscilloscope/OscilloscopePanel.tsx` | Modify | Mount ProbeStateAnnouncer |
| `src/test/components/ProbeStateAnnouncer.test.tsx` | Create | Unit tests |
| `src/components/schematic/describe.ts` | Create | `buildSchematicDescription(def)` |
| `src/components/schematic/describe.test.ts` | Create | Unit tests for the helper |
| `src/components/schematic/CircuitSchematic.tsx` | Modify | Add role, title, desc |
| `src/test/components/CircuitSchematic.test.tsx` | Create (or modify if present) | Tests for semantic markup |
| `src/components/oscilloscope/DigitalCanvas.tsx` | Modify | Add aria-label (one-liner) |

---

## Task 1: Shared dash-alpha WGSL helper + extend ChannelConfig for waveform

**Files:**
- Create: `src/workers/render/shaders/dash.wgsl`
- Modify: `src/workers/render/shaders/waveform.vert.wgsl`
- Modify: `src/workers/render/shaders/waveform-clean.frag.wgsl`
- Modify: `src/workers/render/shaders/waveform-glow.frag.wgsl`
- Modify: `src/workers/render/shaders/waveform-phosphor.frag.wgsl`
- Modify: `src/workers/render/shaders/index.ts`
- Modify: `src/workers/render/pipelines/waveform.ts`

- [ ] **Step 1: Create the shared `dashAlpha` snippet**

Create `src/workers/render/shaders/dash.wgsl`:

```wgsl
fn dashAlpha(pattern: u32, dist: f32) -> f32 {
  let cycle = 24.0;
  let t = fract(dist / cycle);
  switch pattern {
    case 0u: { return 1.0; }
    case 1u: { return select(0.0, 1.0, t < 0.6); }
    case 2u: { return select(0.0, 1.0, t < 0.18); }
    case 3u: {
      let a = t < 0.5 && t > 0.1;
      let b = t < 0.85 && t > 0.7;
      return select(0.0, 1.0, a || b);
    }
    default: { return 1.0; }
  }
}
```

Patterns: 0 = solid, 1 = long-dash (60 % on / 40 % off), 2 = dot (18 % on), 3 = dash-dot.

- [ ] **Step 2: Add the `dash` entry to the shader registry**

Open `src/workers/render/shaders/index.ts`. At the top add the import:

```ts
import dash from "./dash.wgsl?raw";
```

Update the `shaders` object to include the new entry so the bundler keeps the file in the bundle even if it's only used via string concatenation:

```ts
export const shaders = {
  dash,
  digital,
  waveformClean,
  waveformGlow,
  waveformPhosphor,
  waveformVert,
} as const;
```

- [ ] **Step 3: Extend `waveform.vert.wgsl`**

Replace `src/workers/render/shaders/waveform.vert.wgsl` with:

```wgsl
struct Uniforms {
  canvasSize: vec2<f32>,
  scaleY: f32,
  voltageHeadroom: f32,
  lineWidth: f32,
  writePointer: u32,
  bufferLength: u32,
  channelCount: u32,
};

struct ChannelConfig {
  color: vec4<f32>,
  yOffset: f32,
  dashPattern: u32,
  _pad: vec2<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> samples: array<f32>;
@group(0) @binding(2) var<storage, read> channels: array<ChannelConfig>;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) edgeDist: f32,
  @location(2) age: f32,
  @location(3) dashDist: f32,
  @location(4) @interpolate(flat) dashPattern: u32,
};

fn readSample(channel: u32, i: u32) -> f32 {
  let idx = (u.writePointer + i) & (u.bufferLength - 1u);
  return samples[channel * u.bufferLength + idx];
}

fn voltageToY(v: f32, yOffset: f32) -> f32 {
  let baseY = yOffset + u.voltageHeadroom * u.scaleY;
  return baseY - v * u.scaleY;
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VSOut {
  let sampleIdx = vid / 2u;
  let side = f32(vid & 1u) * 2.0 - 1.0;
  let ch = channels[iid];

  let curV = readSample(iid, sampleIdx);

  let stepX = u.canvasSize.x / f32(u.bufferLength - 1u);
  let x = f32(sampleIdx) * stepX;
  let y = voltageToY(curV, ch.yOffset);

  let isLast = sampleIdx >= u.bufferLength - 1u;
  let refIdx = select(sampleIdx + 1u, sampleIdx - 1u, isLast);
  let refSign = select(1.0, -1.0, isLast);
  let refV = readSample(iid, refIdx);
  let refX = f32(refIdx) * stepX;
  let refY = voltageToY(refV, ch.yOffset);

  let dx = (refX - x) * refSign;
  let dy = (refY - y) * refSign;
  let len = max(sqrt(dx * dx + dy * dy), 0.001);
  let nx = -dy / len;
  let ny = dx / len;

  let offsetX = nx * side * u.lineWidth * 0.5;
  let offsetY = ny * side * u.lineWidth * 0.5;

  let screenX = (x + offsetX) / u.canvasSize.x * 2.0 - 1.0;
  let screenY = 1.0 - (y + offsetY) / u.canvasSize.y * 2.0;

  var out: VSOut;
  out.pos = vec4<f32>(screenX, screenY, 0.0, 1.0);
  out.color = ch.color;
  out.edgeDist = side;
  out.age = f32(u.bufferLength - sampleIdx) / f32(u.bufferLength);
  out.dashDist = x;
  out.dashPattern = ch.dashPattern;
  return out;
}
```

Key changes:
- `ChannelConfig` gains `dashPattern: u32` and shrinks `_pad` to `vec2<f32>`.
- `VSOut` gains `dashDist` (f32, location 3) and `dashPattern` (flat u32, location 4).

- [ ] **Step 4: Update the fragment shaders**

Replace `src/workers/render/shaders/waveform-clean.frag.wgsl` with:

```wgsl
fn dashAlpha(pattern: u32, dist: f32) -> f32 {
  let cycle = 24.0;
  let t = fract(dist / cycle);
  switch pattern {
    case 0u: { return 1.0; }
    case 1u: { return select(0.0, 1.0, t < 0.6); }
    case 2u: { return select(0.0, 1.0, t < 0.18); }
    case 3u: {
      let a = t < 0.5 && t > 0.1;
      let b = t < 0.85 && t > 0.7;
      return select(0.0, 1.0, a || b);
    }
    default: { return 1.0; }
  }
}

struct FSIn {
  @location(0) color: vec4<f32>,
  @location(1) edgeDist: f32,
  @location(2) age: f32,
  @location(3) dashDist: f32,
  @location(4) @interpolate(flat) dashPattern: u32,
};

@fragment
fn fs_main(in: FSIn) -> @location(0) vec4<f32> {
  let edgeAlpha = 1.0 - smoothstep(0.7, 1.0, abs(in.edgeDist));
  let dashA = dashAlpha(in.dashPattern, in.dashDist);
  return vec4<f32>(in.color.rgb, in.color.a * edgeAlpha * dashA);
}
```

Replace `src/workers/render/shaders/waveform-glow.frag.wgsl` with:

```wgsl
fn dashAlpha(pattern: u32, dist: f32) -> f32 {
  let cycle = 24.0;
  let t = fract(dist / cycle);
  switch pattern {
    case 0u: { return 1.0; }
    case 1u: { return select(0.0, 1.0, t < 0.6); }
    case 2u: { return select(0.0, 1.0, t < 0.18); }
    case 3u: {
      let a = t < 0.5 && t > 0.1;
      let b = t < 0.85 && t > 0.7;
      return select(0.0, 1.0, a || b);
    }
    default: { return 1.0; }
  }
}

struct FSIn {
  @location(0) color: vec4<f32>,
  @location(1) edgeDist: f32,
  @location(2) age: f32,
  @location(3) dashDist: f32,
  @location(4) @interpolate(flat) dashPattern: u32,
};

@fragment
fn fs_main(in: FSIn) -> @location(0) vec4<f32> {
  let d = abs(in.edgeDist);
  let core = 1.0 - smoothstep(0.3, 1.0, d);
  let halo = exp(-d * d * 2.0);
  let intensity = core + halo * 0.6;
  let dashA = dashAlpha(in.dashPattern, in.dashDist);
  return vec4<f32>(in.color.rgb * intensity, in.color.a * intensity * dashA);
}
```

Replace `src/workers/render/shaders/waveform-phosphor.frag.wgsl` with:

```wgsl
fn dashAlpha(pattern: u32, dist: f32) -> f32 {
  let cycle = 24.0;
  let t = fract(dist / cycle);
  switch pattern {
    case 0u: { return 1.0; }
    case 1u: { return select(0.0, 1.0, t < 0.6); }
    case 2u: { return select(0.0, 1.0, t < 0.18); }
    case 3u: {
      let a = t < 0.5 && t > 0.1;
      let b = t < 0.85 && t > 0.7;
      return select(0.0, 1.0, a || b);
    }
    default: { return 1.0; }
  }
}

struct FSIn {
  @location(0) color: vec4<f32>,
  @location(1) edgeDist: f32,
  @location(2) age: f32,
  @location(3) dashDist: f32,
  @location(4) @interpolate(flat) dashPattern: u32,
};

@fragment
fn fs_main(in: FSIn) -> @location(0) vec4<f32> {
  let edgeAlpha = 1.0 - smoothstep(0.7, 1.0, abs(in.edgeDist));
  let ageFade = mix(0.2, 1.0, in.age);
  let dashA = dashAlpha(in.dashPattern, in.dashDist);
  return vec4<f32>(in.color.rgb * ageFade, in.color.a * edgeAlpha * ageFade * dashA);
}
```

Inlining `dashAlpha` into each frag is intentional: WGSL doesn't have cross-file includes in this project's setup, and duplicating six lines keeps each file self-contained.

- [ ] **Step 5: Update `uploadChannels` in `pipelines/waveform.ts` to write `dashPattern`**

Open `src/workers/render/pipelines/waveform.ts`. Replace `uploadChannels` (lines 103-123) with:

```ts
export function uploadChannels(
  device: GPUDevice,
  buffer: GPUBuffer,
  probes: readonly Probe[],
  canvasHeight: number,
): void {
  // 8 f32 / 8 u32 per channel (32 B): color[0-3], yOffset[4], dashPattern[5], _pad[6-7]
  const f = new Float32Array(8 * probes.length);
  const u = new Uint32Array(f.buffer);
  const rowHeight = canvasHeight / Math.max(probes.length, 1);
  for (const [i, probe] of probes.entries()) {
    const yOffset = rowHeight * probe.channelIndex + rowHeight * 0.5 - canvasHeight * 0.5;
    const color = hexToRgba(probe.color);
    f[i * 8 + 0] = color[0];
    f[i * 8 + 1] = color[1];
    f[i * 8 + 2] = color[2];
    f[i * 8 + 3] = color[3];
    f[i * 8 + 4] = yOffset;
    u[i * 8 + 5] = probe.channelIndex % 4;
  }
  device.queue.writeBuffer(buffer, 0, f);
}
```

Dash pattern index is `probe.channelIndex % 4`, so four adjacent channels get four distinct patterns.

- [ ] **Step 6: Run typecheck, tests, Biome, build**

```bash
bun run typecheck && bun run test && bun run check && bun run build
```

Expected: all pass. Tests don't exercise WGSL, so these pass as long as TypeScript typechecks.

- [ ] **Step 7: Manual browser verification**

```bash
bun run dev
```

Open `http://localhost:5173`. Open the 4-bit accumulator. Confirm:
- Each of the six probes has a distinct dash pattern *and* colour.
- Switching shader style (Clean / Glow / Phosphor) preserves the dash pattern in all three.

If the waveform display looks broken (garbled lines, wrong alignment), check that the `ChannelConfig` WGSL struct size is still 32 bytes — `color(16) + yOffset(4) + dashPattern(4) + _pad(8) = 32`. If size changed, you need to adjust the buffer allocation in `pipelines/waveform.ts:78`.

Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add src/workers/render/shaders/dash.wgsl src/workers/render/shaders/waveform.vert.wgsl src/workers/render/shaders/waveform-clean.frag.wgsl src/workers/render/shaders/waveform-glow.frag.wgsl src/workers/render/shaders/waveform-phosphor.frag.wgsl src/workers/render/shaders/index.ts src/workers/render/pipelines/waveform.ts
git commit -m "$(cat <<'EOF'
feat(render): per-channel dash patterns on waveform traces

ChannelConfig gains a dashPattern u32 (cycled as channelIndex % 4).
Each of the three fragment shaders multiplies output alpha by a
dashAlpha() term keyed on that pattern: solid, long-dash, dot,
dash-dot. Traces are now distinguishable without relying on colour.
Dash-dot style was chosen for clarity under both Clean and Phosphor
shader styles.
EOF
)"
```

---

## Task 2: Dash patterns on the digital canvas

**Files:**
- Modify: `src/workers/render/shaders/digital.wgsl`
- Modify: `src/workers/render/pipelines/digital.ts`

- [ ] **Step 1: Update `digital.wgsl` with dash pattern support**

Replace `src/workers/render/shaders/digital.wgsl` with:

```wgsl
struct Uniforms {
  canvasSize: vec2<f32>,
  threshold: f32,
  yHigh: f32,
  yLow: f32,
  lineWidth: f32,
  writePointer: u32,
  bufferLength: u32,
  channelCount: u32,
};

struct ChannelConfig {
  color: vec4<f32>,
  yOffset: f32,
  dashPattern: u32,
  _pad: vec2<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> samples: array<f32>;
@group(0) @binding(2) var<storage, read> channels: array<ChannelConfig>;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) edgeDist: f32,
  @location(2) dashDist: f32,
  @location(3) @interpolate(flat) dashPattern: u32,
};

fn readSample(channel: u32, i: u32) -> f32 {
  let idx = (u.writePointer + i) & (u.bufferLength - 1u);
  return samples[channel * u.bufferLength + idx];
}

fn dashAlpha(pattern: u32, dist: f32) -> f32 {
  let cycle = 24.0;
  let t = fract(dist / cycle);
  switch pattern {
    case 0u: { return 1.0; }
    case 1u: { return select(0.0, 1.0, t < 0.6); }
    case 2u: { return select(0.0, 1.0, t < 0.18); }
    case 3u: {
      let a = t < 0.5 && t > 0.1;
      let b = t < 0.85 && t > 0.7;
      return select(0.0, 1.0, a || b);
    }
    default: { return 1.0; }
  }
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VSOut {
  let sampleIdx = vid / 2u;
  let side = f32(vid & 1u) * 2.0 - 1.0;
  let ch = channels[iid];

  let v = readSample(iid, sampleIdx);
  let yLocal = select(u.yLow, u.yHigh, v > u.threshold);
  let y = ch.yOffset + yLocal;

  let stepX = u.canvasSize.x / f32(u.bufferLength - 1u);
  let x = f32(sampleIdx) * stepX;

  let offsetY = side * u.lineWidth * 0.5;

  let screenX = x / u.canvasSize.x * 2.0 - 1.0;
  let screenY = 1.0 - (y + offsetY) / u.canvasSize.y * 2.0;

  var out: VSOut;
  out.pos = vec4<f32>(screenX, screenY, 0.0, 1.0);
  out.color = ch.color;
  out.edgeDist = side;
  out.dashDist = x;
  out.dashPattern = ch.dashPattern;
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let alpha = 1.0 - smoothstep(0.7, 1.0, abs(in.edgeDist));
  let dashA = dashAlpha(in.dashPattern, in.dashDist);
  return vec4<f32>(in.color.rgb, in.color.a * alpha * dashA);
}
```

- [ ] **Step 2: Verify the upload path is already correct**

No code change needed here. `render.worker.ts` imports `uploadChannels` from `pipelines/waveform.ts` (aliased as `uploadWaveformChannels`) and uses it to upload both `waveformRes.channelBuffer` **and** `digitalRes.channelBuffer`. That means Task 1's uploader change already fills the digital channel buffer with `dashPattern` at the correct byte offset — the digital shader just didn't know to read it until this task's shader edit.

Confirm the existing wiring:

```bash
grep -n "uploadWaveformChannels" src/workers/render/render.worker.ts
```

Expected: five or more hits, including `uploadWaveformChannels(..., this.digitalRes.channelBuffer, ...)` calls. No modifications to `pipelines/digital.ts` or `render.worker.ts` are needed in this task.

- [ ] **Step 3: Typecheck, tests, Biome, build**

```bash
bun run typecheck && bun run test && bun run check && bun run build
```

Expected: all pass.

- [ ] **Step 4: Manual browser verification**

```bash
bun run dev
```

Open the 4-bit accumulator. Confirm the **Digital Logic** pane at the top also shows distinct dash patterns per channel.

- [ ] **Step 5: Commit**

```bash
git add src/workers/render/shaders/digital.wgsl
git commit -m "$(cat <<'EOF'
feat(render): per-channel dash patterns on digital traces

The digital logic view now mirrors the waveform view's dash pattern
behaviour: channelIndex % 4 selects among solid, long-dash, dot,
dash-dot. Upload path reuses the same 32-byte ChannelConfig layout.
EOF
)"
```

---

## Task 3: Transition-only screen-reader announcements

**Files:**
- Create: `src/components/oscilloscope/ProbeStateAnnouncer.tsx`
- Modify: `src/components/oscilloscope/LiveVoltageReadouts.tsx`
- Modify: `src/components/oscilloscope/OscilloscopePanel.tsx`
- Create: `src/test/components/ProbeStateAnnouncer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/test/components/ProbeStateAnnouncer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { describe, expect, it } from "vitest";
import { voltageAtomFamily, circuitDefAtom } from "@/atoms/simulation-atoms";
import { activeProbeIdsAtom } from "@/atoms/ui-atoms";
import { ProbeStateAnnouncer } from "@/components/oscilloscope/ProbeStateAnnouncer";
import type { CircuitDefinition } from "@/lib/types";

const mini: CircuitDefinition = {
  id: "mini",
  name: "Mini",
  description: "",
  components: [],
  nets: [],
  probes: [
    { netId: "a", label: "A", color: "#fff", channelIndex: 0 },
    { netId: "b", label: "B", color: "#fff", channelIndex: 1 },
  ],
  controls: [],
};

describe("ProbeStateAnnouncer", () => {
  it("renders a visually-hidden polite live region", () => {
    const store = createStore();
    store.set(circuitDefAtom, mini);
    render(
      <Provider store={store}>
        <ProbeStateAnnouncer />
      </Provider>,
    );
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region.className).toContain("sr-only");
  });

  it("announces a probe crossing logicHighMin as HIGH", () => {
    const store = createStore();
    store.set(circuitDefAtom, mini);
    store.set(voltageAtomFamily("a"), 0);
    store.set(voltageAtomFamily("b"), 0);
    const { rerender } = render(
      <Provider store={store}>
        <ProbeStateAnnouncer />
      </Provider>,
    );
    store.set(voltageAtomFamily("a"), 1.5); // above logicHighMin (1.0)
    rerender(
      <Provider store={store}>
        <ProbeStateAnnouncer />
      </Provider>,
    );
    expect(screen.getByRole("status").textContent).toContain("A HIGH");
  });

  it("does not announce voltage changes within the Schmitt band", () => {
    const store = createStore();
    store.set(circuitDefAtom, mini);
    store.set(voltageAtomFamily("a"), 0);
    const { rerender } = render(
      <Provider store={store}>
        <ProbeStateAnnouncer />
      </Provider>,
    );
    store.set(voltageAtomFamily("a"), 0.7); // inside [logicLowMax=0.6, logicHighMin=1.0]
    rerender(
      <Provider store={store}>
        <ProbeStateAnnouncer />
      </Provider>,
    );
    expect(screen.getByRole("status").textContent ?? "").not.toContain("A HIGH");
    expect(screen.getByRole("status").textContent ?? "").not.toContain("A LOW");
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
bun run test src/test/components/ProbeStateAnnouncer.test.tsx
```

Expected: **FAIL** with `Cannot find module '@/components/oscilloscope/ProbeStateAnnouncer'`.

- [ ] **Step 3: Implement `ProbeStateAnnouncer`**

Create `src/components/oscilloscope/ProbeStateAnnouncer.tsx`:

```tsx
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { voltageAtomFamily } from "@/atoms/simulation-atoms";
import { activeProbesAtom } from "@/atoms/ui-atoms";
import { DefaultPhysicsConfig } from "@/lib/constants";
import type { Probe } from "@/lib/types";

function probeLogic(voltage: number, previous: 0 | 1): 0 | 1 {
  const { logicHighMin, logicLowMax } = DefaultPhysicsConfig.voltage;
  if (voltage > logicHighMin) return 1;
  if (voltage < logicLowMax) return 0;
  return previous;
}

type TransitionHandler = (netId: string, label: string, state: 0 | 1) => void;

function ProbeRow({
  probe,
  onTransition,
}: {
  probe: Probe;
  onTransition: TransitionHandler;
}) {
  const v = useAtomValue(voltageAtomFamily(probe.netId));
  const prevRef = useRef<0 | 1>(0);
  const current = probeLogic(v, prevRef.current);

  useEffect(() => {
    if (current !== prevRef.current) {
      prevRef.current = current;
      onTransition(probe.netId, probe.label, current);
    }
  }, [current, probe.netId, probe.label, onTransition]);

  return null;
}

export function ProbeStateAnnouncer() {
  const probes = useAtomValue(activeProbesAtom);
  const messagesRef = useRef<Map<string, string>>(new Map());
  const [message, setMessage] = useState<string>("");

  const handleTransition = useCallback<TransitionHandler>((netId, label, state) => {
    messagesRef.current.set(netId, `${label} ${state === 1 ? "HIGH" : "LOW"}`);
    setMessage(Array.from(messagesRef.current.values()).join(", "));
  }, []);

  return (
    <>
      {probes.map((p) => (
        <ProbeRow key={p.netId} probe={p} onTransition={handleTransition} />
      ))}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
    </>
  );
}
```

Design note: each `ProbeRow` subscribes to one probe's voltage via `useAtomValue`. When that voltage changes such that the Schmitt-style `probeLogic` returns a different value, the `useEffect` (running after commit, not during render) calls `onTransition`. The parent uses `setMessage` to update the live-region text. Using `useEffect` + `useState` avoids the React "cannot update a component while rendering a different component" warning that a direct-in-render setState would produce.

- [ ] **Step 4: Strip `aria-live` from `LiveVoltageReadouts`**

Open `src/components/oscilloscope/LiveVoltageReadouts.tsx`. Replace lines 17-30 (the exported function body) with:

```tsx
export function LiveVoltageReadouts() {
  const probes = useAtomValue(activeProbesAtom);
  return (
    <div className="absolute top-2 right-2 flex gap-1.5 pointer-events-none">
      {probes.map((p) => (
        <Readout key={p.netId} netId={p.netId} label={p.label} color={p.color} />
      ))}
    </div>
  );
}
```

Rationale: the visual readouts stay visible for sighted users; the live-region chatter moves to `ProbeStateAnnouncer` which fires only on transitions.

- [ ] **Step 5: Mount `ProbeStateAnnouncer` in `OscilloscopePanel`**

Open `src/components/oscilloscope/OscilloscopePanel.tsx`. Replace the file with:

```tsx
import type { RefObject } from "react";
import { DigitalCanvas } from "./DigitalCanvas";
import { InstrumentBezel } from "./InstrumentBezel";
import { Legend } from "./Legend";
import { LiveVoltageReadouts } from "./LiveVoltageReadouts";
import { ProbeStateAnnouncer } from "./ProbeStateAnnouncer";
import { WaveformCanvas } from "./WaveformCanvas";

interface Props {
  waveformRef: RefObject<HTMLCanvasElement | null>;
  digitalRef: RefObject<HTMLCanvasElement | null>;
}

export function OscilloscopePanel({ waveformRef, digitalRef }: Props) {
  return (
    <section className="grid grid-rows-[1fr_1fr_auto] min-h-0">
      <InstrumentBezel label="Digital Logic">
        <DigitalCanvas ref={digitalRef} />
      </InstrumentBezel>
      <InstrumentBezel label="Oscilloscope">
        <WaveformCanvas ref={waveformRef} />
        <LiveVoltageReadouts />
      </InstrumentBezel>
      <Legend />
      <ProbeStateAnnouncer />
    </section>
  );
}
```

- [ ] **Step 6: Run tests**

```bash
bun run test src/test/components/ProbeStateAnnouncer.test.tsx
```

Expected: **3 tests pass**.

If the test "announces a probe crossing logicHighMin as HIGH" fails because the text isn't updated, the issue is likely that React doesn't re-render after `renderMessageRef.current` mutation — refactor to use `useState` instead of a ref for the rendered message. In that case change `renderMessageRef` to:

```tsx
const [renderMessage, setRenderMessage] = useState("");
// inside handleChange:
messagesRef.current.set(netId, `${label} ${state === 1 ? "HIGH" : "LOW"}`);
setRenderMessage(Array.from(messagesRef.current.values()).join(", "));
```

And render `{renderMessage}` in the live region.

- [ ] **Step 7: Run full suite + typecheck + Biome + build**

```bash
bun run test && bun run typecheck && bun run check && bun run build
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/components/oscilloscope/ProbeStateAnnouncer.tsx src/components/oscilloscope/LiveVoltageReadouts.tsx src/components/oscilloscope/OscilloscopePanel.tsx src/test/components/ProbeStateAnnouncer.test.tsx
git commit -m "$(cat <<'EOF'
fix(a11y): announce probe logic transitions, not every voltage sample

LiveVoltageReadouts no longer wraps its visual readouts in aria-live;
a new ProbeStateAnnouncer component renders a visually-hidden polite
live region that fires only when a probe's Schmitt-thresholded voltage
transitions from HIGH to LOW or vice versa. Stops the 60 Hz tick
flood that was unusable with any screen reader.
EOF
)"
```

---

## Task 4: Schematic title / desc / role

**Files:**
- Create: `src/components/schematic/describe.ts`
- Create: `src/components/schematic/describe.test.ts`
- Modify: `src/components/schematic/CircuitSchematic.tsx`
- Create: `src/test/components/CircuitSchematic.test.tsx`

- [ ] **Step 1: Write the failing `describe.test.ts`**

Create `src/components/schematic/describe.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { adderCircuit } from "@/circuits/adder";
import { dffCircuit } from "@/circuits/dff";
import { buildSchematicDescription } from "./describe";

describe("buildSchematicDescription", () => {
  it("includes the circuit description for the DFF", () => {
    const text = buildSchematicDescription(dffCircuit);
    expect(text).toContain(dffCircuit.description);
  });

  it("includes a count of components and nets for the adder", () => {
    const text = buildSchematicDescription(adderCircuit);
    expect(text).toContain(`${adderCircuit.components.length} components`);
    expect(text).toContain(`${adderCircuit.nets.length} nets`);
  });

  it("groups components by type with their counts", () => {
    const text = buildSchematicDescription(adderCircuit);
    expect(text).toContain("4 DFlipFlop");
    expect(text).toContain("4 FullAdder");
    expect(text).toContain("4 SignalSource");
    expect(text).toContain("1 ClockSource");
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
bun run test src/components/schematic/describe.test.ts
```

Expected: **FAIL** with `Cannot find module './describe'`.

- [ ] **Step 3: Implement `buildSchematicDescription`**

Create `src/components/schematic/describe.ts`:

```ts
import type { CircuitDefinition } from "@/lib/types";

function groupByType(components: CircuitDefinition["components"]): [string, number][] {
  const counts = new Map<string, number>();
  for (const c of components) {
    counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  }
  return Array.from(counts.entries());
}

export function buildSchematicDescription(def: CircuitDefinition): string {
  const parts: string[] = [];
  if (def.description) parts.push(def.description);
  const typeSummary = groupByType(def.components)
    .map(([type, count]) => `${count} ${type}`)
    .join(", ");
  parts.push(`${def.components.length} components (${typeSummary})`);
  parts.push(`${def.nets.length} nets`);
  return parts.join(". ");
}
```

- [ ] **Step 4: Run tests**

```bash
bun run test src/components/schematic/describe.test.ts
```

Expected: **3 pass**.

- [ ] **Step 5: Write the failing CircuitSchematic component test**

Create `src/test/components/CircuitSchematic.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { describe, expect, it } from "vitest";
import { circuitDefAtom } from "@/atoms/simulation-atoms";
import { adderCircuit } from "@/circuits/adder";
import { dffCircuit } from "@/circuits/dff";
import { CircuitSchematic } from "@/components/schematic/CircuitSchematic";

function renderWith(def: typeof dffCircuit) {
  const store = createStore();
  store.set(circuitDefAtom, def);
  return render(
    <Provider store={store}>
      <CircuitSchematic />
    </Provider>,
  );
}

describe("CircuitSchematic", () => {
  it("renders an svg with role=img and aria-labelledby for the DFF", () => {
    renderWith(dffCircuit);
    const svg = screen.getByRole("img");
    const titleId = svg.getAttribute("aria-labelledby");
    expect(titleId).toBeTruthy();
    const title = titleId ? document.getElementById(titleId) : null;
    expect(title?.textContent).toContain(dffCircuit.name);
  });

  it("exposes a desc linked via aria-describedby for the adder", () => {
    renderWith(adderCircuit);
    const svg = screen.getByRole("img");
    const descId = svg.getAttribute("aria-describedby");
    expect(descId).toBeTruthy();
    const desc = descId ? document.getElementById(descId) : null;
    expect(desc?.textContent).toContain("13 components");
    expect(desc?.textContent).toContain("16 nets");
  });
});
```

- [ ] **Step 6: Run tests to confirm failure**

```bash
bun run test src/test/components/CircuitSchematic.test.tsx
```

Expected: **FAIL** — the current `CircuitSchematic` has no `role=img`.

- [ ] **Step 7: Update `CircuitSchematic.tsx`**

Replace `src/components/schematic/CircuitSchematic.tsx` with:

```tsx
import { useAtomValue } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { circuitDefAtom } from "@/atoms/simulation-atoms";
import { buildSchematicDescription } from "./describe";
import { SchematicGrid } from "./SchematicGrid";
import { SchematicNode } from "./SchematicNode";
import { SchematicWire } from "./SchematicWire";

export function CircuitSchematic() {
  const circuitDef = useAtomValue(circuitDefAtom);
  if (!circuitDef) return <div />;

  const VIEWBOX_W = 1200;
  const VIEWBOX_H = 400;
  const nodeW = 120;
  const nodeH = 80;
  const gap = 180;
  const startX = 80;
  const rowY = VIEWBOX_H / 2 - nodeH / 2;

  const titleId = `schematic-title-${circuitDef.id}`;
  const descId = `schematic-desc-${circuitDef.id}`;
  const description = buildSchematicDescription(circuitDef);

  const positions = new Map<string, { x: number; y: number }>();
  circuitDef.components.forEach((c, i) => {
    positions.set(c.id, { x: startX + i * (nodeW + gap), y: rowY });
  });

  interface WireData {
    netId: string;
    label: string;
    color: string;
    points: string;
  }

  const wires = circuitDef.nets
    .flatMap((net) => {
      const probe = circuitDef.probes.find((p) => p.netId === net.id);
      return net.loads.map((load): WireData | null => {
        const src = positions.get(net.driver.componentId);
        const dst = positions.get(load.componentId);
        if (!src || !dst) return null;
        const x1 = src.x + nodeW;
        const y1 = src.y + nodeH / 2;
        const x2 = dst.x;
        const y2 = dst.y + nodeH / 2;
        const mx = (x1 + x2) / 2;
        return {
          netId: net.id,
          label: probe?.label ?? net.id,
          color: probe?.color ?? "#6e738d",
          points: `${x1},${y1} ${mx},${y1} ${mx},${y2} ${x2},${y2}`,
        };
      });
    })
    .filter((w): w is WireData => w !== null);

  return (
    <section className="relative bg-mantle/80 overflow-hidden min-h-0">
      <div className="absolute top-0 left-0 right-0 z-10 px-4 py-1.5 flex items-baseline gap-3 text-xs uppercase tracking-[0.2em] text-subtext0 bg-mantle/60 backdrop-blur-sm border-b border-surface0">
        <span className="readout text-overlay1">Schematic</span>
        <span className="text-text">{circuitDef.name}</span>
        <span className="ml-auto readout text-[10px] text-overlay0">
          {circuitDef.components.length} components · {circuitDef.nets.length} nets
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.svg
          key={circuitDef.id}
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
          role="img"
          aria-labelledby={titleId}
          aria-describedby={descId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <title id={titleId}>Circuit schematic: {circuitDef.name}</title>
          <desc id={descId}>{description}</desc>
          <SchematicGrid />
          {wires.map((w) => (
            <SchematicWire
              key={`${w.netId}:${w.points}`}
              netId={w.netId}
              label={w.label}
              color={w.color}
              points={w.points}
            />
          ))}
          {circuitDef.components.map((c, idx) => (
            <SchematicNode
              key={c.id}
              component={c}
              x={startX + idx * (nodeW + gap)}
              y={rowY}
              width={nodeW}
              height={nodeH}
            />
          ))}
        </motion.svg>
      </AnimatePresence>
    </section>
  );
}
```

- [ ] **Step 8: Run tests**

```bash
bun run test src/test/components/CircuitSchematic.test.tsx src/components/schematic/describe.test.ts
```

Expected: **5 tests pass** (2 + 3).

- [ ] **Step 9: Run full suite + typecheck + Biome + build**

```bash
bun run test && bun run typecheck && bun run check && bun run build
```

Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add src/components/schematic/describe.ts src/components/schematic/describe.test.ts src/components/schematic/CircuitSchematic.tsx src/test/components/CircuitSchematic.test.tsx
git commit -m "$(cat <<'EOF'
feat(a11y): add role=img and title/desc to CircuitSchematic

SVG now exposes role=img with aria-labelledby and aria-describedby
pointing to an accessible title (circuit name) and description
(definition text + component type counts + net count). A new
buildSchematicDescription helper derives the summary from the
CircuitDefinition so future circuits get the same treatment for free.
EOF
)"
```

---

## Task 5: `DigitalCanvas` aria-label

**Files:**
- Modify: `src/components/oscilloscope/DigitalCanvas.tsx`

The current label is "Digital logic view"; tighten to match the pattern `WaveformCanvas` uses.

- [ ] **Step 1: Inspect current label**

```bash
cat src/components/oscilloscope/DigitalCanvas.tsx
```

Confirm the current line reads:

```tsx
<canvas ref={ref} className="w-full h-full block" aria-label="Digital logic view" />
```

- [ ] **Step 2: Update the aria-label**

Replace `src/components/oscilloscope/DigitalCanvas.tsx` with:

```tsx
import type { Ref } from "react";

interface Props {
  ref?: Ref<HTMLCanvasElement>;
}

export function DigitalCanvas({ ref }: Props) {
  return (
    <canvas
      ref={ref}
      className="w-full h-full block"
      aria-label="Digital logic waveform display"
    />
  );
}
```

- [ ] **Step 3: Run tests, typecheck, Biome, build**

```bash
bun run test && bun run typecheck && bun run check && bun run build
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/components/oscilloscope/DigitalCanvas.tsx
git commit -m "$(cat <<'EOF'
fix(a11y): tighten DigitalCanvas aria-label

Aligns the digital canvas's aria-label with the waveform canvas's
style ("Digital logic waveform display" vs. "Real-time analog
oscilloscope"). Both canvases now announce a precise description
when focused in an accessibility tree.
EOF
)"
```

---

## Verification Checklist

After all 5 tasks:

1. `bun run typecheck` → 0 errors.
2. `bun run check` → 0 Biome warnings.
3. `bun run test` → all tests pass, including 3 `describe` tests, 2 `CircuitSchematic` tests, 3 `ProbeStateAnnouncer` tests.
4. `bun run build` → succeeds.
5. Manual browser check (`bun run dev`):
   - Open the 4-bit accumulator. Confirm each probe trace has a distinct dash pattern under all three shader styles (Clean / Glow / Phosphor). Confirm the digital pane also dashes correctly.
   - Open dev tools → Accessibility tree. Focus the waveform canvas — reads "Real-time analog oscilloscope". Focus the digital canvas — reads "Digital logic waveform display". Inspect the schematic SVG — accessibility tree shows `role=img`, name `"Circuit schematic: 4-Bit Accumulator"`, description matching `buildSchematicDescription(adderCircuit)`.
   - Start a screen reader (NVDA on Windows / VoiceOver on macOS / Orca on Linux). Clock the adder. Confirm announcements only on transitions ("CLK HIGH, Q0 HIGH" on rising clock edges), not continuous voltage chatter.
6. `git log --oneline` shows five new commits: waveform dash → digital dash → transition announcer → schematic title/desc → DigitalCanvas aria-label.
