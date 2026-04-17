# Physically-Biased Metastability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the DFF's fair-coin metastability resolution with a sample-with-jitter model biased by `vD` at the clock edge, and hold Q visibly at the midpoint for the full `metaResolveTime` so the oscilloscope shows a real hover region.

**Architecture:** Two small changes in `DFlipFlop`: (1) capture `D` voltage on entering metastable state; (2) on `update(dt)`, while metastable, `snapTo(vMid)` each tick and — when the exponential resolution time elapses — set `targetLogic` via `noisyVd > vMid ? 1 : 0` where `noisyVd = vD + σ·gaussian()`. Introduces one config scalar `metaResolveNoiseSigma` and reuses the free `createGaussianSampler` primitive.

**Tech Stack:** TypeScript 6, Bun, Vitest 4, Biome 2.

**Spec reference:** `docs/superpowers/specs/2026-04-17-metastability-bias-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/workers/physics/gaussian.ts` | Create (if not already present from the analog-gates plan) | Free `createGaussianSampler(rng)` Marsaglia polar sampler |
| `src/workers/physics/gaussian.test.ts` | Create (ditto) | Tests for the sampler |
| `src/workers/physics/noise.ts` | Modify (ditto) | Delegate to the free sampler |
| `src/lib/types.ts` | Modify | Add `metaResolveNoiseSigma: number` to `TimingConfig` |
| `src/lib/constants.ts` | Modify | Add the field to `DefaultTiming` |
| `src/workers/physics/components/flip-flop.ts` | Modify | Capture vD, bias resolution, hover at mid |
| `src/workers/physics/components/flip-flop.test.ts` | Modify | Add bias + hover tests |

---

## Task 1: Extract `gaussianSample` into a reusable primitive

**Skip if Task 1 of `2026-04-17-analog-gates.md` has already been executed** (i.e. `src/workers/physics/gaussian.ts` exists and its tests pass). In that case jump to Task 2.

Otherwise this is a line-for-line copy of the analog-gates plan's Task 1. Reproduced here so the metastability plan is self-contained.

**Files:**
- Create: `src/workers/physics/gaussian.ts`
- Create: `src/workers/physics/gaussian.test.ts`
- Modify: `src/workers/physics/noise.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/workers/physics/gaussian.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/lib/rng";
import { createGaussianSampler } from "./gaussian";

describe("createGaussianSampler", () => {
  it("returns a function that produces finite numbers", () => {
    const sample = createGaussianSampler(createSeededRng(42));
    for (let i = 0; i < 100; i++) {
      const v = sample();
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("produces zero-mean samples with unit variance (loose tolerance)", () => {
    const sample = createGaussianSampler(createSeededRng(7));
    let sum = 0;
    let sumSq = 0;
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      const v = sample();
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(variance - 1)).toBeLessThan(0.1);
  });

  it("two independent samplers with the same seed produce the same sequence", () => {
    const a = createGaussianSampler(createSeededRng(1234));
    const b = createGaussianSampler(createSeededRng(1234));
    for (let i = 0; i < 20; i++) {
      expect(a()).toBeCloseTo(b(), 10);
    }
  });
});
```

- [ ] **Step 2: Run the tests (expect failure)**

```bash
bun run test src/workers/physics/gaussian.test.ts
```

Expected: **FAIL** — `Cannot find module './gaussian'`.

- [ ] **Step 3: Implement `gaussian.ts`**

Create `src/workers/physics/gaussian.ts`:

```ts
import type { RngFn } from "@/lib/types";

export function createGaussianSampler(rng: RngFn): () => number {
  let cache: number | null = null;
  return function sample(): number {
    if (cache !== null) {
      const cached = cache;
      cache = null;
      return cached;
    }
    let u: number;
    let v: number;
    let s: number;
    do {
      u = rng() * 2 - 1;
      v = rng() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const mul = Math.sqrt((-2.0 * Math.log(s)) / s);
    cache = v * mul;
    return u * mul;
  };
}
```

- [ ] **Step 4: Run tests**

```bash
bun run test src/workers/physics/gaussian.test.ts
```

Expected: **3 pass**.

- [ ] **Step 5: Refactor `noise.ts` to delegate**

Replace `src/workers/physics/noise.ts` with:

```ts
import type { RngFn } from "@/lib/types";
import { createGaussianSampler } from "./gaussian";

const FLICKER_RATIO = 4.0;

export class NoiseGenerator {
  private sigmaWhite: number;
  private sigmaFlicker: number;

  private readonly gaussian: () => number;
  private readonly octaves: number;
  private readonly generators: Float64Array;
  private runningSum: number = 0;
  private counter: number = 0;

  constructor(rng: RngFn, sigmaWhite: number, octaves: number = 8) {
    this.sigmaWhite = sigmaWhite;
    this.sigmaFlicker = sigmaWhite * FLICKER_RATIO;
    this.octaves = octaves;
    this.gaussian = createGaussianSampler(rng);

    this.generators = new Float64Array(octaves);
    for (let i = 0; i < octaves; i++) {
      const val = this.gaussian();
      this.generators[i] = val;
      this.runningSum += val;
    }
  }

  setSigma(sigmaWhite: number): void {
    this.sigmaWhite = sigmaWhite;
    this.sigmaFlicker = sigmaWhite * FLICKER_RATIO;
  }

  sample(): number {
    const white = this.gaussian() * this.sigmaWhite;
    const flicker = this.flickerSample() * this.sigmaFlicker;
    return white + flicker;
  }

  private flickerSample(): number {
    const idx = this.ctz(this.counter);
    if (idx < this.octaves) {
      this.runningSum -= this.generators[idx] ?? 0;
      const newVal = this.gaussian();
      this.generators[idx] = newVal;
      this.runningSum += newVal;
    }
    this.counter++;
    return this.runningSum / this.octaves;
  }

  private ctz(n: number): number {
    if (n === 0) return 32;
    return Math.log2(n & -n) | 0;
  }
}
```

- [ ] **Step 6: Full suite + typecheck + Biome**

```bash
bun run test && bun run typecheck && bun run check
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/workers/physics/gaussian.ts src/workers/physics/gaussian.test.ts src/workers/physics/noise.ts
git commit -m "$(cat <<'EOF'
refactor(physics): extract gaussianSample into a reusable primitive

Marsaglia polar sampling is now a free function returned by
createGaussianSampler(rng). NoiseGenerator delegates to it; the DFF's
metastability resolution (coming next commit) reuses the same
primitive without needing a NoiseGenerator instance.
EOF
)"
```

---

## Task 2: Add `metaResolveNoiseSigma` to `TimingConfig`

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Extend the `TimingConfig` interface**

Open `src/lib/types.ts`. Find the `TimingConfig` interface (around line 29-34):

```ts
export interface TimingConfig {
  readonly tSetup: number;
  readonly tHold: number;
  readonly tCQ: number;
  readonly tauMeta: number;
}
```

Change to:

```ts
export interface TimingConfig {
  readonly tSetup: number;
  readonly tHold: number;
  readonly tCQ: number;
  readonly tauMeta: number;
  readonly metaResolveNoiseSigma: number;
}
```

- [ ] **Step 2: Set the default in `constants.ts`**

Open `src/lib/constants.ts`. Modify `DefaultTiming` (lines 33-38) to:

```ts
export const DefaultTiming = {
  tSetup: 0.003,
  tHold: 0.001,
  tCQ: 0.002,
  tauMeta: 0.005,
  metaResolveNoiseSigma: 0.15,
} as const satisfies TimingConfig;
```

- [ ] **Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: **PASS** (the field is only read from DFF, not referenced elsewhere yet).

- [ ] **Step 4: Run the full suite**

```bash
bun run test
```

Expected: all existing tests pass.

- [ ] **Step 5: Biome**

```bash
bun run check
```

Expected: 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/constants.ts
git commit -m "$(cat <<'EOF'
feat(physics): add metaResolveNoiseSigma timing config

Standard deviation (volts RMS) of the Gaussian jitter added to the
sampled D voltage when metastability resolves. Default 0.15 V gives
visible bias for D offset by >0.3 * band_width from vMid while still
being occasionally uncertain near the midpoint.
EOF
)"
```

---

## Task 3: Bias metastability resolution by `vD` and hover at mid

**Files:**
- Modify: `src/workers/physics/components/flip-flop.ts`
- Modify: `src/workers/physics/components/flip-flop.test.ts`

- [ ] **Step 1: Write the failing tests**

Read the existing `src/workers/physics/components/flip-flop.test.ts` first to understand its structure, then append these new tests to that file inside the existing top-level `describe("DFlipFlop", ...)` block (if it exists) or in a new `describe` block at the end:

```ts
describe("DFlipFlop metastability (biased)", () => {
  const deps = (seed: number) => ({
    config: DefaultPhysicsConfig,
    rng: createSeededRng(seed),
  });
  const { logicHighMin, logicLowMax } = DefaultPhysicsConfig.voltage;
  const vMid = (logicHighMin + logicLowMax) / 2;
  const band = logicHighMin - logicLowMax;
  const dt = DefaultPhysicsConfig.simulation.physicsDt;
  const tauMeta = DefaultPhysicsConfig.timing.tauMeta;

  function runTrial(seed: number, dVoltage: number): 0 | 1 {
    const dff = new DFlipFlop("dff0", {}, deps(seed));
    const dPort = dff.inputs.get("d");
    const clkPort = dff.inputs.get("clk");
    const qPort = dff.outputs.get("q");
    if (!dPort || !clkPort || !qPort) throw new Error("DFF port missing");
    dPort.voltage = dVoltage;
    clkPort.voltage = DefaultPhysicsConfig.voltage.outputHighMax;
    dff.clock(dt);
    for (let i = 0; i < 1000; i++) dff.update(dt);
    return qPort.voltage > vMid ? 1 : 0;
  }

  it("D clearly HIGH in band resolves to HIGH in most trials", () => {
    const trials = 200;
    let highs = 0;
    const dHigh = vMid + 0.3 * band;
    for (let s = 0; s < trials; s++) {
      if (runTrial(s, dHigh) === 1) highs++;
    }
    expect(highs / trials).toBeGreaterThan(0.8);
  });

  it("D clearly LOW in band resolves to LOW in most trials", () => {
    const trials = 200;
    let lows = 0;
    const dLow = vMid - 0.3 * band;
    for (let s = 0; s < trials; s++) {
      if (runTrial(s, dLow) === 0) lows++;
    }
    expect(lows / trials).toBeGreaterThan(0.8);
  });

  it("D exactly at mid resolves roughly 50/50", () => {
    const trials = 400;
    let highs = 0;
    for (let s = 0; s < trials; s++) {
      if (runTrial(s, vMid) === 1) highs++;
    }
    const ratio = highs / trials;
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it("during metastable interval Q voltage hovers at mid", () => {
    const dff = new DFlipFlop("dff0", {}, deps(12345));
    const dPort = dff.inputs.get("d");
    const clkPort = dff.inputs.get("clk");
    const qPort = dff.outputs.get("q");
    if (!dPort || !clkPort || !qPort) throw new Error("DFF port missing");
    dPort.voltage = vMid;
    clkPort.voltage = DefaultPhysicsConfig.voltage.outputHighMax;
    dff.clock(dt);
    const shortTime = tauMeta * 0.1;
    const steps = Math.max(1, Math.floor(shortTime / dt));
    for (let i = 0; i < steps; i++) dff.update(dt);
    expect(Math.abs(qPort.voltage - vMid)).toBeLessThan(0.05);
  });

  it("after metaResolveTime Q settles to a rail", () => {
    const dff = new DFlipFlop("dff0", {}, deps(99));
    const dPort = dff.inputs.get("d");
    const clkPort = dff.inputs.get("clk");
    const qPort = dff.outputs.get("q");
    if (!dPort || !clkPort || !qPort) throw new Error("DFF port missing");
    dPort.voltage = vMid;
    clkPort.voltage = DefaultPhysicsConfig.voltage.outputHighMax;
    dff.clock(dt);
    for (let i = 0; i < 10_000; i++) dff.update(dt);
    const settled = qPort.voltage > logicHighMin || qPort.voltage < logicLowMax;
    expect(settled).toBe(true);
  });
});
```

If `flip-flop.test.ts` doesn't yet import `createSeededRng` and `DefaultPhysicsConfig` and `DFlipFlop`, add those imports at the top of the file. Imports should match existing style:

```ts
import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import { DFlipFlop } from "./flip-flop";
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun run test src/workers/physics/components/flip-flop.test.ts
```

Expected: the five new tests **FAIL** for various reasons:
- "D clearly HIGH in band resolves HIGH" — will pass sometimes (fair coin), fail more than 80% of time over 200 trials. Current implementation uses a fair coin; expect ratio around 50%, failing the `> 0.8` assertion.
- "during metastable interval Q hovers at mid" — current implementation snaps to mid only once; Signal then slews back to previous target; voltage is not at mid. Fails.

If existing DFF tests are still passing, that confirms you haven't broken anything yet.

- [ ] **Step 3: Modify `flip-flop.ts` to capture vD, bias, and hover**

Replace `src/workers/physics/components/flip-flop.ts` with:

```ts
import type { ComponentDeps, PhysicsConfig, Port, RngFn, SequentialComponent } from "@/lib/types";
import { createGaussianSampler } from "../gaussian";
import { NoiseGenerator } from "../noise";
import { Signal } from "../signal";
import { createPort } from "./base";

export class DFlipFlop implements SequentialComponent {
  readonly kind = "sequential" as const;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;

  private readonly qSignal: Signal;
  private readonly qPort: Port;
  private readonly clkPort: Port;
  private readonly dPort: Port;
  private readonly config: PhysicsConfig;
  private readonly rng: RngFn;
  private readonly gaussianSample: () => number;
  private readonly vMid: number;

  private lastClkLogic: 0 | 1 = 0;
  private resetActive: boolean = false;

  private metastable: boolean = false;
  private metaTimer: number = 0;
  private metaResolveTime: number = 0;
  private metaInputVoltage: number = 0;

  private pendingQ: 0 | 1 | null = null;
  private pendingTimer: number = 0;

  constructor(
    readonly id: string,
    _params: Record<string, unknown>,
    deps: ComponentDeps,
  ) {
    const { config, rng } = deps;
    this.config = config;
    this.rng = rng;
    this.gaussianSample = createGaussianSampler(rng);
    this.vMid = (config.voltage.logicHighMin + config.voltage.logicLowMax) / 2;

    const dPort = createPort("d");
    const clkPort = createPort("clk");
    const qPort = createPort("q");

    this.dPort = dPort;
    this.clkPort = clkPort;
    this.qPort = qPort;

    this.inputs = new Map([
      ["d", dPort],
      ["clk", clkPort],
    ]);
    this.outputs = new Map([["q", qPort]]);

    const noiseLevel =
      (config.simulation.defaultNoise / 100) *
      config.simulation.maxNoiseLevel *
      config.simulation.outputNoiseRatio;

    this.qSignal = new Signal(
      {
        baseHigh: (config.voltage.outputHighMin + config.voltage.outputHighMax) / 2,
        baseLow: config.voltage.outputLowMax / 2,
        zeta: 0.4,
        ringFreq: 120,
        clampMin: config.voltage.clampMin,
        clampMax: config.voltage.systemMax,
      },
      new NoiseGenerator(rng, noiseLevel),
    );
  }

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
        const jitter = sigma * this.gaussianSample();
        const noisy = this.metaInputVoltage + jitter;
        this.qSignal.targetLogic = noisy > this.vMid ? 1 : 0;
      } else {
        this.qSignal.snapTo(this.vMid);
        this.qPort.voltage = this.qSignal.voltage;
        return;
      }
    }

    this.qSignal.update(dt);
    this.qPort.voltage = this.qSignal.voltage;
  }

  clock(_dt: number): void {
    if (this.resetActive) {
      this.qSignal.targetLogic = 0;
      this.metastable = false;
      this.pendingQ = null;
      return;
    }

    const clkVoltage = this.clkPort.voltage;
    const { logicHighMin, logicLowMax } = this.config.voltage;

    let clkLogic: 0 | 1;
    if (clkVoltage > logicHighMin) {
      clkLogic = 1;
    } else if (clkVoltage < logicLowMax) {
      clkLogic = 0;
    } else {
      clkLogic = this.lastClkLogic;
    }

    const isRisingEdge = this.lastClkLogic === 0 && clkLogic === 1;
    this.lastClkLogic = clkLogic;

    if (!isRisingEdge) return;

    const dVoltage = this.dPort.voltage;

    if (dVoltage > logicHighMin) {
      this.scheduleQ(1);
    } else if (dVoltage < logicLowMax) {
      this.scheduleQ(0);
    } else {
      this.enterMetastable();
    }
  }

  setReset(active: boolean): void {
    this.resetActive = active;
  }

  private scheduleQ(logic: 0 | 1): void {
    this.pendingQ = logic;
    this.pendingTimer = this.config.timing.tCQ;
  }

  private enterMetastable(): void {
    this.metastable = true;
    this.metaTimer = 0;
    const u = this.rng();
    this.metaResolveTime = -this.config.timing.tauMeta * Math.log(u || 1e-10);
    this.metaInputVoltage = this.dPort.voltage;
    this.qSignal.snapTo(this.vMid);
  }
}
```

Key changes vs. the previous implementation:
- New private fields `gaussianSample`, `vMid`, `metaInputVoltage`.
- `enterMetastable()` captures `this.dPort.voltage` into `metaInputVoltage` and snaps the Signal to `this.vMid`.
- `update(dt)`'s metastable branch: while timer < resolution time, `snapTo(vMid)` each tick (hover). Once timer expires, resolution uses `this.metaInputVoltage + σ · gaussianSample()` thresholded against `vMid`.

- [ ] **Step 4: Run the tests**

```bash
bun run test src/workers/physics/components/flip-flop.test.ts
```

Expected: all five new tests pass, plus all existing DFF tests.

If the "D exactly at mid" test fails because the ratio is outside [0.4, 0.6], increase `trials` to 1000. If the "hovers at mid" test fails with voltage slightly off mid (e.g. 0.08 drift), the snap-to-mid isn't holding each tick — verify that the `else { snapTo; return; }` branch in `update` is being hit; add a `console.log` during dev if necessary.

- [ ] **Step 5: Run full suite + typecheck + Biome**

```bash
bun run test && bun run typecheck && bun run check
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/workers/physics/components/flip-flop.ts src/workers/physics/components/flip-flop.test.ts
git commit -m "$(cat <<'EOF'
feat(physics): bias metastability resolution by D voltage and hover at mid

On clock-edge-in-band, DFF now captures D voltage, holds Q at mid for
the whole exponential-distributed resolution interval (via snapTo each
tick), and — when the timer expires — resolves to HIGH/LOW based on
vD + sigma * gaussian() > vMid. Oscilloscope now shows a visible
hover region instead of a silent wait-then-snap. Scope's bias matches
physical latch behaviour: D above mid usually resolves HIGH, D below
mid usually resolves LOW.
EOF
)"
```

---

## Verification Checklist

After all 3 tasks:

1. `bun run typecheck` → 0 errors.
2. `bun run check` → 0 Biome warnings.
3. `bun run test` → all tests pass, including the 3 gaussian tests and the 5 new DFF metastability tests.
4. `bun run build` → succeeds.
5. Manual browser check (`bun run dev`), using the DFF circuit:
   - Set D input somewhere in the undefined band (the DFF circuit's "D Input" slider with the target logic around 0.8 V — between `logicLowMax=0.6` and `logicHighMin=1.0`).
   - Watch a few clock edges. Confirm Q visibly hovers at mid for a variable (exponential) duration, then snaps to HIGH or LOW.
   - Nudge the D slider slightly above mid — confirm HIGH resolutions dominate over a dozen edges.
   - Nudge the D slider slightly below mid — confirm LOW resolutions dominate.
6. `git log --oneline` shows two or three new commits depending on whether Task 1 was already done: extract gaussianSample (conditional) → add metaResolveNoiseSigma config → bias + hover DFF change.
