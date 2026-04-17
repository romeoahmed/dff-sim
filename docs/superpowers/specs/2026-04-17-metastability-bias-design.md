# Physically-Biased Metastability Resolution

## Context

`DFlipFlop.enterMetastable()` and its resolution path (`src/workers/physics/components/flip-flop.ts:78-84`, `135-141`) have two shortcomings surfaced by the 2026-04-17 audit:

1. **Resolution is a fair coin.** When a clock edge samples D inside the Schmitt band, the eventual resolved bit is chosen via `rng() > 0.5`, ignoring where D actually sat. In a real latch, tiny voltage differences are amplified exponentially — if D was slightly above mid, resolution to 1 is likelier; slightly below, 0 is likelier.
2. **Q doesn't visibly hover at mid.** On entering metastable the Signal is `snapTo(systemMax/2)`, but its `targetLogic` is never touched, so the damped integrator starts slewing back toward the *previous* latched target. The scope shows the old Q value continuing, then a sudden flip. Real metastable outputs linger at the midpoint for the whole resolution time.

## Goals

1. Resolution bit biased by `vD` at clock edge, with a tunable noise spread (σ) so the outcome is still probabilistic near the midpoint.
2. During the metastable interval, Q visibly holds at mid on the oscilloscope.
3. No change to exponential resolution-time distribution; no change to metastability entry condition (D inside the Schmitt band at a rising clock edge).

## Non-Goals

- No change to `Signal`'s type surface (`targetLogic` stays `0 | 1`).
- No change to engine loop ordering.
- No new component types or wire-format changes.

## Design

### Config

Add one scalar to `DefaultPhysicsConfig.timing` in `src/lib/constants.ts`:

```ts
timing: {
  // ... existing fields ...
  metaResolveNoiseSigma: 0.15,  // volts RMS; tune to taste during implementation
}
```

Sigma is the standard deviation of the Gaussian jitter added to the sampled D voltage before it's thresholded. Small σ → resolution strongly follows D. Large σ → approaches a fair coin.

### `DFlipFlop` changes

One new field (the sampled D voltage):

```ts
private metaInputVoltage: number = 0;
```

One new field cached from config for readability (optional, to avoid recomputing `vMid` per tick):

```ts
private readonly vMid: number;
// in constructor:
this.vMid = (config.voltage.logicHighMin + config.voltage.logicLowMax) / 2;
```

`enterMetastable()` captures D:

```ts
private enterMetastable(): void {
  this.metastable = true;
  this.metaTimer = 0;
  const u = this.rng();
  this.metaResolveTime = -this.config.timing.tauMeta * Math.log(u || 1e-10);
  this.metaInputVoltage = this.dPort.voltage;
  this.qSignal.snapTo(this.vMid);
}
```

### Resolution — sample-with-jitter

Replace the fair-coin resolution in `update(dt)`:

```ts
// inside update(dt), when metaTimer >= metaResolveTime:
this.metastable = false;
const sigma = this.config.timing.metaResolveNoiseSigma;
const jitter = sigma * gaussianSample(this.rng);
const noisy = this.metaInputVoltage + jitter;
this.qSignal.targetLogic = noisy > this.vMid ? 1 : 0;
```

`gaussianSample(rng)` is the existing Marsaglia polar sampler. `NoiseGenerator.sample()` already implements it but it's coupled to a fixed amplitude. Extract or reuse:

- **Option A** (preferred): move the Marsaglia implementation into a shared standalone `gaussianSample(rng: RngFn): number` function in a new `src/workers/physics/gaussian.ts` (or inline it into `noise.ts` as an exported top-level function). `NoiseGenerator` calls it internally; `DFlipFlop` imports it directly. One source of truth.
- **Option B**: `DFlipFlop` constructs its own `NoiseGenerator` at σ=1, scales by sigma at call time. Works but creates a second noise generator for a one-shot use.

Go with option A — cleaner and gives us a reusable primitive.

### Hover at mid during metastable

In `update(dt)`, when metastable and timer not yet expired, hold Q at the midpoint:

```ts
update(dt: number): void {
  if (this.pendingQ !== null) {
    this.pendingTimer -= dt;
    if (this.pendingTimer <= 0) {
      this.qSignal.targetLogic = this.pendingQ;
      this.pendingQ = null;
    }
  }

  if (this.metastable) {
    this.metaTimer += dt;
    if (this.metaTimer >= this.metaResolveTime) {
      this.metastable = false;
      const sigma = this.config.timing.metaResolveNoiseSigma;
      const jitter = sigma * gaussianSample(this.rng);
      const noisy = this.metaInputVoltage + jitter;
      this.qSignal.targetLogic = noisy > this.vMid ? 1 : 0;
    } else {
      // Hover at mid for the whole metaResolveTime; skip normal Signal update
      this.qSignal.snapTo(this.vMid);
      this.qPort.voltage = this.qSignal.voltage;
      return;
    }
  }

  this.qSignal.update(dt);
  this.qPort.voltage = this.qSignal.voltage;
}
```

Key points:
- `snapTo(vMid)` each tick sets Signal's position *and* velocity to match a stationary state at mid, so the Signal doesn't slew away between ticks.
- After the resolve-time boundary crosses, we fall through to the normal `qSignal.update(dt)` so the Signal slews smoothly from mid to the resolved rail.
- Q port is written inside both branches so probes see either mid (hover) or the slewing Signal (resolving).

### `Signal.snapTo` hygiene

`Signal.snapTo` today takes one `voltage` arg and sets `x1 = voltage`, `x2 = 0`. No change needed. Called every tick during hover — idempotent and cheap.

## Data Flow

Nothing changes outside `DFlipFlop`. The scope probe on Q sees:

1. Previous latched value (e.g. 0V near `baseLow`).
2. Clock edge hits, D is in undefined band.
3. `qSignal.snapTo(vMid)` → Q jumps to ~mid (single-tick transition).
4. Q holds at mid for a random duration drawn from `exp(1/tauMeta)`.
5. Resolution picks a rail biased by sampled vD; `targetLogic` is set; Signal slews smoothly to the resolved rail with normal 2nd-order dynamics.

## Testing

### Unit tests — `flip-flop.test.ts` additions

Seed the RNG so tests are deterministic. `createSeededRng(n)` already exists.

1. **D clearly HIGH in band → resolves HIGH most of the time.** Repeat N trials (e.g. 200) with `d.voltage = vMid + 0.3 * (logicHighMin - logicLowMax)`. Assert resolved to 1 in ≥ 80 % of runs. (Exact threshold tuned to default σ; pick a margin that isn't flaky.)
2. **D clearly LOW in band → resolves LOW most of the time.** Symmetric.
3. **D at mid → resolution is approximately fair.** N trials with `d.voltage = vMid`; assert the ratio of 1s is within ±10 % of 0.5.
4. **Hover behaviour.** After clock edge with D at vMid, step the DFF for a few ticks but less than `metaResolveTime`; assert `qPort.voltage ≈ vMid` (within `Signal.snapTo` precision).
5. **Resolution transitions from hover.** Step past `metaResolveTime`, assert that Q port voltage eventually reaches the resolved rail (within a settling window).

### Non-tests

- No changes needed to `and-gate.test.ts`, `graph.test.ts`, `simulation.engine.test.ts`, `waveform-buffer.test.ts`.

## Risks

1. **Probabilistic test flakiness.** Using seeded RNG and wide acceptance margins (≥ 80 %, not ≥ 95 %) keeps tests deterministic without being fragile to sigma tuning.
2. **σ tuning is UX, not correctness.** Default σ of 0.15 V is a starting point. During `bun run dev` verification, nudge in `DefaultPhysicsConfig` until metastability looks "visible but plausible" on the scope. Document the tuned value in the config with a short why-comment.
3. **Back-to-back metastability.** If a clock edge occurs while the DFF is already metastable, current code's behaviour: `clock(dt)` is called every tick; on the next clock edge, `enterMetastable` re-runs, overwriting `metaInputVoltage` and resetting the timer. This is accidentally correct (new edge, new sample) but fragile. No change in this spec, but worth a comment in the code.
4. **`snapTo(vMid)` every tick wastes ≈ 3 FLOPS × channel count × ticks.** Negligible.

## Rollout

Two commits:

1. `refactor(physics): extract gaussianSample() into a reusable primitive` — extracts the Marsaglia polar sampler from `NoiseGenerator` into a free function; `NoiseGenerator` delegates to it. No behaviour change. Unit tests added for the free function.
2. `feat(physics): bias metastability resolution by D voltage and hover at mid` — the DFF change, config scalar, and new unit tests.

## Verification Checklist

1. `bun run typecheck` → 0 errors.
2. `bun run check` → 0 Biome warnings.
3. `bun run test` → all tests pass including the five new metastability tests.
4. `bun run build` → succeeds.
5. `bun run dev`, open the DFF circuit, hold D near mid at a clock edge. Confirm the scope shows Q visibly hovering at mid for a variable duration, then snapping to one rail. Repeat with D slightly above mid — confirm HIGH resolutions dominate. Repeat slightly below mid — confirm LOW resolutions dominate.

## Dependencies

- **Independent** of A (analog gates) and D (accessibility). Can be implemented before, alongside, or after either.
- The `gaussianSample` extraction in step 1 is a generally useful primitive; if A is implemented first, A may also want to use it. No blocking order either way.
