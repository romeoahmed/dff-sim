# WaveformBuffer Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `WaveformBuffer.toInterleavedBuffer()` to `toChannelMajorBuffer()` so the method name matches the layout it actually produces (channel-major: `[ch0_0..ch0_N, ch1_0..ch1_N, ...]`), which is what the WGSL shader at `src/workers/render/shaders/waveform.vert.wgsl:30` already reads via `samples[channel * bufferLength + idx]`.

**Architecture:** Pure behaviour-preserving rename. Two files change: the method declaration in `src/workers/physics/waveform-buffer.ts` and its one caller in `src/workers/physics/physics.worker.ts`. The method body and the bytes on the wire between the physics and render workers are byte-identical before and after. The existing test file has no references to the old name and therefore needs no changes.

**Tech Stack:** TypeScript 6, Bun, Vitest 4, Biome 2.

**Spec reference:** `docs/superpowers/specs/2026-04-17-buffer-rename-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/workers/physics/waveform-buffer.ts` | Modify (line 49) | Rename the method |
| `src/workers/physics/physics.worker.ts` | Modify (line 97) | Update the caller |

No new files. No test file changes.

---

## Task 1: Rename `toInterleavedBuffer` to `toChannelMajorBuffer`

**Files:**
- Modify: `src/workers/physics/physics.worker.ts:97`
- Modify: `src/workers/physics/waveform-buffer.ts:49`

We update the caller *first*, so that `bun run typecheck` becomes the "red" signal — it fails because the new method name does not yet exist on `WaveformBuffer`. Then we rename the method; the typecheck goes green.

### Step 1: Update the production caller in `physics.worker.ts`

Open `src/workers/physics/physics.worker.ts` and find line 97. The current code is:

```ts
      const payload = buf.toInterleavedBuffer();
```

Change it to:

```ts
      const payload = buf.toChannelMajorBuffer();
```

That is the only change in this file.

- [ ] Edit applied.

### Step 2: Run typecheck to verify it fails

```bash
bun run typecheck
```

Expected: **FAIL** with an error like:

```
src/workers/physics/physics.worker.ts:97:32 - error TS2551:
  Property 'toChannelMajorBuffer' does not exist on type 'WaveformBuffer'.
  Did you mean 'toInterleavedBuffer'?
```

This confirms the compiler sees the caller's new reference and knows the method has not yet been renamed.

- [ ] Typecheck fails with the expected error.

### Step 3: Rename the method in `waveform-buffer.ts`

Open `src/workers/physics/waveform-buffer.ts`. Find line 49:

```ts
  toInterleavedBuffer(): Float32Array {
    const buf = new Float32Array(this.channelCount * this.length);
    for (let c = 0; c < this.channelCount; c++) {
      buf.set(this.getChannel(c), c * this.length);
    }
    return buf;
  }
```

Change the method name (and nothing else) to:

```ts
  toChannelMajorBuffer(): Float32Array {
    const buf = new Float32Array(this.channelCount * this.length);
    for (let c = 0; c < this.channelCount; c++) {
      buf.set(this.getChannel(c), c * this.length);
    }
    return buf;
  }
```

The body is byte-identical. Only the identifier on line 49 changes.

- [ ] Edit applied.

### Step 4: Run typecheck to verify it passes

```bash
bun run typecheck
```

Expected: **PASS** (no output, exit code 0).

- [ ] Typecheck passes.

### Step 5: Run the full test suite to verify no regressions

```bash
bun run test
```

Expected: **all 101 tests across 20 files pass**, identical to the baseline before this change. The `waveform-buffer.test.ts` tests do not reference the renamed method, but they exercise the class and confirm nothing else broke.

- [ ] All tests pass.

### Step 6: Run Biome check

```bash
bun run check
```

Expected: **0 errors, 0 warnings**.

- [ ] Biome passes.

### Step 7: Run production build

```bash
bun run build
```

Expected: **successful build** — no TypeScript errors, no bundling errors, `dist/` populated.

- [ ] Build succeeds.

### Step 8: Manual browser verification (visual regression guard)

This is the final check that the rename hasn't somehow broken the data path from the physics worker to the render worker. Because the method body is unchanged, the bytes on the `MessagePort` are identical — but verifying in a real browser rules out any build-tool caching weirdness.

```bash
bun run dev
```

Open `http://localhost:5173`. In the circuit selector, switch between **D Flip-Flop** and **4-Bit Accumulator**. For each:

- Confirm the oscilloscope waveform traces render.
- Confirm the digital waveform traces render.
- Toggle at least one control (clock speed slider for DFF; an A-bit toggle for the accumulator) and confirm the traces respond.
- Try each of the three shader styles (Clean / Glow / Phosphor) via the toolbar — each should render identically to before the rename.

Stop the dev server (`Ctrl-C`) when done.

- [ ] Waveforms render correctly in all three shader styles on both circuits.

### Step 9: Commit

Stage exactly the two modified files (avoid accidentally picking up untracked files):

```bash
git add src/workers/physics/waveform-buffer.ts src/workers/physics/physics.worker.ts
```

Verify the stage is clean:

```bash
git status --short
```

Expected output:

```
M  src/workers/physics/physics.worker.ts
M  src/workers/physics/waveform-buffer.ts
```

Create the commit:

```bash
git commit -m "$(cat <<'EOF'
refactor(physics): rename toInterleavedBuffer to toChannelMajorBuffer

The method produces channel-major layout (all samples of channel 0,
then all samples of channel 1, ...). The WGSL shader reads it as
samples[channel * bufferLength + idx]. "Interleaved" implied the
opposite layout; the new name matches reality. Bytes on the wire are
unchanged.
EOF
)"
```

Confirm the commit landed:

```bash
git log -1 --oneline
```

- [ ] Commit created.

---

## Verification Checklist

After Task 1 is complete:

1. `bun run typecheck` → 0 errors.
2. `bun run check` → 0 Biome warnings.
3. `bun run test` → 101 tests pass across 20 files.
4. `bun run build` → succeeds.
5. Manual browser check (from Step 8) confirms oscilloscope renders correctly on both circuits across all three shader styles.
6. `git log` shows one new `refactor(physics): rename toInterleavedBuffer…` commit.
7. `git grep toInterleavedBuffer -- src/` returns no hits (the old name no longer appears anywhere in the source tree).

That last check is the definitive proof that the rename is complete:

```bash
git grep toInterleavedBuffer -- src/
```

Expected: no output (exit code 1, which grep uses for "no matches").
