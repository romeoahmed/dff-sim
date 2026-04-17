# Analog Dynamics on Combinational Gates

## Context

The five combinational gates introduced on 2026-04-17 — `ANDGate`, `ORGate`, `XORGate`, `NOTGate`, `FullAdder` — are pure boolean mappers. Each reads input voltages, thresholds them, and writes `vHigh` or `0.0` to its output port instantaneously. This contradicts the project's stated design (README: "every signal is a continuous voltage that rises and falls with realistic physics — including Gaussian noise, RC slew, second-order ringing …"). Today only sequential components (`DFlipFlop`, `ClockSource`, `SignalSource`) honour that claim.

This spec gives every combinational gate full parity with `DFlipFlop`'s realism: smooth slew via a 2nd-order damped oscillator (`Signal`), propagation delay (`tPD`), and Gaussian + 1/f noise injected into the output.

## Goals

1. Each combinational gate's output voltage rises/falls smoothly with real slew and ringing — same `Signal` dynamics sequential components use.
2. Propagation delay: after an input crosses a threshold, the output target changes only after `tPD` seconds.
3. Output noise: same generator DFFs use.
4. Combinational feedback loops (SR latches, ring oscillators, astables) become valid circuits. `levelize()`'s cycle-rejection is removed.
5. No duplication of the new dynamics across gate classes — single shared helper.

## Non-Goals

- No fully-analog CMOS transfer curves. Input thresholding stays boolean; only the *output* is analog.
- No per-gate-type default timing differences (NOT fast / XOR slow). All gates share the same defaults; per-instance params can override.
- No new gate types (NAND / NOR / MUX) in this spec. Follow-up if wanted.
- No change to DFF, ClockSource, SignalSource.
- No change to the WGSL pipeline, worker RPC, or atom layer.

## Architecture

### New helper: `AnalogOutput`

New file `src/workers/physics/analog-output.ts`. Encapsulates everything an analog-driven logic output needs: a `Signal` (for slew + ring + noise mixing), a pending-target timer (for `tPD`), and a `set(logic)` API. One instance per output port — `FullAdder` has two (one for `sum`, one for `cout`).

```ts
import type { ComponentDeps } from "@/lib/types";
import { NoiseGenerator } from "./noise";
import { Signal } from "./signal";

export interface AnalogOutputConfig {
  tPD: number;        // seconds
  zeta: number;       // damping ratio for Signal
  ringFreq: number;   // natural frequency (Hz) for Signal
  baseHigh: number;   // voltage when logic-high target
  baseLow: number;    // voltage when logic-low target
  clampMin: number;
  clampMax: number;
  noiseLevel: number; // scaled RMS voltage
}

export class AnalogOutput {
  private readonly signal: Signal;
  private readonly tPD: number;
  private currentTarget: 0 | 1 = 0;
  private pending: 0 | 1 | null = null;
  private pendingTimer = 0;

  constructor(cfg: AnalogOutputConfig, rng: RngFn) {
    this.tPD = cfg.tPD;
    this.signal = new Signal(
      {
        baseHigh: cfg.baseHigh,
        baseLow: cfg.baseLow,
        zeta: cfg.zeta,
        ringFreq: cfg.ringFreq,
        clampMin: cfg.clampMin,
        clampMax: cfg.clampMax,
      },
      new NoiseGenerator(rng, cfg.noiseLevel),
    );
  }

  get voltage(): number { return this.signal.voltage; }

  set(logic: 0 | 1): void {
    if (logic === this.currentTarget && this.pending === null) return;
    if (logic === this.pending) return;
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

`AnalogOutput` stays inside `src/workers/physics/` because it's a physics primitive, not a component. It has no knowledge of `Port` or `Component`.

### Interface change: `CombinationalComponent`

Add required `update(dt: number): void` to the `CombinationalComponent` interface in `src/lib/types.ts`:

```ts
export interface CombinationalComponent {
  readonly kind: "combinational";
  readonly id: string;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;
  evaluate(): void;
  update(dt: number): void;   // NEW — required
}
```

All five existing gates gain `update(dt)`. No other `CombinationalComponent` implementers exist.

### Config: `DefaultPhysicsConfig.gates`

New block in `src/lib/constants.ts`:

```ts
gates: {
  tPD: 1e-3,            // 1 ms — fast enough to see ripple cascade at 60 Hz physics
  zeta: 0.4,            // same as DFF
  ringFreq: 120,        // same as DFF
  outputNoiseRatio: /* same as DFF's outputNoiseRatio */,
}
```

Per-instance override via `params`: any circuit definition can write
`{ type: "ANDGate", id: "and0", params: { tPD: 2e-3, zeta: 0.3 } }`. The gate constructor reads each field from `params` if present, else falls back to `deps.config.gates`.

Helper `mergeGateParams(config: PhysicsConfig, params: Record<string, unknown>): AnalogOutputConfig` lives in `analog-output.ts` alongside the class. It reads known numeric keys from `params`, falls back to `config.gates`, and derives `baseHigh`/`baseLow`/`clamp*` from `config.voltage` and `noiseLevel` from `config.simulation.defaultNoise * config.simulation.maxNoiseLevel * config.gates.outputNoiseRatio` (same formula DFF uses today).

### Gate class template

All five gates follow the same shape. Example (`and-gate.ts`):

```ts
export class ANDGate implements CombinationalComponent {
  readonly kind = "combinational" as const;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;

  private readonly aPort: Port;
  private readonly bPort: Port;
  private readonly outPort: Port;
  private readonly out: AnalogOutput;
  private readonly threshold: number;

  constructor(readonly id: string, params: Record<string, unknown>, deps: ComponentDeps) {
    this.threshold = deps.config.voltage.logicHighMin;
    const cfg = mergeGateParams(deps.config, params);

    this.aPort = createPort("a");
    this.bPort = createPort("b");
    this.outPort = createPort("out");
    this.inputs = new Map([["a", this.aPort], ["b", this.bPort]]);
    this.outputs = new Map([["out", this.outPort]]);

    this.out = new AnalogOutput(cfg, deps.rng);
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

`FullAdder` has two `AnalogOutput` fields (`sumOut`, `coutOut`), sets both in `evaluate()`, updates both in `update()`, and writes both to their ports.

### Engine change: `SimulationEngine.tick()`

Current loop:

```
seq.update → propagate → seq.clock → propagate → evaluateCombinational → propagate → buffer.push
```

New loop:

```
seq.update(dt)          // DFF qSignal step
propagate               // DFF outputs visible on nets
seq.clock(dt)           // DFF edge detect, queue pending Q
comb.evaluate()         // gate boolean logic, queue pending output via AnalogOutput.set
comb.update(dt)         // gate Signal step, resolve pending tPD, write Signal.voltage to outPort
propagate               // gate outputs visible on nets
buffer.push
```

`evaluate()` is called before `update()` inside the combinational phase so new targets are queued before the Signal steps. Topological ordering within `evaluate()` is **not** required — each gate reacts to whatever voltage its input currently has; the actual settling happens over subsequent ticks via each gate's own `AnalogOutput`.

### `CircuitGraph` simplification

- Delete `levelize()` (entire method).
- Delete `findDriverOf()`.
- Delete `combinationalOrder: CombinationalComponent[]`. Replace with a flat `combinationalList: CombinationalComponent[]` built during component instantiation (same loop that builds `sequentialList`).
- `evaluateCombinational()` iterates `combinationalList` in insertion order.
- Add new method `updateCombinational(dt: number)` that iterates `combinationalList` and calls `update(dt)` on each.
- No cycle check. Circuit definitions with combinational feedback loops are now legal.

### Registry

No change. Each gate constructor now takes `params` that may include tPD/zeta/etc., but the registry already passes `params` through.

## Data Flow — One Tick

1. **Sequential update**: `DFlipFlop.update(dt)` advances `qSignal` toward its current target, writes `qSignal.voltage` to `qPort`. Runs for all sequential components.
2. **Propagate**: `qPort` voltages flow into connected nets → load ports (e.g., `fa0.b`).
3. **Sequential clock**: `DFlipFlop.clock(dt)` inspects `clkPort` for rising edge, samples `dPort`, queues pending Q (no voltage change yet).
4. **Combinational evaluate**: Each gate reads its input voltages, thresholds them, computes boolean output, calls `this.out.set(logic)`. If the boolean target changed, `AnalogOutput` queues a pending target with `tPD` timer.
5. **Combinational update**: Each gate calls `this.out.update(dt)` → timer ticks down; on expiry, pending target becomes the Signal's `targetLogic`. Signal integrates one `dt` forward with noise. Gate writes `Signal.voltage` to `outPort`.
6. **Propagate**: Gate outputs flow into connected nets → downstream load ports (e.g., `fa1.cin`).
7. **Buffer push**: Probes collect net voltages → `WaveformBuffer.push`.

For a 4-bit ripple carry accumulator with `tPD = 1 ms` and physics running at 120 Hz (`dt ≈ 8.3 ms`), `fa0`'s cout settles after ~1 ms. `fa1` sees the new cout on its next tick, sets its own pending (another 1 ms tPD), and so on. On the oscilloscope you see sum bits transition in a cascade, not simultaneously.

## Existing Circuits — Visible Changes

- **DFF circuit** (`src/circuits/dff.ts`): unchanged behaviourally; nothing combinational in it.
- **4-bit accumulator** (`src/circuits/adder.ts`): bits now transition in a ripple pattern rather than simultaneously. `Q0` settles first, then `Q1`, etc. At `tPD = 1 ms` and clock period of e.g. 50 ms, ripple is complete well before the next clock edge — logical behaviour preserved, but the waveforms look different. Document in README.

## Testing

### New tests

- **`analog-output.test.ts`**: unit tests for the helper. `set(logic)` queues pending; calling `set` with the same value is a no-op; after `tPD` seconds of `update(dt)` the target applies; Signal voltage approaches `baseHigh` over further updates; `snapTo(1)` bypasses tPD and slew. Deterministic seeded RNG.
- **`test-helpers.ts`** (or similar): add `settle(comp, dt, duration)` helper that loops `comp.update(dt)` for `duration / dt` iterations. Used by gate tests.
- **Ripple-carry integration test** in `src/circuits/adder.test.ts`: set all A inputs, step the engine for a few ticks, assert `fa0.sum` port voltage crosses threshold *before* `fa3.sum` port voltage crosses threshold. Concrete proof that propagation delay cascades.
- **Feedback circuit smoke test** (ring oscillator): build a test circuit with 3 `NOTGate` instances in a loop (out → out → out → out), run for 50 ms simulation time, assert the net voltage oscillates between LOW and HIGH at approximately `1 / (6 * tPD)` Hz (allow ±20 %). Guards the "no cycle rejection" behaviour and validates tPD cascading.

### Rewritten tests

- **All five gate truth-table tests** (`and-gate.test.ts`, `or-gate.test.ts`, …): keep the same eight/four/two truth-table assertions, but instead of `gate.evaluate(); expect(out.voltage)`, call `gate.evaluate(); settle(gate, dt, 5 * tPD); expect(outPort.voltage)`. The *conclusion* is the same (output is HIGH or LOW after settling), only the mechanism changes.
- **`default-registry.test.ts`**: unchanged. Each gate still instantiates without throwing.
- **`adder.test.ts`**: existing "instantiates without error" and "has 13 components" tests unchanged. The "carry chain propagates" test must account for delay — either `settle()` after injecting, or assert eventual equality.

### Regressions to watch

- **`graph.test.ts`**: any test asserting that `levelize()` or `findDriverOf` exist or behave a specific way must be removed or rewritten.
- **DFF tests**: the DFF's own tests are unchanged but run under the new engine loop — confirm they still pass.

## Risks and Mitigations

1. **Frame-rate coupling of tPD**: if `dt > tPD`, the pending timer goes negative on the first tick and applies immediately. This is correct — the gate resolves as fast as the physics clock allows. At the default physics rate (~120 Hz, dt ≈ 8.3 ms) and `tPD = 1 ms`, gates resolve within one tick but the Signal still slews smoothly over subsequent ticks. **Documented behaviour, not a bug.**
2. **Numerical stability of Signal at large dt**: same caveat the DFF has today. `ωₙ = 2π·120 ≈ 754 rad/s`; stable for `dt < 1 / ωₙ ≈ 1.3 ms`. The physics worker runs at ~120 Hz → dt ≈ 8.3 ms, which is **outside the stable region**. The existing DFF already lives with this; gates will show the same slight overshoot. If we ever run physics at 1 kHz+, the problem goes away. **Flagged, not addressed here.** A follow-up might move Signal to symplectic Euler or a fixed sub-step.
3. **Visual regression for adder users**: traces change. README must be updated to show the new behaviour. Include a short "What changed" note.
4. **Removal of cycle detection as a footgun**: a user who *doesn't* intend feedback and miswires the netlist no longer gets an error. Mitigation: `CircuitGraph` can warn via `console.warn` if it detects an obvious cycle at construction time (optional, cheap). **Recommendation**: add the warning but not the throw, so accidentally cyclic circuits run but are surfaced.
5. **Noise on every gate output**: on a 4-bit adder there are 4 sum outputs + 4 cout outputs = 8 extra noise sources plus the 4 DFF Q outputs = 12 total. Oscilloscope traces will have a noticeably noisier baseline. This is correct, but the default noise level may need tuning. Keep `DefaultPhysicsConfig.simulation.defaultNoise` unchanged for now; re-tune if the adder looks visually chaotic in the browser.

## Rollout

Suggested commits (one PR, logical sequence):

1. `feat(physics): add AnalogOutput helper with tPD + Signal dynamics` — introduces `analog-output.ts` and its tests. No wiring.
2. `refactor(physics): require CombinationalComponent.update(dt)` — type change + stubbed `update()` on all five gates (just `this.outPort.voltage = …` with no-op update). Tests still pass because the gates remain ideal for this commit.
3. `feat(physics): wire AnalogOutput into all five gates` — each gate actually uses `AnalogOutput`. Gate tests rewritten to use `settle()`.
4. `refactor(engine): call comb.update(dt) each tick, remove levelize/findDriverOf` — engine loop change, `CircuitGraph` simplification, cycle-check warning added.
5. `test(physics): ring-oscillator feedback integration test` — proves the new engine supports cycles.
6. `docs: note ripple-settling behaviour in README` — updates the README's adder description.

## Verification Checklist

1. `bun run typecheck` → 0 errors.
2. `bun run check` → 0 Biome warnings.
3. `bun run test` → all tests pass: existing DFF tests, rewritten gate tests, new `AnalogOutput` unit tests, new ripple-carry integration test, new ring-oscillator test.
4. `bun run build` → succeeds.
5. `bun run dev`: open the DFF circuit, confirm behaviour is visually identical. Open the 4-bit accumulator, confirm Q0..Q3 transition in a cascade (visible ripple). Toggle multiple A bits and confirm propagation delay is visible on the traces.
6. Manual check: build a 3-NOTgate ring oscillator circuit definition, confirm oscillation on the scope at roughly `1/(6·tPD) ≈ 167 Hz`.

## Dependencies

- **Subsumes** `2026-04-17-buffer-rename-design.md`'s earlier graph-index proposal (`levelize` and `findDriverOf` are deleted here, so no index to build).
- **Independent of** `B — physically-biased metastability` and `D — accessibility pass`.
- **Should ship after** the buffer-rename spec (trivial, no conflict) and before B (B's tests are simpler if gates are already dynamic).
