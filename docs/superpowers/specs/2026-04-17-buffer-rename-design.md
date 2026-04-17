# WaveformBuffer Rename (`toInterleavedBuffer` → `toChannelMajorBuffer`)

## Context

Surfaced by the 2026-04-17 project audit. `WaveformBuffer.toInterleavedBuffer()` (`src/workers/physics/waveform-buffer.ts:49-55`) is misnamed. It produces a channel-major layout `[ch0_0..ch0_N, ch1_0..ch1_N, ...]`, which is exactly what the waveform WGSL shader at `src/workers/render/shaders/waveform.vert.wgsl:30` expects (`samples[channel * bufferLength + idx]`). Data flow is correct end-to-end; only the method name lies. True interleaving would be `[ch0_0, ch1_0, ch2_0, ch0_1, ...]` — that's the reading most programmers would infer, which makes the current name actively misleading.

> **Scope note:** An earlier draft of this spec also included a port-to-driver index refactor (`findDriverOf` optimization) in `CircuitGraph`. That work is **subsumed by the "Analog dynamics on combinational gates" spec** (`2026-04-17-analog-gates-design.md`), which deletes `levelize()` and `findDriverOf` entirely. Doing both would mean building an index that's immediately thrown away. Only the rename survives here.

## Goals

- Rename `toInterleavedBuffer` → `toChannelMajorBuffer` and update its one production caller and its tests.

## Non-Goals

- No change to physics loop, worker RPC surface, WGSL pipeline, or wire-format layout.
- No behavioural change anywhere.

## Design

In `src/workers/physics/waveform-buffer.ts`, rename the method:

```ts
toChannelMajorBuffer(): Float32Array {
  // body unchanged
}
```

Update the single production caller at `src/workers/physics/physics.worker.ts:97`:

```ts
const payload = buf.toChannelMajorBuffer();
```

Update `src/workers/physics/waveform-buffer.test.ts` — mechanical find-replace of the method name in the existing tests.

## Data Flow

Unchanged. The shader still reads `samples[channel * u.bufferLength + idx]`. The physics worker still posts a `Float32Array` with the same bytes. The render worker's `device.queue.writeBuffer(...)` call is agnostic to the method name.

## Error Handling

Unchanged. `WaveformBuffer.push`, `getChannel`, and length validation are untouched.

## Testing

Existing `waveform-buffer.test.ts` already covers the method body. Rename the call sites. No new tests.

## Rollout

Single commit:

```
refactor(physics): rename toInterleavedBuffer to toChannelMajorBuffer

The method produces channel-major layout (all samples of channel 0,
then all samples of channel 1, ...). The WGSL shader reads it as
samples[channel * bufferLength + idx]. "Interleaved" implied the
opposite layout; the new name matches reality. Bytes on the wire are
unchanged.
```

## Verification Checklist

1. `bun run typecheck` → 0 errors.
2. `bun run check` → 0 Biome warnings.
3. `bun run test` → all existing tests pass.
4. `bun run build` → succeeds.
5. `bun run dev`, open the DFF and adder circuits in the browser, confirm oscilloscope traces render identically (visual regression check).
