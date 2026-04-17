# CircuitGraph Port-to-Driver Index + WaveformBuffer Rename

## Context

Two targeted, mechanical improvements surfaced by the 2026-04-17 project audit. Neither changes observable behaviour; both clean up code that the audit flagged as misleading or quadratic.

1. `CircuitGraph.findDriverOf` (`src/workers/physics/graph.ts:151-162`) performs a nested scan of every net × every component × every output. It is called per-input per-iteration from `levelize()` during construction.
2. `WaveformBuffer.toInterleavedBuffer()` (`src/workers/physics/waveform-buffer.ts:49-55`) is misnamed. It produces a channel-major layout `[ch0_0..ch0_N, ch1_0..ch1_N, ...]`, which is exactly what the waveform WGSL shader at `src/workers/render/shaders/waveform.vert.wgsl:30` expects (`samples[channel * bufferLength + idx]`). Data flow is correct end-to-end; only the method name lies.

## Goals

- Replace the nested-scan driver lookup with a single-lookup `Map<Port, string>` populated in the `CircuitGraph` constructor.
- Rename `toInterleavedBuffer` → `toChannelMajorBuffer` and update its one production caller and its tests.

## Non-Goals

- No change to physics loop, worker RPC surface, WGSL pipeline, or wire-format layout.
- No rewrite of `levelize()` itself — the outer net-walk in `findDriverOf` stays; only the inner scan is replaced.
- No addition of a second `loadPort → Net` index. The gain is marginal inside `levelize` and would add storage for no observable benefit. Deferred until a caller actually needs it.

## Design

### C.1 — Port-to-driver index

Add a private field to `CircuitGraph`:

```ts
private readonly portToDriverId = new Map<Port, string>();
```

Populate it inside the existing net-wiring loop in the constructor (same loop that builds `this.nets`), immediately after resolving the driver port:

```ts
const driverPort = driverComp.outputs.get(netDef.driver.port);
if (!driverPort) {
  throw new Error(`Unknown output port: ${netDef.driver.componentId}.${netDef.driver.port}`);
}
this.portToDriverId.set(driverPort, netDef.driver.componentId);
```

Collapse `findDriverOf` to:

```ts
private findDriverOf(port: Port): string | null {
  for (const net of this.nets.values()) {
    if (net.loadPorts.includes(port)) {
      return this.portToDriverId.get(net.driverPort) ?? null;
    }
  }
  return null;
}
```

Behaviour is identical. The returned driver ID is the same one the nested scan would have found because every net has exactly one driver, and that driver's owning component is the one we stored at wiring time.

### C.2 — Method rename

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

Unchanged.

- `findDriverOf` still returns `null` for unconnected load ports. `levelize` still treats `null` as "input is at level 0", preserving today's behaviour for floating inputs (they see 0 V and combinational gates read them as LOW).
- Constructor still throws on unknown component or port IDs.
- `WaveformBuffer.push`, `getChannel`, and length validation are untouched.

## Testing

- **No new behavioural tests needed** for C.1. The existing `graph.test.ts` exercises `CircuitGraph` construction with real circuits (DFF and via `registry.test.ts`, the adder), which calls `levelize()` and therefore `findDriverOf`. If the index is wrong, those tests break.
- **Add one narrow edge-case test** in `graph.test.ts`: construct a `CircuitGraph` containing a combinational component whose input is not driven by any net, confirm it constructs without throwing. Guards the `null` return path that today relies on the nested scan falling through.
- **C.2 tests**: `waveform-buffer.test.ts` already covers the method body. Rename the call sites. No new tests.

## Rollout

Single commit, both changes bundled:

```
refactor(physics): add port→driver index to CircuitGraph and rename toInterleavedBuffer

The nested findDriverOf scan becomes O(1) via a Map populated in the
constructor. toInterleavedBuffer is renamed to toChannelMajorBuffer to
match the actual layout (the WGSL shader reads channel * bufferLength
+ idx). No behaviour change; the on-wire bytes are identical.
```

## Verification Checklist

1. `bun run typecheck` → 0 errors.
2. `bun run check` → 0 Biome warnings.
3. `bun run test` → all existing tests pass, plus one new floating-input graph test.
4. `bun run build` → succeeds.
5. `bun run dev`, open the DFF and adder circuits in the browser, confirm oscilloscope traces render identically (visual regression check).
