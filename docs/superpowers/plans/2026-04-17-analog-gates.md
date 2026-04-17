# Analog Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every combinational gate (AND/OR/XOR/NOT/FullAdder) real analog output dynamics — 2nd-order slew/ringing via `Signal`, per-instance propagation delay `tPD`, and Gaussian + 1/f output noise — via a new shared `AnalogOutput` helper. Change the engine loop to call `update(dt)` on combinational components each tick, drop topological-sort and cycle-rejection in `CircuitGraph`, and unlock feedback circuits (SR latches, ring oscillators).

**Architecture:** One new physics primitive (`AnalogOutput`) composes `Signal` + `NoiseGenerator` + a pending-`tPD` timer. Each gate owns one `AnalogOutput` per output port (`FullAdder` owns two). `CombinationalComponent` grows a required `update(dt)` method. The simulation engine adds a combinational-update phase; `CircuitGraph` loses `levelize()` and `findDriverOf()` because each gate reacts to whatever voltage its input currently has — intra-tick ordering is no longer needed, and feedback loops become physically valid.

**Tech Stack:** TypeScript 6 (strict), Bun, Vitest 4, Biome 2.

**Spec reference:** `docs/superpowers/specs/2026-04-17-analog-gates-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/workers/physics/gaussian.ts` | Create | Free `gaussianSample(rng): number` Marsaglia polar sampler |
| `src/workers/physics/gaussian.test.ts` | Create | Tests for the free function |
| `src/workers/physics/noise.ts` | Modify | Delegate to `gaussianSample` |
| `src/lib/constants.ts` | Modify | Add `DefaultGates` block; wire into `DefaultPhysicsConfig` |
| `src/lib/types.ts` | Modify | Add `GatesConfig` interface; extend `PhysicsConfig`; add required `update(dt)` to `CombinationalComponent` |
| `src/workers/physics/analog-output.ts` | Create | `AnalogOutput` class + `mergeGateParams` helper |
| `src/workers/physics/analog-output.test.ts` | Create | Unit tests for AnalogOutput |
| `src/workers/physics/test-helpers.ts` | Create | `settle(comp, dt, duration)` helper for gate tests |
| `src/workers/physics/components/and-gate.ts` | Modify | Swap to AnalogOutput |
| `src/workers/physics/components/or-gate.ts` | Modify | Swap to AnalogOutput |
| `src/workers/physics/components/xor-gate.ts` | Modify | Swap to AnalogOutput |
| `src/workers/physics/components/not-gate.ts` | Modify | Swap to AnalogOutput |
| `src/workers/physics/components/full-adder.ts` | Modify | Swap to AnalogOutput (two outputs) |
| `src/workers/physics/components/and-gate.test.ts` | Modify | Use `settle()` helper |
| `src/workers/physics/components/or-gate.test.ts` | Modify | Use `settle()` helper |
| `src/workers/physics/components/xor-gate.test.ts` | Modify | Use `settle()` helper |
| `src/workers/physics/components/not-gate.test.ts` | Modify | Use `settle()` helper |
| `src/workers/physics/components/full-adder.test.ts` | Modify | Use `settle()` helper |
| `src/workers/physics/graph.ts` | Modify | Drop `levelize`, `findDriverOf`, `combinationalOrder`; add `combinationalList`; add `updateCombinational(dt)`; add `getCombinational()` |
| `src/workers/physics/engine.ts` | Modify | New loop: seq.update → propagate → seq.clock → comb.evaluate → comb.update → propagate → buffer |
| `src/circuits/adder.test.ts` | Modify | Integration test updated to tolerate settling time |
| `src/circuits/ring-oscillator.test.ts` | Create | New feedback-circuit integration test |
| `README.md` | Modify | Note ripple-settling behaviour on the adder circuit |

---

## Task 1: Extract `gaussianSample` into a reusable primitive

This pre-req is shared with the metastability-bias plan. If that plan has already been executed, `src/workers/physics/gaussian.ts` will exist already — skip to Task 2.

**Files:**
- Create: `src/workers/physics/gaussian.ts`
- Create: `src/workers/physics/gaussian.test.ts`
- Modify: `src/workers/physics/noise.ts`

- [ ] **Step 1: Write the failing test**

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

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test src/workers/physics/gaussian.test.ts
```

Expected: **FAIL** with `Cannot find module './gaussian'`.

- [ ] **Step 3: Create the implementation**

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

This is the Marsaglia polar method with a one-sample cache. Each call to the returned closure yields one standard-normal sample.

- [ ] **Step 4: Run the gaussian tests**

```bash
bun run test src/workers/physics/gaussian.test.ts
```

Expected: **3 tests pass**.

- [ ] **Step 5: Refactor `NoiseGenerator` to delegate to `createGaussianSampler`**

Edit `src/workers/physics/noise.ts`. Replace the entire file with:

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

The behavioural contract is unchanged: `NoiseGenerator` still produces a white-plus-flicker noise stream indexed by internal RNG state. Only the Gaussian sampling moves out.

- [ ] **Step 6: Run the full test suite**

```bash
bun run test
```

Expected: **all existing tests still pass** (101 baseline + 3 new = 104 total).

- [ ] **Step 7: Typecheck and Biome**

```bash
bun run typecheck && bun run check
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 8: Commit**

```bash
git add src/workers/physics/gaussian.ts src/workers/physics/gaussian.test.ts src/workers/physics/noise.ts
git commit -m "$(cat <<'EOF'
refactor(physics): extract gaussianSample into a reusable primitive

Marsaglia polar sampling is now a free function returned by
createGaussianSampler(rng). NoiseGenerator delegates to it; downstream
code (AnalogOutput, metastability resolution) can reuse the same
primitive without needing a NoiseGenerator instance.
EOF
)"
```

---

## Task 2: Add `GatesConfig` to physics config

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/constants.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "./constants";

describe("DefaultPhysicsConfig.gates", () => {
  it("has tPD in seconds, positive and reasonable for a 100 us dt", () => {
    expect(DefaultPhysicsConfig.gates.tPD).toBeGreaterThan(0);
    expect(DefaultPhysicsConfig.gates.tPD).toBeLessThan(0.1);
  });

  it("has zeta in (0, 1] for underdamped-to-critical slew", () => {
    expect(DefaultPhysicsConfig.gates.zeta).toBeGreaterThan(0);
    expect(DefaultPhysicsConfig.gates.zeta).toBeLessThanOrEqual(1);
  });

  it("has ringFreq in Hz, positive", () => {
    expect(DefaultPhysicsConfig.gates.ringFreq).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test src/lib/constants.test.ts
```

Expected: **FAIL** — `gates` is undefined on `DefaultPhysicsConfig`.

- [ ] **Step 3: Add the `GatesConfig` interface in `src/lib/types.ts`**

Open `src/lib/types.ts`. Immediately after the `TimingConfig` interface (after line 34), insert:

```ts
export interface GatesConfig {
  readonly tPD: number;
  readonly zeta: number;
  readonly ringFreq: number;
}
```

Then modify the `PhysicsConfig` interface (lines 45-49) to add a `gates` field:

```ts
export interface PhysicsConfig {
  readonly voltage: Readonly<VoltageSpecConfig>;
  readonly simulation: Readonly<SimulationConfig>;
  readonly timing: Readonly<TimingConfig>;
  readonly gates: Readonly<GatesConfig>;
}
```

- [ ] **Step 4: Add `DefaultGates` in `src/lib/constants.ts`**

Open `src/lib/constants.ts`. At the top, update the import to include `GatesConfig`:

```ts
import type {
  GatesConfig,
  LayoutConfig,
  PhysicsConfig,
  SimulationConfig,
  TimingConfig,
  VoltageSpecConfig,
} from "./types";
```

Immediately after the `DefaultTiming` declaration (after line 38), add:

```ts
export const DefaultGates = {
  tPD: 0.001,
  zeta: 0.4,
  ringFreq: 120,
} as const satisfies GatesConfig;
```

Then update `DefaultPhysicsConfig` to include `gates`:

```ts
export const DefaultPhysicsConfig = {
  voltage: DefaultVoltageSpecs,
  simulation: DefaultSimulation,
  timing: DefaultTiming,
  gates: DefaultGates,
} as const satisfies PhysicsConfig;
```

- [ ] **Step 5: Run the tests**

```bash
bun run test src/lib/constants.test.ts
```

Expected: **3 new tests pass**.

- [ ] **Step 6: Run the full suite**

```bash
bun run test && bun run typecheck && bun run check
```

Expected: all tests pass (104 + 3 = 107). Typecheck and Biome clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/constants.ts src/lib/constants.test.ts
git commit -m "$(cat <<'EOF'
feat(physics): add gates config block (tPD, zeta, ringFreq)

Introduces GatesConfig in the PhysicsConfig surface. Defaults:
tPD = 1 ms (resolves over ~10 physics steps at dt = 100 us),
zeta = 0.4 (matches DFF damping),
ringFreq = 120 Hz (matches DFF natural frequency).
EOF
)"
```

---

## Task 3: `AnalogOutput` helper class

**Files:**
- Create: `src/workers/physics/analog-output.ts`
- Create: `src/workers/physics/analog-output.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/workers/physics/analog-output.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import { AnalogOutput, mergeGateParams } from "./analog-output";

function makeOutput() {
  const cfg = mergeGateParams(DefaultPhysicsConfig, {});
  return new AnalogOutput(cfg, createSeededRng(1));
}

describe("AnalogOutput", () => {
  it("starts at rest near baseLow", () => {
    const out = makeOutput();
    expect(out.voltage).toBeLessThan(DefaultPhysicsConfig.voltage.logicHighMin);
  });

  it("set(1) schedules a pending target; voltage does not change immediately", () => {
    const out = makeOutput();
    const before = out.voltage;
    out.set(1);
    expect(out.voltage).toBe(before);
  });

  it("after tPD of update() the Signal starts slewing toward HIGH", () => {
    const out = makeOutput();
    out.set(1);
    const dt = DefaultPhysicsConfig.simulation.physicsDt;
    const tPD = DefaultPhysicsConfig.gates.tPD;
    const steps = Math.ceil(tPD / dt) + 1;
    for (let i = 0; i < steps; i++) out.update(dt);
    const mid = (DefaultPhysicsConfig.voltage.logicHighMin +
                 DefaultPhysicsConfig.voltage.logicLowMax) / 2;
    expect(out.voltage).toBeGreaterThan(mid);
  });

  it("after enough update() calls the Signal settles above logicHighMin", () => {
    const out = makeOutput();
    out.set(1);
    const dt = DefaultPhysicsConfig.simulation.physicsDt;
    for (let i = 0; i < 1000; i++) out.update(dt);
    expect(out.voltage).toBeGreaterThan(DefaultPhysicsConfig.voltage.logicHighMin);
  });

  it("calling set(x) with the current target is a no-op", () => {
    const out = makeOutput();
    out.set(0);
    const before = out.voltage;
    expect(before).toBe(0 + 0 * 1); // no synthetic change
    out.set(0);
    expect(out.voltage).toBe(before);
  });

  it("snapTo(1) bypasses tPD and slew; voltage jumps to baseHigh", () => {
    const cfg = mergeGateParams(DefaultPhysicsConfig, {});
    const out = new AnalogOutput(cfg, createSeededRng(99));
    out.snapTo(1, cfg);
    expect(out.voltage).toBeCloseTo(cfg.baseHigh, 5);
  });

  it("mergeGateParams lets per-instance params override defaults", () => {
    const cfg = mergeGateParams(DefaultPhysicsConfig, { tPD: 0.005, zeta: 0.7 });
    expect(cfg.tPD).toBe(0.005);
    expect(cfg.zeta).toBe(0.7);
    expect(cfg.ringFreq).toBe(DefaultPhysicsConfig.gates.ringFreq);
  });

  it("mergeGateParams ignores unknown params", () => {
    const cfg = mergeGateParams(DefaultPhysicsConfig, { banana: 42 });
    expect(cfg.tPD).toBe(DefaultPhysicsConfig.gates.tPD);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test src/workers/physics/analog-output.test.ts
```

Expected: **FAIL** with `Cannot find module './analog-output'`.

- [ ] **Step 3: Write the implementation**

Create `src/workers/physics/analog-output.ts`:

```ts
import type { PhysicsConfig, RngFn, SignalConfig } from "@/lib/types";
import { NoiseGenerator } from "./noise";
import { Signal } from "./signal";

export interface AnalogOutputConfig {
  readonly tPD: number;
  readonly zeta: number;
  readonly ringFreq: number;
  readonly baseHigh: number;
  readonly baseLow: number;
  readonly clampMin: number;
  readonly clampMax: number;
  readonly noiseLevel: number;
}

export function mergeGateParams(
  config: PhysicsConfig,
  params: Record<string, unknown>,
): AnalogOutputConfig {
  const numeric = (k: string): number | undefined =>
    typeof params[k] === "number" ? (params[k] as number) : undefined;
  const noiseLevel =
    (config.simulation.defaultNoise / 100) *
    config.simulation.maxNoiseLevel *
    config.simulation.outputNoiseRatio;
  return {
    tPD: numeric("tPD") ?? config.gates.tPD,
    zeta: numeric("zeta") ?? config.gates.zeta,
    ringFreq: numeric("ringFreq") ?? config.gates.ringFreq,
    baseHigh: (config.voltage.outputHighMin + config.voltage.outputHighMax) / 2,
    baseLow: config.voltage.outputLowMax / 2,
    clampMin: config.voltage.clampMin,
    clampMax: config.voltage.systemMax,
    noiseLevel,
  };
}

export class AnalogOutput {
  private readonly signal: Signal;
  private readonly tPD: number;
  private currentTarget: 0 | 1 = 0;
  private pending: 0 | 1 | null = null;
  private pendingTimer: number = 0;

  constructor(cfg: AnalogOutputConfig, rng: RngFn) {
    this.tPD = cfg.tPD;
    const signalCfg: SignalConfig = {
      baseHigh: cfg.baseHigh,
      baseLow: cfg.baseLow,
      zeta: cfg.zeta,
      ringFreq: cfg.ringFreq,
      clampMin: cfg.clampMin,
      clampMax: cfg.clampMax,
    };
    this.signal = new Signal(signalCfg, new NoiseGenerator(rng, cfg.noiseLevel));
  }

  get voltage(): number {
    return this.signal.voltage;
  }

  set(logic: 0 | 1): void {
    if (logic === this.currentTarget && this.pending === null) return;
    if (logic === this.pending) return;
    if (logic === this.currentTarget && this.pending !== null) {
      this.pending = null;
      this.pendingTimer = 0;
      return;
    }
    this.pending = logic;
    this.pendingTimer = this.tPD;
  }

  update(dt: number): void {
    if (this.pending !== null) {
      this.pendingTimer -= dt;
      if (this.pendingTimer <= 0) {
        this.currentTarget = this.pending;
        this.signal.targetLogic = this.pending;
        this.pending = null;
      }
    }
    this.signal.update(dt);
  }

  snapTo(logic: 0 | 1, cfg: AnalogOutputConfig): void {
    this.currentTarget = logic;
    this.pending = null;
    this.pendingTimer = 0;
    this.signal.targetLogic = logic;
    this.signal.snapTo(logic === 1 ? cfg.baseHigh : cfg.baseLow);
  }
}
```

- [ ] **Step 4: Run the tests**

```bash
bun run test src/workers/physics/analog-output.test.ts
```

Expected: **8 tests pass**.

- [ ] **Step 5: Run full suite + checks**

```bash
bun run test && bun run typecheck && bun run check
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/workers/physics/analog-output.ts src/workers/physics/analog-output.test.ts
git commit -m "$(cat <<'EOF'
feat(physics): add AnalogOutput helper with tPD + Signal dynamics

Composable output stage that a combinational gate can own: set(logic)
queues a target change, update(dt) ticks the tPD timer and advances
the underlying Signal. Noise and slew match the DFF's existing
qSignal machinery; gates become first-class citizens of the analog
physics model.
EOF
)"
```

---

## Task 4: Add required `update(dt)` to `CombinationalComponent` + engine loop change

This task wires the interface change and the engine change together so tests stay green at every commit. Each gate gets a no-op `update(dt)` for now; Task 5 replaces those with the real `AnalogOutput`-driven bodies.

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/workers/physics/components/and-gate.ts`
- Modify: `src/workers/physics/components/or-gate.ts`
- Modify: `src/workers/physics/components/xor-gate.ts`
- Modify: `src/workers/physics/components/not-gate.ts`
- Modify: `src/workers/physics/components/full-adder.ts`
- Modify: `src/workers/physics/graph.ts`
- Modify: `src/workers/physics/engine.ts`

- [ ] **Step 1: Extend the `CombinationalComponent` interface**

Open `src/lib/types.ts`. Find the `CombinationalComponent` interface (around line 65-68):

```ts
export interface CombinationalComponent extends Component {
  readonly kind: "combinational";
  evaluate(): void;
}
```

Change to:

```ts
export interface CombinationalComponent extends Component {
  readonly kind: "combinational";
  evaluate(): void;
  update(dt: number): void;
}
```

- [ ] **Step 2: Run typecheck to see which files break**

```bash
bun run typecheck
```

Expected: **FAIL** — each of the five gate classes reports "Class 'ANDGate'/'ORGate'/'XORGate'/'NOTGate'/'FullAdder' does not correctly implement interface 'CombinationalComponent'. Property 'update' is missing…".

- [ ] **Step 3: Add a no-op `update(dt)` to each gate**

For `src/workers/physics/components/and-gate.ts`, after the `evaluate()` method, add:

```ts
  update(_dt: number): void {
    // No-op until Task 5 wires AnalogOutput.
  }
```

Apply the same two-line addition to `or-gate.ts`, `xor-gate.ts`, `not-gate.ts`, `full-adder.ts`. Place the method directly after `evaluate()` in each file.

- [ ] **Step 4: Add `getCombinational()` and `updateCombinational()` to `CircuitGraph`**

Open `src/workers/physics/graph.ts`. The field `private readonly combinationalOrder: CombinationalComponent[] = [];` stays for now — it still contains the same set of gates, just ordering is about to stop mattering. Add the following method (next to `evaluateCombinational()` around line 91):

```ts
  getCombinational(): readonly CombinationalComponent[] {
    return this.combinationalOrder;
  }

  updateCombinational(dt: number): void {
    for (const comp of this.combinationalOrder) {
      comp.update(dt);
    }
  }
```

- [ ] **Step 5: Change the engine loop**

Open `src/workers/physics/engine.ts`. Replace the `stepPhysics` method (lines 58-73) with:

```ts
  private stepPhysics(dt: number): void {
    for (const seq of this.sequentialList) seq.update(dt);
    this.graph.propagate();
    for (const seq of this.sequentialList) seq.clock(dt);
    this.graph.evaluateCombinational();
    this.graph.updateCombinational(dt);
    this.graph.propagate();
    this.buffer.push(this.graph.collectProbeVoltages(this.probes));
  }
```

The redundant `propagate()` between `seq.clock` and `evaluateCombinational` is removed (clock never writes port voltages directly — only queues pending targets). Evaluate now runs before the combinational update so gates can queue new targets before their `AnalogOutput` ticks forward.

- [ ] **Step 6: Run typecheck**

```bash
bun run typecheck
```

Expected: **PASS** — all interface errors resolved.

- [ ] **Step 7: Run the full test suite**

```bash
bun run test
```

Expected: **all existing tests pass** (107 total). The gates still write directly to `outPort.voltage` in `evaluate()`; their `update(dt)` is a no-op; so behaviour is unchanged.

- [ ] **Step 8: Biome**

```bash
bun run check
```

Expected: 0 warnings.

- [ ] **Step 9: Commit**

```bash
git add src/lib/types.ts src/workers/physics/components/*.ts src/workers/physics/graph.ts src/workers/physics/engine.ts
git commit -m "$(cat <<'EOF'
refactor(physics): require CombinationalComponent.update(dt)

Preparation for analog gate dynamics. Interface gains update(dt), each
of the five gates gets a no-op update method, CircuitGraph exposes
updateCombinational(dt), and the engine loop now calls evaluate then
update each tick. Behaviour is unchanged (gates still write output
voltage in evaluate); the next commit swaps the bodies to use
AnalogOutput.
EOF
)"
```

---

## Task 5: Wire `AnalogOutput` into all five gates

This task replaces each gate's `evaluate()` body with an `AnalogOutput.set(logic)` call and populates `update(dt)` to step the output forward. Gate tests are rewritten to advance time via a `settle()` helper.

**Files:**
- Create: `src/workers/physics/test-helpers.ts`
- Modify: `src/workers/physics/components/and-gate.ts`
- Modify: `src/workers/physics/components/or-gate.ts`
- Modify: `src/workers/physics/components/xor-gate.ts`
- Modify: `src/workers/physics/components/not-gate.ts`
- Modify: `src/workers/physics/components/full-adder.ts`
- Modify: `src/workers/physics/components/and-gate.test.ts`
- Modify: `src/workers/physics/components/or-gate.test.ts`
- Modify: `src/workers/physics/components/xor-gate.test.ts`
- Modify: `src/workers/physics/components/not-gate.test.ts`
- Modify: `src/workers/physics/components/full-adder.test.ts`

- [ ] **Step 1: Create the `settle` test helper**

Create `src/workers/physics/test-helpers.ts`:

```ts
import type { CombinationalComponent } from "@/lib/types";

export function settle(
  component: CombinationalComponent,
  dt: number,
  duration: number,
): void {
  const steps = Math.ceil(duration / dt);
  for (let i = 0; i < steps; i++) {
    component.evaluate();
    component.update(dt);
  }
}
```

- [ ] **Step 2: Rewrite the `and-gate.test.ts`**

Replace `src/workers/physics/components/and-gate.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { Port } from "@/lib/types";
import { settle } from "../test-helpers";
import { ANDGate } from "./and-gate";

const deps = { config: DefaultPhysicsConfig, rng: createSeededRng(1) };
const { logicHighMin, outputHighMax } = DefaultPhysicsConfig.voltage;
const dt = DefaultPhysicsConfig.simulation.physicsDt;
const settleTime = DefaultPhysicsConfig.gates.tPD * 20;

function makeAnd() {
  const gate = new ANDGate("and0", {}, deps);
  const a = gate.inputs.get("a");
  const b = gate.inputs.get("b");
  const out = gate.outputs.get("out");
  if (!a || !b || !out) throw new Error("AND gate port missing");
  return { gate, a, b, out };
}

describe("ANDGate", () => {
  it("0 AND 0 = 0 after settling", () => {
    const { gate, a, b, out } = makeAnd();
    a.voltage = 0.0;
    b.voltage = 0.0;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin);
  });

  it("1 AND 0 = 0 after settling", () => {
    const { gate, a, b, out } = makeAnd();
    a.voltage = outputHighMax;
    b.voltage = 0.0;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin);
  });

  it("0 AND 1 = 0 after settling", () => {
    const { gate, a, b, out } = makeAnd();
    a.voltage = 0.0;
    b.voltage = outputHighMax;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin);
  });

  it("1 AND 1 = 1 after settling", () => {
    const { gate, a, b, out } = makeAnd();
    a.voltage = outputHighMax;
    b.voltage = outputHighMax;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });
});
```

- [ ] **Step 3: Rewrite `or-gate.test.ts`**

Replace `src/workers/physics/components/or-gate.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { Port } from "@/lib/types";
import { settle } from "../test-helpers";
import { ORGate } from "./or-gate";

const deps = { config: DefaultPhysicsConfig, rng: createSeededRng(2) };
const { logicHighMin, outputHighMax } = DefaultPhysicsConfig.voltage;
const dt = DefaultPhysicsConfig.simulation.physicsDt;
const settleTime = DefaultPhysicsConfig.gates.tPD * 20;

function makeOr() {
  const gate = new ORGate("or0", {}, deps);
  const a = gate.inputs.get("a");
  const b = gate.inputs.get("b");
  const out = gate.outputs.get("out");
  if (!a || !b || !out) throw new Error("OR gate port missing");
  return { gate, a, b, out };
}

describe("ORGate", () => {
  it("0 OR 0 = 0", () => {
    const { gate, a, b, out } = makeOr();
    a.voltage = 0; b.voltage = 0;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin);
  });
  it("1 OR 0 = 1", () => {
    const { gate, a, b, out } = makeOr();
    a.voltage = outputHighMax; b.voltage = 0;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });
  it("0 OR 1 = 1", () => {
    const { gate, a, b, out } = makeOr();
    a.voltage = 0; b.voltage = outputHighMax;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });
  it("1 OR 1 = 1", () => {
    const { gate, a, b, out } = makeOr();
    a.voltage = outputHighMax; b.voltage = outputHighMax;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });
});
```

- [ ] **Step 4: Rewrite `xor-gate.test.ts`**

Replace `src/workers/physics/components/xor-gate.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { Port } from "@/lib/types";
import { settle } from "../test-helpers";
import { XORGate } from "./xor-gate";

const deps = { config: DefaultPhysicsConfig, rng: createSeededRng(3) };
const { logicHighMin, outputHighMax } = DefaultPhysicsConfig.voltage;
const dt = DefaultPhysicsConfig.simulation.physicsDt;
const settleTime = DefaultPhysicsConfig.gates.tPD * 20;

function makeXor() {
  const gate = new XORGate("xor0", {}, deps);
  const a = gate.inputs.get("a");
  const b = gate.inputs.get("b");
  const out = gate.outputs.get("out");
  if (!a || !b || !out) throw new Error("XOR gate port missing");
  return { gate, a, b, out };
}

describe("XORGate", () => {
  it("0 XOR 0 = 0", () => {
    const { gate, a, b, out } = makeXor();
    a.voltage = 0; b.voltage = 0;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin);
  });
  it("1 XOR 0 = 1", () => {
    const { gate, a, b, out } = makeXor();
    a.voltage = outputHighMax; b.voltage = 0;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });
  it("0 XOR 1 = 1", () => {
    const { gate, a, b, out } = makeXor();
    a.voltage = 0; b.voltage = outputHighMax;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });
  it("1 XOR 1 = 0", () => {
    const { gate, a, b, out } = makeXor();
    a.voltage = outputHighMax; b.voltage = outputHighMax;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin);
  });
});
```

- [ ] **Step 5: Rewrite `not-gate.test.ts`**

Replace `src/workers/physics/components/not-gate.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { Port } from "@/lib/types";
import { settle } from "../test-helpers";
import { NOTGate } from "./not-gate";

const deps = { config: DefaultPhysicsConfig, rng: createSeededRng(4) };
const { logicHighMin, outputHighMax } = DefaultPhysicsConfig.voltage;
const dt = DefaultPhysicsConfig.simulation.physicsDt;
const settleTime = DefaultPhysicsConfig.gates.tPD * 20;

function makeNot() {
  const gate = new NOTGate("not0", {}, deps);
  const inp = gate.inputs.get("in");
  const out = gate.outputs.get("out");
  if (!inp || !out) throw new Error("NOT gate port missing");
  return { gate, inp, out };
}

describe("NOTGate", () => {
  it("NOT 0 = 1", () => {
    const { gate, inp, out } = makeNot();
    inp.voltage = 0;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeGreaterThan(logicHighMin);
  });
  it("NOT 1 = 0", () => {
    const { gate, inp, out } = makeNot();
    inp.voltage = outputHighMax;
    settle(gate, dt, settleTime);
    expect(out.voltage).toBeLessThan(logicHighMin);
  });
});
```

- [ ] **Step 6: Rewrite `full-adder.test.ts`**

Replace `src/workers/physics/components/full-adder.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { Port } from "@/lib/types";
import { settle } from "../test-helpers";
import { FullAdder } from "./full-adder";

const deps = { config: DefaultPhysicsConfig, rng: createSeededRng(5) };
const { logicHighMin, outputHighMax } = DefaultPhysicsConfig.voltage;
const H = outputHighMax;
const L = 0.0;
const dt = DefaultPhysicsConfig.simulation.physicsDt;
const settleTime = DefaultPhysicsConfig.gates.tPD * 20;

function makeFa() {
  const fa = new FullAdder("fa0", {}, deps);
  const a = fa.inputs.get("a");
  const b = fa.inputs.get("b");
  const cin = fa.inputs.get("cin");
  const sum = fa.outputs.get("sum");
  const cout = fa.outputs.get("cout");
  if (!a || !b || !cin || !sum || !cout) throw new Error("FullAdder port missing");
  return { fa, a, b, cin, sum, cout };
}

function isHigh(v: number): boolean {
  return v > logicHighMin;
}

describe("FullAdder", () => {
  it("0+0+0 = sum:0 cout:0", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = L; b.voltage = L; cin.voltage = L;
    settle(fa, dt, settleTime);
    expect(isHigh(sum.voltage)).toBe(false);
    expect(isHigh(cout.voltage)).toBe(false);
  });
  it("1+0+0 = sum:1 cout:0", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = H; b.voltage = L; cin.voltage = L;
    settle(fa, dt, settleTime);
    expect(isHigh(sum.voltage)).toBe(true);
    expect(isHigh(cout.voltage)).toBe(false);
  });
  it("0+1+0 = sum:1 cout:0", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = L; b.voltage = H; cin.voltage = L;
    settle(fa, dt, settleTime);
    expect(isHigh(sum.voltage)).toBe(true);
    expect(isHigh(cout.voltage)).toBe(false);
  });
  it("1+1+0 = sum:0 cout:1", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = H; b.voltage = H; cin.voltage = L;
    settle(fa, dt, settleTime);
    expect(isHigh(sum.voltage)).toBe(false);
    expect(isHigh(cout.voltage)).toBe(true);
  });
  it("0+0+1 = sum:1 cout:0", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = L; b.voltage = L; cin.voltage = H;
    settle(fa, dt, settleTime);
    expect(isHigh(sum.voltage)).toBe(true);
    expect(isHigh(cout.voltage)).toBe(false);
  });
  it("1+0+1 = sum:0 cout:1", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = H; b.voltage = L; cin.voltage = H;
    settle(fa, dt, settleTime);
    expect(isHigh(sum.voltage)).toBe(false);
    expect(isHigh(cout.voltage)).toBe(true);
  });
  it("0+1+1 = sum:0 cout:1", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = L; b.voltage = H; cin.voltage = H;
    settle(fa, dt, settleTime);
    expect(isHigh(sum.voltage)).toBe(false);
    expect(isHigh(cout.voltage)).toBe(true);
  });
  it("1+1+1 = sum:1 cout:1", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = H; b.voltage = H; cin.voltage = H;
    settle(fa, dt, settleTime);
    expect(isHigh(sum.voltage)).toBe(true);
    expect(isHigh(cout.voltage)).toBe(true);
  });
});
```

- [ ] **Step 7: Run tests to confirm the rewritten test files fail (old gate bodies return vHigh instantly; new tests expect settling time)**

```bash
bun run test src/workers/physics/components/and-gate.test.ts
```

Expected: most tests **still pass** because the gates currently write `vHigh` directly into `outPort.voltage` during `evaluate()`, and `settle()` calls `evaluate()` on every step — so the immediate voltage is already at the target. This is fine. Going green on the rewritten tests does *not* require the new bodies; it just requires that the old bodies remain correct under `settle()`. The failures will come in Step 8 when we swap the bodies.

Actually — verify explicitly by running the whole test suite:

```bash
bun run test
```

Expected: all tests still pass (unchanged behaviour; settle just wraps evaluate).

- [ ] **Step 8: Replace `and-gate.ts` with AnalogOutput-based body**

Replace `src/workers/physics/components/and-gate.ts` with:

```ts
import type { CombinationalComponent, ComponentDeps, Port } from "@/lib/types";
import { AnalogOutput, mergeGateParams } from "../analog-output";
import { createPort } from "./base";

export class ANDGate implements CombinationalComponent {
  readonly kind = "combinational" as const;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;

  private readonly aPort: Port;
  private readonly bPort: Port;
  private readonly outPort: Port;
  private readonly out: AnalogOutput;
  private readonly threshold: number;

  constructor(
    readonly id: string,
    params: Record<string, unknown>,
    deps: ComponentDeps,
  ) {
    this.threshold = deps.config.voltage.logicHighMin;

    const a = createPort("a");
    const b = createPort("b");
    const outP = createPort("out");
    this.aPort = a;
    this.bPort = b;
    this.outPort = outP;
    this.inputs = new Map([
      ["a", a],
      ["b", b],
    ]);
    this.outputs = new Map([["out", outP]]);

    this.out = new AnalogOutput(mergeGateParams(deps.config, params), deps.rng);
  }

  evaluate(): void {
    const aHigh = this.aPort.voltage > this.threshold;
    const bHigh = this.bPort.voltage > this.threshold;
    this.out.set(aHigh && bHigh ? 1 : 0);
  }

  update(dt: number): void {
    this.out.update(dt);
    this.outPort.voltage = this.out.voltage;
  }
}
```

- [ ] **Step 9: Replace `or-gate.ts`**

Replace `src/workers/physics/components/or-gate.ts` with the structurally-identical file, swapping the boolean:

```ts
import type { CombinationalComponent, ComponentDeps, Port } from "@/lib/types";
import { AnalogOutput, mergeGateParams } from "../analog-output";
import { createPort } from "./base";

export class ORGate implements CombinationalComponent {
  readonly kind = "combinational" as const;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;

  private readonly aPort: Port;
  private readonly bPort: Port;
  private readonly outPort: Port;
  private readonly out: AnalogOutput;
  private readonly threshold: number;

  constructor(
    readonly id: string,
    params: Record<string, unknown>,
    deps: ComponentDeps,
  ) {
    this.threshold = deps.config.voltage.logicHighMin;

    const a = createPort("a");
    const b = createPort("b");
    const outP = createPort("out");
    this.aPort = a;
    this.bPort = b;
    this.outPort = outP;
    this.inputs = new Map([
      ["a", a],
      ["b", b],
    ]);
    this.outputs = new Map([["out", outP]]);

    this.out = new AnalogOutput(mergeGateParams(deps.config, params), deps.rng);
  }

  evaluate(): void {
    const aHigh = this.aPort.voltage > this.threshold;
    const bHigh = this.bPort.voltage > this.threshold;
    this.out.set(aHigh || bHigh ? 1 : 0);
  }

  update(dt: number): void {
    this.out.update(dt);
    this.outPort.voltage = this.out.voltage;
  }
}
```

- [ ] **Step 10: Replace `xor-gate.ts`**

Replace `src/workers/physics/components/xor-gate.ts` with:

```ts
import type { CombinationalComponent, ComponentDeps, Port } from "@/lib/types";
import { AnalogOutput, mergeGateParams } from "../analog-output";
import { createPort } from "./base";

export class XORGate implements CombinationalComponent {
  readonly kind = "combinational" as const;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;

  private readonly aPort: Port;
  private readonly bPort: Port;
  private readonly outPort: Port;
  private readonly out: AnalogOutput;
  private readonly threshold: number;

  constructor(
    readonly id: string,
    params: Record<string, unknown>,
    deps: ComponentDeps,
  ) {
    this.threshold = deps.config.voltage.logicHighMin;

    const a = createPort("a");
    const b = createPort("b");
    const outP = createPort("out");
    this.aPort = a;
    this.bPort = b;
    this.outPort = outP;
    this.inputs = new Map([
      ["a", a],
      ["b", b],
    ]);
    this.outputs = new Map([["out", outP]]);

    this.out = new AnalogOutput(mergeGateParams(deps.config, params), deps.rng);
  }

  evaluate(): void {
    const aHigh = this.aPort.voltage > this.threshold;
    const bHigh = this.bPort.voltage > this.threshold;
    this.out.set(aHigh !== bHigh ? 1 : 0);
  }

  update(dt: number): void {
    this.out.update(dt);
    this.outPort.voltage = this.out.voltage;
  }
}
```

- [ ] **Step 11: Replace `not-gate.ts`**

Replace `src/workers/physics/components/not-gate.ts` with:

```ts
import type { CombinationalComponent, ComponentDeps, Port } from "@/lib/types";
import { AnalogOutput, mergeGateParams } from "../analog-output";
import { createPort } from "./base";

export class NOTGate implements CombinationalComponent {
  readonly kind = "combinational" as const;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;

  private readonly inPort: Port;
  private readonly outPort: Port;
  private readonly out: AnalogOutput;
  private readonly threshold: number;

  constructor(
    readonly id: string,
    params: Record<string, unknown>,
    deps: ComponentDeps,
  ) {
    this.threshold = deps.config.voltage.logicHighMin;

    const inp = createPort("in");
    const outP = createPort("out");
    this.inPort = inp;
    this.outPort = outP;
    this.inputs = new Map([["in", inp]]);
    this.outputs = new Map([["out", outP]]);

    this.out = new AnalogOutput(mergeGateParams(deps.config, params), deps.rng);
  }

  evaluate(): void {
    const inHigh = this.inPort.voltage > this.threshold;
    this.out.set(inHigh ? 0 : 1);
  }

  update(dt: number): void {
    this.out.update(dt);
    this.outPort.voltage = this.out.voltage;
  }
}
```

- [ ] **Step 12: Replace `full-adder.ts` (two `AnalogOutput` instances)**

Replace `src/workers/physics/components/full-adder.ts` with:

```ts
import type { CombinationalComponent, ComponentDeps, Port } from "@/lib/types";
import { AnalogOutput, mergeGateParams } from "../analog-output";
import { createPort } from "./base";

export class FullAdder implements CombinationalComponent {
  readonly kind = "combinational" as const;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;

  private readonly aPort: Port;
  private readonly bPort: Port;
  private readonly cinPort: Port;
  private readonly sumPort: Port;
  private readonly coutPort: Port;
  private readonly sumOut: AnalogOutput;
  private readonly coutOut: AnalogOutput;
  private readonly threshold: number;

  constructor(
    readonly id: string,
    params: Record<string, unknown>,
    deps: ComponentDeps,
  ) {
    this.threshold = deps.config.voltage.logicHighMin;

    const a = createPort("a");
    const b = createPort("b");
    const cin = createPort("cin");
    const sum = createPort("sum");
    const cout = createPort("cout");
    this.aPort = a;
    this.bPort = b;
    this.cinPort = cin;
    this.sumPort = sum;
    this.coutPort = cout;
    this.inputs = new Map([
      ["a", a],
      ["b", b],
      ["cin", cin],
    ]);
    this.outputs = new Map([
      ["sum", sum],
      ["cout", cout],
    ]);

    const cfg = mergeGateParams(deps.config, params);
    this.sumOut = new AnalogOutput(cfg, deps.rng);
    this.coutOut = new AnalogOutput(cfg, deps.rng);
  }

  evaluate(): void {
    const aHigh = this.aPort.voltage > this.threshold;
    const bHigh = this.bPort.voltage > this.threshold;
    const cinHigh = this.cinPort.voltage > this.threshold;
    const sumHigh = (aHigh !== bHigh) !== cinHigh;
    const coutHigh = (aHigh && bHigh) || (cinHigh && aHigh !== bHigh);
    this.sumOut.set(sumHigh ? 1 : 0);
    this.coutOut.set(coutHigh ? 1 : 0);
  }

  update(dt: number): void {
    this.sumOut.update(dt);
    this.coutOut.update(dt);
    this.sumPort.voltage = this.sumOut.voltage;
    this.coutPort.voltage = this.coutOut.voltage;
  }
}
```

- [ ] **Step 13: Run the gate tests and the full suite**

```bash
bun run test
```

Expected: all gate truth-table tests pass under the new analog bodies (output settles to vHigh or baseLow within 20·tPD, and the threshold assertion triggers correctly). All other tests still pass.

If any gate test fails with voltage between `logicLowMax` and `logicHighMin`, increase `settleTime` in that gate's test file (change `tPD * 20` to `tPD * 50`) and re-run. If failures persist, check that the gate's `update(dt)` is writing `this.out.voltage` to the output port.

- [ ] **Step 14: Typecheck + Biome**

```bash
bun run typecheck && bun run check
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 15: Commit**

```bash
git add src/workers/physics/test-helpers.ts src/workers/physics/components/*.ts src/workers/physics/components/*.test.ts
git commit -m "$(cat <<'EOF'
feat(physics): wire AnalogOutput into all five combinational gates

Each gate now owns an AnalogOutput (FullAdder owns two, one per output
port). evaluate() maps inputs to a boolean and calls out.set(logic);
update(dt) advances the Signal and writes the slewing voltage to the
output port. Gate truth-table tests wait tPD * 20 of simulated time via
a new settle() helper before asserting. Combinational gates finally
honour the README's "every signal is a continuous voltage" claim.
EOF
)"
```

---

## Task 6: Delete `levelize` and `findDriverOf` from `CircuitGraph`

With every gate owning its own tPD timer, topological ordering inside a single tick no longer matters — each gate reacts to whatever voltage its input currently carries. This task simplifies `CircuitGraph` to an insertion-ordered list and drops cycle-rejection.

**Files:**
- Modify: `src/workers/physics/graph.ts`

- [ ] **Step 1: Replace `graph.ts` with the simplified version**

Replace the entire contents of `src/workers/physics/graph.ts` with:

```ts
import type {
  CircuitDefinition,
  CombinationalComponent,
  Component,
  Net,
  PhysicsConfig,
  Port,
  Probe,
  RngFn,
  SequentialComponent,
} from "@/lib/types";
import { isCombinational, isSequential } from "./components/base";
import type { ComponentRegistry } from "./components/registry";

export class CircuitGraph {
  private readonly components = new Map<string, Component>();
  private readonly nets = new Map<string, Net>();
  private readonly sequentialList: SequentialComponent[] = [];
  private readonly combinationalList: CombinationalComponent[] = [];

  constructor(
    definition: CircuitDefinition,
    registry: ComponentRegistry,
    config: PhysicsConfig,
    rng: RngFn,
  ) {
    for (const def of definition.components) {
      const comp = registry.create(def.type, def.id, def.params, { config, rng });
      this.components.set(def.id, comp);
      if (isSequential(comp)) this.sequentialList.push(comp);
      if (isCombinational(comp)) this.combinationalList.push(comp);
    }

    for (const netDef of definition.nets) {
      const driverComp = this.components.get(netDef.driver.componentId);
      if (!driverComp) {
        throw new Error(`Unknown component: ${netDef.driver.componentId}`);
      }
      const driverPort = driverComp.outputs.get(netDef.driver.port);
      if (!driverPort) {
        throw new Error(`Unknown output port: ${netDef.driver.componentId}.${netDef.driver.port}`);
      }
      const loadPorts: Port[] = [];
      for (const load of netDef.loads) {
        const loadComp = this.components.get(load.componentId);
        if (!loadComp) throw new Error(`Unknown component: ${load.componentId}`);
        const loadPort = loadComp.inputs.get(load.port);
        if (!loadPort) {
          throw new Error(`Unknown input port: ${load.componentId}.${load.port}`);
        }
        loadPorts.push(loadPort);
      }
      this.nets.set(netDef.id, { id: netDef.id, driverPort, loadPorts, voltage: 0 });
    }
  }

  getComponent(id: string): Component {
    const c = this.components.get(id);
    if (!c) throw new Error(`Unknown component: ${id}`);
    return c;
  }

  getNet(id: string): Net {
    const n = this.nets.get(id);
    if (!n) throw new Error(`Unknown net: ${id}`);
    return n;
  }

  getSequential(): readonly SequentialComponent[] {
    return this.sequentialList;
  }

  getCombinational(): readonly CombinationalComponent[] {
    return this.combinationalList;
  }

  getAllComponents(): Iterable<Component> {
    return this.components.values();
  }

  propagate(): void {
    for (const net of this.nets.values()) {
      net.voltage = net.driverPort.voltage;
      for (const load of net.loadPorts) {
        load.voltage = net.voltage;
      }
    }
  }

  evaluateCombinational(): void {
    for (const comp of this.combinationalList) {
      comp.evaluate();
    }
  }

  updateCombinational(dt: number): void {
    for (const comp of this.combinationalList) {
      comp.update(dt);
    }
  }

  collectProbeVoltages(probes: readonly Probe[]): number[] {
    const out: number[] = new Array(probes.length).fill(0);
    for (const probe of probes) {
      const net = this.nets.get(probe.netId);
      if (net) out[probe.channelIndex] = net.voltage;
    }
    return out;
  }
}
```

`levelize()` and `findDriverOf()` are gone. `combinationalList` preserves insertion order (the order the components appear in the `CircuitDefinition`). Feedback loops now work — each gate reads whatever voltage is on its input port this tick, and the settling happens over subsequent ticks.

- [ ] **Step 2: Run the full test suite**

```bash
bun run test
```

Expected: all tests pass, including `src/workers/physics/graph.test.ts`, `src/circuits/adder.test.ts`, and `src/workers/physics/components/default-registry.test.ts`. If `adder.test.ts`'s "carry chain propagates: fa0.cout drives fa1.cin" test fails, it's because it injects a voltage into `fa0.cout` directly and expects `fa1.cin` to match after `propagate()` — this is a pure voltage-propagation test that does not depend on `levelize()` and should still pass.

If `graph.test.ts` has any test specifically asserting `levelize` behaviour, it will fail. Inspect the failure, and delete the obsolete test — `levelize` no longer exists as a concept.

- [ ] **Step 3: Typecheck + Biome**

```bash
bun run typecheck && bun run check
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add src/workers/physics/graph.ts
git commit -m "$(cat <<'EOF'
refactor(graph): drop levelize and findDriverOf

With tPD-modeled gates, each gate reacts to whatever voltage is on its
input port this tick and the settling happens over subsequent ticks —
so intra-tick topological ordering is no longer required. Feedback
circuits (SR latches built from NAND, ring oscillators from odd numbers
of NOT gates, astable multivibrators) are now valid and demonstrable.
The combinational list is insertion-ordered.
EOF
)"
```

---

## Task 7: Ring-oscillator integration test

This is the proof-of-concept test that feedback circuits work. We build a 3-NOT ring and assert it oscillates at approximately `1 / (6 · tPD)` Hz.

**Files:**
- Create: `src/circuits/ring-oscillator.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `src/circuits/ring-oscillator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { CircuitDefinition } from "@/lib/types";
import { createDefaultRegistry } from "@/workers/physics/components/default-registry";
import { SimulationEngine } from "@/workers/physics/engine";

const ringOscillatorCircuit: CircuitDefinition = {
  id: "ring-osc",
  name: "3-NOT Ring Oscillator",
  description: "Three NOT gates in a loop; oscillates at ~1 / (6·tPD).",
  components: [
    { type: "NOTGate", id: "n0", params: {} },
    { type: "NOTGate", id: "n1", params: {} },
    { type: "NOTGate", id: "n2", params: {} },
  ],
  nets: [
    {
      id: "n0_to_n1",
      driver: { componentId: "n0", port: "out" },
      loads: [{ componentId: "n1", port: "in" }],
    },
    {
      id: "n1_to_n2",
      driver: { componentId: "n1", port: "out" },
      loads: [{ componentId: "n2", port: "in" }],
    },
    {
      id: "n2_to_n0",
      driver: { componentId: "n2", port: "out" },
      loads: [{ componentId: "n0", port: "in" }],
    },
  ],
  probes: [
    { netId: "n0_to_n1", label: "A", color: "#8aadf4", channelIndex: 0 },
    { netId: "n1_to_n2", label: "B", color: "#c6a0f6", channelIndex: 1 },
    { netId: "n2_to_n0", label: "C", color: "#f5a97f", channelIndex: 2 },
  ],
  controls: [],
};

describe("3-NOT ring oscillator", () => {
  it("instantiates without rejecting the feedback loop", () => {
    const registry = createDefaultRegistry();
    const rng = createSeededRng(1);
    expect(
      () => new SimulationEngine(ringOscillatorCircuit, registry, DefaultPhysicsConfig, rng),
    ).not.toThrow();
  });

  it("oscillates at approximately 1 / (6 * tPD) Hz", () => {
    const registry = createDefaultRegistry();
    const rng = createSeededRng(1);
    const engine = new SimulationEngine(
      ringOscillatorCircuit,
      registry,
      DefaultPhysicsConfig,
      rng,
    );
    const dt = DefaultPhysicsConfig.simulation.physicsDt;
    const tPD = DefaultPhysicsConfig.gates.tPD;
    const expectedPeriod = 6 * tPD;
    const { logicHighMin } = DefaultPhysicsConfig.voltage;

    const simDuration = 15 * expectedPeriod;
    const buffer = engine.getBuffer();
    const steps = Math.ceil(simDuration / dt);
    for (let i = 0; i < steps; i++) engine.tick(dt);

    const channel = buffer.getChannel(0);
    const high = Array.from(channel).map((v) => v > logicHighMin);
    let transitions = 0;
    for (let i = 1; i < high.length; i++) {
      if (high[i] !== high[i - 1]) transitions++;
    }
    expect(transitions).toBeGreaterThan(0);

    const bufferDuration = buffer.length * dt;
    const measuredFrequency = transitions / (2 * bufferDuration);
    const expectedFrequency = 1 / expectedPeriod;
    const ratio = measuredFrequency / expectedFrequency;
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(3);
  });
});
```

The frequency assertion uses a *very* loose band (0.3× to 3× expected) because the Signal's 2nd-order dynamics and noise shift the observed period; the point is to prove the oscillator runs, not to nail the exact frequency.

- [ ] **Step 2: Run the test to verify it passes**

```bash
bun run test src/circuits/ring-oscillator.test.ts
```

Expected: **2 tests pass**.

If the frequency assertion fails, print `measuredFrequency` and `expectedFrequency` to see where the oscillator is running. A completely stuck oscillator (0 transitions) usually means the initial conditions gave all three gates the same state — rerun with a different seed.

- [ ] **Step 3: Run the full suite**

```bash
bun run test
```

Expected: all tests pass.

- [ ] **Step 4: Typecheck + Biome**

```bash
bun run typecheck && bun run check
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/circuits/ring-oscillator.test.ts
git commit -m "$(cat <<'EOF'
test(physics): ring-oscillator feedback integration test

Three NOT gates wired in a loop oscillate at approximately 1/(6·tPD)
Hz. Proves that (a) CircuitGraph no longer rejects combinational
feedback, and (b) the tPD + Signal dynamics of AnalogOutput produce a
physically-meaningful astable output.
EOF
)"
```

---

## Task 8: Note the ripple-settling behaviour in the README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read the current adder description**

Open `README.md`. Find the **Circuits** section (around lines 38-44):

```md
### Circuits

| Circuit | Description |
|---------|-------------|
| **D Flip-Flop** | Single DFF showing edge-triggered capture, clock jitter, noise, and metastability |
| **4-Bit Accumulator** | Ripple-carry adder feeding four DFFs; demonstrates combinational + sequential interaction |
```

- [ ] **Step 2: Update the 4-Bit Accumulator description**

Change the accumulator row to:

```md
| **4-Bit Accumulator** | Ripple-carry adder feeding four DFFs. Each full adder has its own propagation delay `tPD`, so carry propagation cascades visibly on the oscilloscope — Q0 settles before Q1 before Q2 before Q3. |
```

- [ ] **Step 3: Mirror the change in the Chinese section**

Find the Chinese version (around lines 194-196):

```md
| 电路 | 描述 |
|------|------|
| **D 触发器** | 单个 DFF，展示边沿触发捕获、时钟抖动、噪声和亚稳态 |
| **4 位累加器** | 行波进位加法器驱动四个 DFF，演示组合逻辑与时序逻辑的交互 |
```

Change the accumulator row to:

```md
| **4 位累加器** | 行波进位加法器驱动四个 DFF。每个全加器都有独立的传播延迟 `tPD`，因此进位传播会在示波器上级联显现——Q0 先稳定，然后 Q1、Q2、Q3 依次跟进。 |
```

- [ ] **Step 4: Run build to confirm markdown doesn't break anything**

```bash
bun run build
```

Expected: successful build (markdown doesn't affect the TS build, but we're sanity-checking the branch is still releasable).

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: describe ripple-settling on the 4-bit accumulator

With analog dynamics on combinational gates, the adder's carry chain
settles visibly stage-by-stage (Q0 before Q1 before Q2 before Q3)
rather than all at once. Update both language versions.
EOF
)"
```

---

## Verification Checklist

After all 8 tasks:

1. `bun run typecheck` → 0 errors.
2. `bun run check` → 0 Biome warnings.
3. `bun run test` → all tests pass. Expected roughly: original 101 + 3 gaussian + 3 constants + 8 analog-output + 2 ring-oscillator = ~117 passing tests (exact count depends on prior state and how many existing gate tests were rewritten in place vs. added).
4. `bun run build` → succeeds.
5. Manual browser check (`bun run dev`):
   - Open **D Flip-Flop**: behaviour identical to before (no combinational gates involved).
   - Open **4-Bit Accumulator**: toggle several A bits at once, pulse the clock. Confirm Q0 transitions before Q1 before Q2 before Q3 on each clock edge — visible cascade on the scope.
   - Confirm noise is visible on gate outputs (nonzero ripple baseline, same as DFF Q output).
6. Manual check: build a 3-NOT ring oscillator circuit definition on a scratch branch and confirm it oscillates on the scope at roughly `1/(6·tPD) ≈ 167 Hz`. (Or rely on the integration test from Task 7 as proxy.)
7. `git log --oneline` shows 8 new commits in the order: extract gaussianSample → add gates config → AnalogOutput helper → require update(dt) on interface → wire AnalogOutput into gates → drop levelize → ring-oscillator test → README note.
