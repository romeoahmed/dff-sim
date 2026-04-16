# D-FlipFlop Simulation React + WebGPU Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ground-up rewrite of D flip-flop simulation with React 19, Tailwind CSS v4, raw WebGPU/WGSL, multi-Worker Actor Model, generic circuit graph, and full EE-realistic physics.

**Architecture:** Three-thread Actor Model (React main thread, Physics Worker, Render Worker) with Comlink + MessageChannel. Generic circuit graph with levelized evaluation. N-channel WebGPU rendering. Jotai atomic state (atomFamily per probe/param). All physics classes use constructor injection with seedable PRNG for deterministic testing.

**Tech Stack:** React 19, Tailwind CSS v4, shadcn/ui, Jotai, WebGPU + WGSL, Comlink, Vite 8, Biome, Lingui, Vitest + Testing Library, Bun

**Spec:** `docs/superpowers/specs/2026-04-16-react-rewrite-design.md`

---

## Phase Overview

| Phase | Tasks | Description | Milestone |
|---|---|---|---|
| 1 | 1-2 | Project scaffold, tooling | `bun run dev` shows blank React page |
| 2 | 3 | Core types, constants, validation | All shared interfaces defined |
| 3 | 4-6 | Physics primitives (noise, signal, RNG) | All primitives pass unit tests |
| 4 | 7-9 | Component base, registry, sources | Clock + Signal sources pass tests |
| 5 | 10 | DFlipFlop | Full flip-flop logic passes tests |
| 6 | 11-12 | Circuit graph, engine, buffer | Complete simulation engine passes tests |
| 7 | 13 | Physics Worker + Comlink | Worker runs simulation, sends data |
| 8 | 14-16 | WebGPU device, WGSL shaders, render pipelines | Render Worker draws waveforms |
| 9 | 17 | Worker bridge (MessageChannel) | Physics → Render data flow works |
| 10 | 18-19 | Jotai atoms | All atoms pass tests |
| 11 | 20-24 | React UI components | Full UI renders in browser |
| 12 | 25 | useSimulation hook (connect everything) | Full simulation running in browser |
| 13 | 26 | DFF circuit definition | DFF demo works end-to-end |
| 14 | 27-28 | i18n (Lingui), CI/CD | Localized, deployable |

---

## Phase 1: Project Scaffold

### Task 1: Initialize project on new branch

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/app/main.tsx`, `src/app/App.tsx`
- Delete: `src/` (entire old source directory)

- [ ] **Step 1: Create branch and clean old source**

```bash
git switch -c feat/react-rewrite
```

- [ ] **Step 2: Remove old source files**

Remove the old `src/` directory entirely. We're starting from scratch.

```bash
rm -rf src/
```

- [ ] **Step 3: Create package.json**

Create `package.json` with all dependencies from the spec:

```json
{
  "name": "dff-sim",
  "version": "2.0.0",
  "description": "D-FlipFlop Circuit Simulation — React + WebGPU",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "check": "biome check .",
    "check:fix": "biome check . --write",
    "format": "biome format . --write",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "lingui:extract": "lingui extract",
    "lingui:compile": "lingui compile"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "jotai": "^2.12.0",
    "comlink": "^4.4.2",
    "lucide-react": "^0.509.0",
    "zod": "^3.25.0",
    "@lingui/core": "^5.3.0",
    "@lingui/react": "^5.3.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-slider": "^1.3.0",
    "@radix-ui/react-switch": "^1.2.0",
    "@radix-ui/react-toggle-group": "^1.1.0",
    "@radix-ui/react-slot": "^1.2.0",
    "tailwind-merge": "^3.3.0",
    "class-variance-authority": "^0.7.0"
  },
  "devDependencies": {
    "typescript": "^6.0.0",
    "vite": "^8.0.0",
    "@vitejs/plugin-react": "^4.5.0",
    "@biomejs/biome": "^1.9.0",
    "vitest": "^3.2.0",
    "@testing-library/react": "^16.3.0",
    "@testing-library/jest-dom": "^6.6.0",
    "happy-dom": "^18.0.0",
    "@lingui/cli": "^5.3.0",
    "@lingui/macro": "^5.3.0",
    "@lingui/vite-plugin": "^5.3.0",
    "tailwindcss": "^4.1.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@types/bun": "^1.3.0"
  },
  "trustedDependencies": [
    "@parcel/watcher"
  ]
}
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"],
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "module": "esnext",
    "target": "esnext",
    "moduleResolution": "bundler",
    "types": ["vite/client", "node", "bun"],
    "lib": ["ESNext", "DOM", "DOM.Iterable", "WebWorker"],
    "jsx": "react-jsx",
    "sourceMap": false,
    "declaration": false,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "moduleDetection": "force",
    "skipLibCheck": true,
    "useDefineForClassFields": true,
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 5: Create vite.config.ts**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
  },
  base: "./",
});
```

- [ ] **Step 6: Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>D-FlipFlop Simulation</title>
    <meta name="description" content="WebGPU-powered D flip-flop circuit simulation with realistic analog physics" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/app/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create src/app/main.tsx**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "../styles/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 8: Create src/app/App.tsx**

```tsx
export function App() {
  return (
    <div className="min-h-screen bg-base text-text">
      <h1 className="text-2xl p-8">D-FlipFlop Simulation</h1>
      <p className="px-8 text-subtext">React + WebGPU rewrite in progress</p>
    </div>
  );
}
```

- [ ] **Step 9: Create src/styles/globals.css**

```css
@import "tailwindcss";

@theme {
  --color-base: #24273a;
  --color-mantle: #1e2030;
  --color-crust: #181926;
  --color-surface-0: #363a4f;
  --color-surface-1: #494d64;
  --color-surface-2: #5b6078;
  --color-text: #cad3f5;
  --color-subtext: #a5adcb;
  --color-accent-green: #a6da95;
  --color-accent-blue: #8aadf4;
  --color-accent-red: #ed8796;
  --color-accent-yellow: #eed49f;
  --color-accent-mauve: #c6a0f6;
  --color-accent-teal: #7dc4e4;
  --color-accent-lavender: #b7bdf8;
  --color-accent-peach: #f5a97f;
  --color-overlay: #363a4f;
}

body {
  background-color: var(--color-base);
  color: var(--color-text);
  font-family: "Segoe UI", system-ui, sans-serif;
}
```

- [ ] **Step 10: Install dependencies and verify**

```bash
bun install
bun run dev
```

Expected: Vite dev server starts, browser shows "D-FlipFlop Simulation" on dark background.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: initialize React + Vite + Tailwind v4 project scaffold

New branch for complete React + WebGPU rewrite. Includes all production
and dev dependencies, strict TypeScript config, Catppuccin Macchiato theme."
```

---

### Task 2: Configure Biome and Vitest

**Files:**
- Create: `biome.json`, `vitest.config.ts`, `src/test/setup.ts`

- [ ] **Step 1: Create biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/latest/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "warn",
        "noUnusedImports": "warn"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "style": {
        "noNonNullAssertion": "warn",
        "useConst": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "css": {
    "linter": { "enabled": true },
    "formatter": { "enabled": true }
  },
  "files": {
    "ignore": ["dist/**", "node_modules/**", "*.wgsl"]
  }
}
```

- [ ] **Step 2: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 3: Create src/test/setup.ts**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Verify Biome**

```bash
bun run check
```

Expected: Biome runs with no errors (or only warnings on existing files).

- [ ] **Step 5: Verify Vitest runs (no tests yet)**

```bash
bun run test
```

Expected: "No test files found" or similar — confirms Vitest is configured correctly.

- [ ] **Step 6: Verify typecheck**

```bash
bun run typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add biome.json vitest.config.ts src/test/setup.ts
git commit -m "feat: configure Biome linter and Vitest test runner"
```

---

## Phase 2: Core Types & Constants

### Task 3: Shared types, constants, and validation

**Files:**
- Create: `src/lib/types.ts`, `src/lib/constants.ts`, `src/lib/validation.ts`

- [ ] **Step 1: Create src/lib/types.ts**

All shared TypeScript interfaces. This is the foundation every other module depends on.

```ts
// ─── RNG ───────────────────────────────────────────────

/** Uniform [0, 1) random number generator — same signature as Math.random */
export type RngFn = () => number;

// ─── Physics Config ────────────────────────────────────

export interface VoltageSpecConfig {
  readonly logicHighMin: number;
  readonly logicLowMax: number;
  readonly outputHighMin: number;
  readonly outputHighMax: number;
  readonly outputLowMax: number;
  readonly systemMax: number;
  readonly clampMin: number;
}

export interface SimulationConfig {
  readonly maxNoiseLevel: number;
  readonly clockSpeedFactor: number;
  readonly defaultSpeed: number;
  readonly defaultNoise: number;
  readonly baseFrameRate: number;
  readonly bufferLength: number;
  readonly outputNoiseRatio: number;
  readonly physicsDt: number;
}

export interface TimingConfig {
  readonly tSetup: number;
  readonly tHold: number;
  readonly tCQ: number;
  readonly tauMeta: number;
}

export interface SignalConfig {
  readonly baseHigh: number;
  readonly baseLow: number;
  readonly zeta: number;
  readonly ringFreq: number;
  readonly clampMin: number;
  readonly clampMax: number;
}

export interface PhysicsConfig {
  readonly voltage: Readonly<VoltageSpecConfig>;
  readonly simulation: Readonly<SimulationConfig>;
  readonly timing: Readonly<TimingConfig>;
}

// ─── Circuit Graph Model ───────────────────────────────

export interface Port {
  readonly name: string;
  voltage: number;
}

export interface Component {
  readonly id: string;
  readonly kind: "combinational" | "sequential";
  readonly inputs: ReadonlyMap<string, Port>;
  readonly outputs: ReadonlyMap<string, Port>;
}

export interface CombinationalComponent extends Component {
  readonly kind: "combinational";
  evaluate(): void;
}

export interface SequentialComponent extends Component {
  readonly kind: "sequential";
  clock(dt: number): void;
  update(dt: number): void;
}

export interface NetDef {
  readonly id: string;
  readonly driver: { readonly componentId: string; readonly port: string };
  readonly loads: ReadonlyArray<{ readonly componentId: string; readonly port: string }>;
}

export interface Net {
  readonly id: string;
  readonly driverPort: Port;
  readonly loadPorts: ReadonlyArray<Port>;
  voltage: number;
}

export interface Probe {
  readonly netId: string;
  readonly label: string;
  readonly color: string;
  readonly channelIndex: number;
}

export interface ControlDef {
  readonly type: "slider" | "toggle" | "momentary";
  readonly targetComponent: string;
  readonly param: string;
  readonly label: string;
  readonly min?: number;
  readonly max?: number;
  readonly defaultValue?: number | boolean;
}

export interface ComponentDef {
  readonly type: string;
  readonly id: string;
  readonly params: Record<string, unknown>;
}

export interface CircuitDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly components: ReadonlyArray<ComponentDef>;
  readonly nets: ReadonlyArray<NetDef>;
  readonly probes: ReadonlyArray<Probe>;
  readonly controls: ReadonlyArray<ControlDef>;
}

// ─── Component DI Dependencies ─────────────────────────

export interface ComponentDeps {
  readonly config: PhysicsConfig;
  readonly rng: RngFn;
}

export type ComponentFactory = (
  id: string,
  params: Record<string, unknown>,
  deps: ComponentDeps,
) => Component;

// ─── Color Config ──────────────────────────────────────

export interface ColorConfig {
  readonly [key: string]: string;
}

// ─── Layout Config ─────────────────────────────────────

export interface LayoutConfig {
  readonly canvasHeight: number;
  readonly digitalScopeHeight: number;
  readonly channelRowHeight: number;
  readonly canvasPadding: number;
  readonly scaleY: number;
  readonly voltageHeadroom: number;
  readonly waveformLineWidth: number;
  readonly thresholdLineWidth: number;
  readonly labelOffsetX: number;
  readonly labelOffsetY: number;
  readonly dashPattern: readonly [number, number];
}
```

- [ ] **Step 2: Create src/lib/constants.ts**

```ts
import type {
  ColorConfig,
  LayoutConfig,
  PhysicsConfig,
  SimulationConfig,
  TimingConfig,
  VoltageSpecConfig,
} from "./types";

export const Colors: ColorConfig = {
  green: "#a6da95",
  blue: "#8aadf4",
  red: "#ed8796",
  yellow: "#eed49f",
  mauve: "#c6a0f6",
  teal: "#7dc4e4",
  lavender: "#b7bdf8",
  peach: "#f5a97f",
  text: "#cad3f5",
  subtext: "#a5adcb",
  grid: "#363a4f",
  stroke: "#494d64",
  fill: "#5b6078",
  surface0: "#363a4f",
} as const;

export const DefaultVoltageSpecs: VoltageSpecConfig = {
  logicHighMin: 1.0,
  logicLowMax: 0.6,
  outputHighMin: 1.8,
  outputHighMax: 2.0,
  outputLowMax: 0.2,
  systemMax: 2.5,
  clampMin: -0.5,
} as const;

export const DefaultSimulation: SimulationConfig = {
  maxNoiseLevel: 0.8,
  clockSpeedFactor: 0.002,
  defaultSpeed: 30,
  defaultNoise: 10,
  baseFrameRate: 60,
  bufferLength: 2048,
  outputNoiseRatio: 0.5,
  physicsDt: 0.0001,
} as const;

export const DefaultTiming: TimingConfig = {
  tSetup: 0.003,
  tHold: 0.001,
  tCQ: 0.002,
  tauMeta: 0.005,
} as const;

export const DefaultPhysicsConfig: PhysicsConfig = {
  voltage: DefaultVoltageSpecs,
  simulation: DefaultSimulation,
  timing: DefaultTiming,
} as const;

export const Layout: LayoutConfig = {
  canvasHeight: 300,
  digitalScopeHeight: 150,
  channelRowHeight: 80,
  canvasPadding: 32,
  scaleY: 30,
  voltageHeadroom: 2.5,
  waveformLineWidth: 2,
  thresholdLineWidth: 1,
  labelOffsetX: 6,
  labelOffsetY: 18,
  dashPattern: [5, 5],
} as const;
```

- [ ] **Step 3: Create src/lib/validation.ts**

```ts
import { z } from "zod";

export const voltageSpecSchema = z
  .object({
    logicHighMin: z.number(),
    logicLowMax: z.number(),
    outputHighMin: z.number(),
    outputHighMax: z.number(),
    outputLowMax: z.number(),
    systemMax: z.number(),
    clampMin: z.number(),
  })
  .refine((s) => s.outputLowMax < s.logicLowMax, {
    message: "outputLowMax must be less than logicLowMax",
  })
  .refine((s) => s.logicLowMax < s.logicHighMin, {
    message: "logicLowMax must be less than logicHighMin",
  })
  .refine((s) => s.logicHighMin <= s.outputHighMin, {
    message: "logicHighMin must be <= outputHighMin",
  })
  .refine((s) => s.outputHighMin <= s.outputHighMax, {
    message: "outputHighMin must be <= outputHighMax",
  })
  .refine((s) => s.outputHighMax <= s.systemMax, {
    message: "outputHighMax must be <= systemMax",
  })
  .refine((s) => s.clampMin < s.outputLowMax, {
    message: "clampMin must be less than outputLowMax",
  });

export const circuitDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  components: z.array(
    z.object({
      type: z.string().min(1),
      id: z.string().min(1),
      params: z.record(z.unknown()),
    }),
  ),
  nets: z.array(
    z.object({
      id: z.string().min(1),
      driver: z.object({
        componentId: z.string(),
        port: z.string(),
      }),
      loads: z.array(
        z.object({
          componentId: z.string(),
          port: z.string(),
        }),
      ),
    }),
  ),
  probes: z.array(
    z.object({
      netId: z.string(),
      label: z.string(),
      color: z.string(),
      channelIndex: z.number().int().nonnegative(),
    }),
  ),
  controls: z.array(
    z.object({
      type: z.enum(["slider", "toggle", "momentary"]),
      targetComponent: z.string(),
      param: z.string(),
      label: z.string(),
      min: z.number().optional(),
      max: z.number().optional(),
      defaultValue: z.union([z.number(), z.boolean()]).optional(),
    }),
  ),
});
```

- [ ] **Step 4: Verify typecheck**

```bash
bun run typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/
git commit -m "feat: add core types, constants, and Zod validation schemas

Defines all shared interfaces (circuit graph, physics config, DI types),
Catppuccin color palette, default physics constants, and Zod schemas
for voltage spec and circuit definition validation."
```

---

## Phase 3: Physics Primitives (TDD)

### Task 4: Seedable PRNG utility

**Files:**
- Create: `src/lib/rng.ts`, `src/lib/rng.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/rng.test.ts
import { describe, expect, it } from "vitest";
import { createSeededRng } from "./rng";

describe("createSeededRng", () => {
  it("produces values in [0, 1)", () => {
    const rng = createSeededRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is deterministic — same seed produces same sequence", () => {
    const a = createSeededRng(123);
    const b = createSeededRng(123);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it("different seeds produce different sequences", () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    const valuesA = Array.from({ length: 10 }, () => a());
    const valuesB = Array.from({ length: 10 }, () => b());
    expect(valuesA).not.toEqual(valuesB);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run vitest run src/lib/rng.test.ts
```

Expected: FAIL — `createSeededRng` not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/rng.ts
import type { RngFn } from "./types";

/**
 * Creates a seedable PRNG using the mulberry32 algorithm.
 * Returns a function with the same signature as Math.random(): () => [0, 1)
 */
export function createSeededRng(seed: number): RngFn {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun run vitest run src/lib/rng.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rng.ts src/lib/rng.test.ts
git commit -m "feat: add seedable PRNG (mulberry32) for deterministic testing"
```

---

### Task 5: NoiseGenerator

**Files:**
- Create: `src/workers/physics/noise.ts`, `src/workers/physics/noise.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/workers/physics/noise.test.ts
import { describe, expect, it } from "vitest";
import { NoiseGenerator } from "./noise";
import { createSeededRng } from "@/lib/rng";

describe("NoiseGenerator", () => {
  it("produces deterministic output with seeded RNG", () => {
    const a = new NoiseGenerator(createSeededRng(42), 0.1);
    const b = new NoiseGenerator(createSeededRng(42), 0.1);
    for (let i = 0; i < 100; i++) {
      expect(a.sample()).toBe(b.sample());
    }
  });

  it("white noise has approximately zero mean", () => {
    const gen = new NoiseGenerator(createSeededRng(99), 0.5);
    let sum = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) {
      sum += gen.sample();
    }
    const mean = sum / N;
    expect(Math.abs(mean)).toBeLessThan(0.1);
  });

  it("noise scales with sigma", () => {
    const small = new NoiseGenerator(createSeededRng(1), 0.01);
    const large = new NoiseGenerator(createSeededRng(1), 1.0);

    let sumSmall = 0;
    let sumLarge = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) {
      sumSmall += small.sample() ** 2;
      sumLarge += large.sample() ** 2;
    }
    // Large sigma should produce much higher variance
    expect(sumLarge / N).toBeGreaterThan((sumSmall / N) * 10);
  });

  it("setSigma changes noise amplitude", () => {
    const gen = new NoiseGenerator(createSeededRng(7), 0.0);
    // With zero sigma, noise should be ~0
    let sum = 0;
    for (let i = 0; i < 100; i++) {
      sum += Math.abs(gen.sample());
    }
    expect(sum / 100).toBeLessThan(0.01);

    gen.setSigma(1.0);
    sum = 0;
    for (let i = 0; i < 100; i++) {
      sum += Math.abs(gen.sample());
    }
    expect(sum / 100).toBeGreaterThan(0.1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run vitest run src/workers/physics/noise.test.ts
```

Expected: FAIL — `NoiseGenerator` not found.

- [ ] **Step 3: Implement NoiseGenerator**

```ts
// src/workers/physics/noise.ts
import type { RngFn } from "@/lib/types";

const FLICKER_RATIO = 4.0;

/**
 * Composite noise generator: Marsaglia white + Voss-McCartney 1/f.
 * Receives RngFn via constructor — never calls Math.random() directly.
 */
export class NoiseGenerator {
  private sigmaWhite: number;
  private sigmaFlicker: number;

  // Marsaglia Polar cache
  private noiseCache: number | null = null;

  // Voss-McCartney state
  private readonly octaves: number;
  private readonly generators: Float64Array;
  private runningSum: number = 0;
  private counter: number = 0;

  constructor(
    private readonly rng: RngFn,
    sigmaWhite: number,
    octaves: number = 8,
  ) {
    this.sigmaWhite = sigmaWhite;
    this.sigmaFlicker = sigmaWhite * FLICKER_RATIO;
    this.octaves = octaves;

    // Initialize Voss-McCartney generators
    this.generators = new Float64Array(octaves);
    for (let i = 0; i < octaves; i++) {
      const val = this.gaussianSample();
      this.generators[i] = val;
      this.runningSum += val;
    }
  }

  setSigma(sigmaWhite: number): void {
    this.sigmaWhite = sigmaWhite;
    this.sigmaFlicker = sigmaWhite * FLICKER_RATIO;
  }

  sample(): number {
    const white = this.gaussianSample() * this.sigmaWhite;
    const flicker = this.flickerSample() * this.sigmaFlicker;
    return white + flicker;
  }

  /** Marsaglia Polar Method — uses injected RNG */
  private gaussianSample(): number {
    if (this.noiseCache !== null) {
      const cached = this.noiseCache;
      this.noiseCache = null;
      return cached;
    }

    let u: number;
    let v: number;
    let s: number;
    do {
      u = this.rng() * 2 - 1;
      v = this.rng() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);

    const mul = Math.sqrt((-2.0 * Math.log(s)) / s);
    this.noiseCache = v * mul;
    return u * mul;
  }

  /** Voss-McCartney 1/f noise */
  private flickerSample(): number {
    // Find lowest set bit — which octave to update
    const idx = this.ctz(this.counter);
    if (idx < this.octaves) {
      this.runningSum -= this.generators[idx]!;
      const newVal = this.gaussianSample();
      this.generators[idx] = newVal;
      this.runningSum += newVal;
    }
    this.counter++;

    return this.runningSum / this.octaves;
  }

  /** Count trailing zeros (lowest set bit index) */
  private ctz(n: number): number {
    if (n === 0) return 32;
    return Math.log2(n & -n) | 0;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
bun run vitest run src/workers/physics/noise.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/workers/physics/noise.ts src/workers/physics/noise.test.ts
git commit -m "feat: add NoiseGenerator with Marsaglia white + Voss-McCartney 1/f noise

Composite noise generator with DI: receives RngFn for deterministic testing.
Marsaglia Polar Method for Gaussian white noise, Voss-McCartney (8 octaves)
for 1/f flicker noise. Sigma scales with user noise control."
```

---

### Task 6: Signal (state-space RLC model)

**Files:**
- Create: `src/workers/physics/signal.ts`, `src/workers/physics/signal.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/workers/physics/signal.test.ts
import { describe, expect, it } from "vitest";
import { Signal } from "./signal";
import { NoiseGenerator } from "./noise";
import { createSeededRng } from "@/lib/rng";
import type { SignalConfig } from "@/lib/types";

const BASE_CONFIG: SignalConfig = {
  baseHigh: 2.0,
  baseLow: 0.0,
  zeta: 0.6,
  ringFreq: 100,
  clampMin: -0.5,
  clampMax: 2.5,
};

function createZeroNoise(): NoiseGenerator {
  return new NoiseGenerator(createSeededRng(0), 0);
}

describe("Signal", () => {
  it("converges to baseHigh when targetLogic is 1 (no noise)", () => {
    const sig = new Signal(BASE_CONFIG, createZeroNoise());
    sig.targetLogic = 1;
    const dt = 0.0001;
    for (let i = 0; i < 5000; i++) {
      sig.update(dt);
    }
    // After 500ms, should be very close to baseHigh (2.0V)
    expect(sig.voltage).toBeCloseTo(2.0, 1);
  });

  it("converges to baseLow when targetLogic is 0 (no noise)", () => {
    const sig = new Signal(BASE_CONFIG, createZeroNoise());
    sig.targetLogic = 1;
    // First drive high
    for (let i = 0; i < 5000; i++) sig.update(0.0001);
    // Then drive low
    sig.targetLogic = 0;
    for (let i = 0; i < 5000; i++) sig.update(0.0001);
    expect(sig.voltage).toBeCloseTo(0.0, 1);
  });

  it("exhibits overshoot for underdamped system (zeta=0.6)", () => {
    const sig = new Signal(BASE_CONFIG, createZeroNoise());
    sig.targetLogic = 1;
    const dt = 0.0001;
    let maxVoltage = 0;
    for (let i = 0; i < 2000; i++) {
      sig.update(dt);
      if (sig.voltage > maxVoltage) maxVoltage = sig.voltage;
    }
    // Overshoot: max should exceed target (2.0V) by ~9.5%
    expect(maxVoltage).toBeGreaterThan(BASE_CONFIG.baseHigh);
    expect(maxVoltage).toBeLessThan(BASE_CONFIG.baseHigh * 1.20);
  });

  it("clamps voltage within bounds", () => {
    const sig = new Signal(BASE_CONFIG, createZeroNoise());
    sig.targetLogic = 1;
    for (let i = 0; i < 10000; i++) sig.update(0.0001);
    expect(sig.voltage).toBeLessThanOrEqual(BASE_CONFIG.clampMax);
    expect(sig.voltage).toBeGreaterThanOrEqual(BASE_CONFIG.clampMin);
  });

  it("is frame-rate independent (same result at different dt)", () => {
    const configHigh: SignalConfig = { ...BASE_CONFIG, zeta: 0.9 };

    const fast = new Signal(configHigh, createZeroNoise());
    const slow = new Signal(configHigh, createZeroNoise());

    fast.targetLogic = 1;
    slow.targetLogic = 1;

    // Fast: 10000 steps of 0.0001s = 1.0s total
    for (let i = 0; i < 10000; i++) fast.update(0.0001);
    // Slow: 2000 steps of 0.0005s = 1.0s total
    for (let i = 0; i < 2000; i++) slow.update(0.0005);

    // Both should converge to approximately the same value
    expect(fast.voltage).toBeCloseTo(slow.voltage, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run vitest run src/workers/physics/signal.test.ts
```

Expected: FAIL — `Signal` not found.

- [ ] **Step 3: Implement Signal**

```ts
// src/workers/physics/signal.ts
import type { SignalConfig } from "@/lib/types";
import type { NoiseGenerator } from "./noise";

/**
 * Models a voltage source with second-order RLC edge response.
 * State-space form: two state variables (voltage and its derivative).
 * Receives SignalConfig and NoiseGenerator via constructor (DI).
 */
export class Signal {
  /** Current output voltage */
  voltage: number = 0;

  /** Target logic state (0 or 1) */
  targetLogic: 0 | 1 = 0;

  // State-space variables
  private x1: number = 0; // voltage
  private x2: number = 0; // derivative

  // Precomputed angular frequency
  private readonly wn: number;

  constructor(
    private readonly config: SignalConfig,
    private readonly noise: NoiseGenerator,
  ) {
    this.wn = 2 * Math.PI * config.ringFreq;
  }

  update(dt: number): void {
    const { baseHigh, baseLow, zeta, clampMin, clampMax } = this.config;

    // Target voltage based on logic state
    const target = this.targetLogic === 1 ? baseHigh : baseLow;

    // Add noise
    const noisyTarget = target + this.noise.sample();

    // State-space RLC: second-order step response
    const error = noisyTarget - this.x1;
    const wn = this.wn;
    this.x2 += (wn * wn * error - 2 * zeta * wn * this.x2) * dt;
    this.x1 += this.x2 * dt;

    // Clamp
    this.voltage = Math.max(clampMin, Math.min(clampMax, this.x1));
  }

  /** Reset state to a specific voltage (used when config changes) */
  snapTo(voltage: number): void {
    this.x1 = voltage;
    this.x2 = 0;
    this.voltage = voltage;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
bun run vitest run src/workers/physics/signal.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/workers/physics/signal.ts src/workers/physics/signal.test.ts
git commit -m "feat: add Signal class with state-space RLC model

Second-order underdamped step response with configurable zeta and
ring frequency. NoiseGenerator injected via constructor. Tests verify
overshoot, convergence, clamping, and frame-rate independence."
```

---

## Phase 4: Circuit Components (TDD)

### Task 7: Component base interfaces and ComponentRegistry

**Files:**
- Create: `src/workers/physics/components/base.ts`, `src/workers/physics/components/registry.ts`, `src/workers/physics/components/registry.test.ts`

- [ ] **Step 1: Create base interfaces**

```ts
// src/workers/physics/components/base.ts
import type {
  Component,
  CombinationalComponent,
  SequentialComponent,
  Port,
} from "@/lib/types";

export type { Component, CombinationalComponent, SequentialComponent };

/** Helper to create a Port */
export function createPort(name: string, initialVoltage: number = 0): Port {
  return { name, voltage: initialVoltage };
}

/** Helper to check if a component is sequential */
export function isSequential(c: Component): c is SequentialComponent {
  return c.kind === "sequential";
}

/** Helper to check if a component is combinational */
export function isCombinational(c: Component): c is CombinationalComponent {
  return c.kind === "combinational";
}
```

- [ ] **Step 2: Write failing test for registry**

```ts
// src/workers/physics/components/registry.test.ts
import { describe, expect, it } from "vitest";
import { ComponentRegistry } from "./registry";
import { createPort } from "./base";
import type { Component, ComponentDeps, PhysicsConfig, RngFn } from "@/lib/types";
import { DefaultPhysicsConfig } from "@/lib/constants";

class MockComponent implements Component {
  readonly kind = "combinational" as const;
  readonly inputs = new Map();
  readonly outputs = new Map([["out", createPort("out")]]);

  constructor(
    readonly id: string,
    readonly receivedParams: Record<string, unknown>,
  ) {}

  evaluate() {}
}

const mockDeps: ComponentDeps = {
  config: DefaultPhysicsConfig,
  rng: Math.random,
};

describe("ComponentRegistry", () => {
  it("creates a registered component", () => {
    const registry = new ComponentRegistry();
    registry.register("Mock", (id, params, _deps) => new MockComponent(id, params));

    const comp = registry.create("Mock", "m1", { foo: 42 }, mockDeps);
    expect(comp.id).toBe("m1");
    expect((comp as MockComponent).receivedParams).toEqual({ foo: 42 });
  });

  it("throws for unregistered type", () => {
    const registry = new ComponentRegistry();
    expect(() => registry.create("Unknown", "u1", {}, mockDeps)).toThrow(
      "Unknown component type: Unknown",
    );
  });

  it("passes deps to factory", () => {
    const registry = new ComponentRegistry();
    let capturedDeps: ComponentDeps | null = null;
    registry.register("Spy", (_id, _params, deps) => {
      capturedDeps = deps;
      return new MockComponent("spy", {});
    });

    registry.create("Spy", "s1", {}, mockDeps);
    expect(capturedDeps).toBe(mockDeps);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
bun run vitest run src/workers/physics/components/registry.test.ts
```

Expected: FAIL — `ComponentRegistry` not found.

- [ ] **Step 4: Implement ComponentRegistry**

```ts
// src/workers/physics/components/registry.ts
import type { Component, ComponentDeps, ComponentFactory } from "@/lib/types";

/**
 * DI-aware factory that maps component type strings to constructors.
 * Injects shared dependencies (config, RNG) into component factories.
 */
export class ComponentRegistry {
  private readonly factories = new Map<string, ComponentFactory>();

  register(type: string, factory: ComponentFactory): void {
    this.factories.set(type, factory);
  }

  create(
    type: string,
    id: string,
    params: Record<string, unknown>,
    deps: ComponentDeps,
  ): Component {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`Unknown component type: ${type}`);
    }
    return factory(id, params, deps);
  }

  has(type: string): boolean {
    return this.factories.has(type);
  }
}
```

- [ ] **Step 5: Run tests**

```bash
bun run vitest run src/workers/physics/components/registry.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/workers/physics/components/
git commit -m "feat: add Component base interfaces and ComponentRegistry

DI-aware factory pattern: registry maps type strings to factory functions,
injects PhysicsConfig and RngFn into component constructors. Tests verify
creation, error on unknown type, and dependency pass-through."
```

---

### Task 8: ClockSource component

**Files:**
- Create: `src/workers/physics/components/clock-source.ts`, `src/workers/physics/components/clock-source.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/workers/physics/components/clock-source.test.ts
import { describe, expect, it } from "vitest";
import { ClockSource } from "./clock-source";
import { createSeededRng } from "@/lib/rng";
import { DefaultPhysicsConfig } from "@/lib/constants";

describe("ClockSource", () => {
  it("produces a periodic signal", () => {
    const clk = new ClockSource("clk", { speed: 50 }, DefaultPhysicsConfig, createSeededRng(1));
    const dt = 0.0001;
    let transitions = 0;
    let lastLogic = -1;

    for (let i = 0; i < 50000; i++) {
      clk.update(dt);
      clk.clock(dt);
      const logic = clk.outputs.get("out")!.voltage > 1.0 ? 1 : 0;
      if (lastLogic >= 0 && logic !== lastLogic) transitions++;
      lastLogic = logic;
    }
    // Should have multiple transitions in 5 seconds of simulation
    expect(transitions).toBeGreaterThan(4);
  });

  it("jitter affects edge timing (non-zero jitterRms)", () => {
    const clk = new ClockSource(
      "clk",
      { speed: 50, jitterRms: 0.05 },
      DefaultPhysicsConfig,
      createSeededRng(42),
    );
    const dt = 0.0001;
    const edgeTimes: number[] = [];
    let lastLogic = 0;
    let time = 0;

    for (let i = 0; i < 100000; i++) {
      clk.update(dt);
      clk.clock(dt);
      const logic = clk.outputs.get("out")!.voltage > 1.0 ? 1 : 0;
      if (logic === 1 && lastLogic === 0) {
        edgeTimes.push(time);
      }
      lastLogic = logic;
      time += dt;
    }

    // Calculate periods between rising edges
    const periods: number[] = [];
    for (let i = 1; i < edgeTimes.length; i++) {
      periods.push(edgeTimes[i]! - edgeTimes[i - 1]!);
    }

    if (periods.length >= 2) {
      // Periods should vary (not all identical) due to jitter
      const uniquePeriods = new Set(periods.map((p) => p.toFixed(4)));
      expect(uniquePeriods.size).toBeGreaterThan(1);
    }
  });

  it("has an output port named 'out'", () => {
    const clk = new ClockSource("clk", { speed: 30 }, DefaultPhysicsConfig, createSeededRng(1));
    expect(clk.outputs.has("out")).toBe(true);
    expect(clk.kind).toBe("sequential");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run vitest run src/workers/physics/components/clock-source.test.ts
```

Expected: FAIL — `ClockSource` not found.

- [ ] **Step 3: Implement ClockSource**

```ts
// src/workers/physics/components/clock-source.ts
import type { SequentialComponent, Port, PhysicsConfig, RngFn } from "@/lib/types";
import { createPort } from "./base";
import { Signal } from "../signal";
import { NoiseGenerator } from "../noise";

export class ClockSource implements SequentialComponent {
  readonly kind = "sequential" as const;
  readonly inputs = new Map<string, Port>();
  readonly outputs: Map<string, Port>;

  private readonly signal: Signal;
  private phase: number = 0;
  private readonly speed: number;
  private readonly jitterRms: number;
  private readonly rng: RngFn;
  private readonly noise: NoiseGenerator;
  private readonly speedFactor: number;

  constructor(
    readonly id: string,
    params: Record<string, unknown>,
    config: PhysicsConfig,
    rng: RngFn,
  ) {
    this.rng = rng;
    this.speed = (params.speed as number) ?? config.simulation.defaultSpeed;
    this.jitterRms = (params.jitterRms as number) ?? 0.02;
    this.speedFactor = config.simulation.clockSpeedFactor;

    const outPort = createPort("out");
    this.outputs = new Map([["out", outPort]]);

    this.noise = new NoiseGenerator(rng, 0);
    this.signal = new Signal(
      {
        baseHigh: config.voltage.outputHighMax,
        baseLow: 0.0,
        zeta: 0.8,
        ringFreq: 80,
        clampMin: config.voltage.clampMin,
        clampMax: config.voltage.systemMax,
      },
      this.noise,
    );
  }

  update(dt: number): void {
    this.signal.update(dt);
    this.outputs.get("out")!.voltage = this.signal.voltage;
  }

  clock(dt: number): void {
    const oldPhase = this.phase;
    this.phase += this.speed * this.speedFactor * dt * 60;
    if (this.phase > Math.PI * 2) this.phase -= Math.PI * 2;

    // Edge detection: check if we crossed a boundary
    const oldHalf = Math.floor(oldPhase / Math.PI);
    const newHalf = Math.floor(this.phase / Math.PI);

    if (oldHalf !== newHalf || (oldPhase < Math.PI && this.phase >= Math.PI)
        || (oldPhase > Math.PI && this.phase < oldPhase)) {
      // Apply jitter
      const jitter = this.gaussianJitter() * this.jitterRms;
      const jitteredPhase = this.phase + jitter;
      this.signal.targetLogic = Math.sin(jitteredPhase) > 0 ? 1 : 0;
    }
  }

  setSpeed(speed: number): void {
    (this as { speed: number }).speed = speed;
  }

  private gaussianJitter(): number {
    // Simple Box-Muller using injected RNG
    const u1 = this.rng();
    const u2 = this.rng();
    return Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
bun run vitest run src/workers/physics/components/clock-source.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/workers/physics/components/clock-source.ts src/workers/physics/components/clock-source.test.ts
git commit -m "feat: add ClockSource component with phase jitter

Sequential component generating periodic clock signal. Gaussian phase
jitter on edges causes variable period lengths. All randomness uses
injected RngFn. Tests verify periodicity, jitter variation, and port structure."
```

---

### Task 9: SignalSource component

**Files:**
- Create: `src/workers/physics/components/signal-source.ts`, `src/workers/physics/components/signal-source.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/workers/physics/components/signal-source.test.ts
import { describe, expect, it } from "vitest";
import { SignalSource } from "./signal-source";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";

describe("SignalSource", () => {
  it("converges to baseHigh when targetLogic is 1", () => {
    const src = new SignalSource(
      "d",
      { baseHigh: 1.5, baseLow: 0.1 },
      DefaultPhysicsConfig,
      createSeededRng(1),
    );
    src.setTargetLogic(1);
    for (let i = 0; i < 5000; i++) {
      src.update(0.0001);
    }
    expect(src.outputs.get("out")!.voltage).toBeCloseTo(1.5, 0);
  });

  it("converges to baseLow when targetLogic is 0", () => {
    const src = new SignalSource(
      "d",
      { baseHigh: 1.5, baseLow: 0.1 },
      DefaultPhysicsConfig,
      createSeededRng(1),
    );
    src.setTargetLogic(0);
    for (let i = 0; i < 5000; i++) {
      src.update(0.0001);
    }
    expect(src.outputs.get("out")!.voltage).toBeCloseTo(0.1, 0);
  });

  it("has output port named 'out'", () => {
    const src = new SignalSource("d", {}, DefaultPhysicsConfig, createSeededRng(1));
    expect(src.outputs.has("out")).toBe(true);
    expect(src.kind).toBe("sequential");
  });
});
```

- [ ] **Step 2: Run test, verify failure, implement, verify pass**

```ts
// src/workers/physics/components/signal-source.ts
import type { SequentialComponent, Port, PhysicsConfig, RngFn } from "@/lib/types";
import { createPort } from "./base";
import { Signal } from "../signal";
import { NoiseGenerator } from "../noise";

export class SignalSource implements SequentialComponent {
  readonly kind = "sequential" as const;
  readonly inputs = new Map<string, Port>();
  readonly outputs: Map<string, Port>;

  private readonly signal: Signal;

  constructor(
    readonly id: string,
    params: Record<string, unknown>,
    config: PhysicsConfig,
    rng: RngFn,
  ) {
    const baseHigh = (params.baseHigh as number) ??
      (config.voltage.logicHighMin + config.voltage.systemMax) / 2;
    const baseLow = (params.baseLow as number) ?? config.voltage.logicLowMax / 2;

    const outPort = createPort("out");
    this.outputs = new Map([["out", outPort]]);

    const noiseLevel = (config.simulation.defaultNoise / 100) * config.simulation.maxNoiseLevel;
    const noise = new NoiseGenerator(rng, noiseLevel);

    this.signal = new Signal(
      {
        baseHigh,
        baseLow,
        zeta: 0.8,
        ringFreq: 80,
        clampMin: config.voltage.clampMin,
        clampMax: config.voltage.systemMax,
      },
      noise,
    );
  }

  update(dt: number): void {
    this.signal.update(dt);
    this.outputs.get("out")!.voltage = this.signal.voltage;
  }

  clock(_dt: number): void {
    // SignalSource has no clock-edge behavior
  }

  setTargetLogic(logic: 0 | 1): void {
    this.signal.targetLogic = logic;
  }

  setNoiseLevel(sigma: number): void {
    // Access the noise generator through signal
    // This requires exposing it — or we can store a reference
  }
}
```

- [ ] **Step 3: Run tests**

```bash
bun run vitest run src/workers/physics/components/signal-source.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/workers/physics/components/signal-source.ts src/workers/physics/components/signal-source.test.ts
git commit -m "feat: add SignalSource component for user-controlled inputs

Sequential component wrapping Signal with RLC response and noise.
Provides setTargetLogic() for toggling input state. DI: receives
PhysicsConfig and RngFn via constructor."
```

---

## Phase 5: DFlipFlop (TDD)

### Task 10: DFlipFlop component

**Files:**
- Create: `src/workers/physics/components/flip-flop.ts`, `src/workers/physics/components/flip-flop.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/workers/physics/components/flip-flop.test.ts
import { describe, expect, it } from "vitest";
import { DFlipFlop } from "./flip-flop";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";

function createDFF(seed: number = 42) {
  return new DFlipFlop("dff0", {}, DefaultPhysicsConfig, createSeededRng(seed));
}

describe("DFlipFlop", () => {
  it("has d, clk input ports and q output port", () => {
    const dff = createDFF();
    expect(dff.inputs.has("d")).toBe(true);
    expect(dff.inputs.has("clk")).toBe(true);
    expect(dff.outputs.has("q")).toBe(true);
    expect(dff.kind).toBe("sequential");
  });

  it("captures D=HIGH on CLK rising edge", () => {
    const dff = createDFF();
    // Set D high
    dff.inputs.get("d")!.voltage = 2.0;
    // CLK low → high (rising edge)
    dff.inputs.get("clk")!.voltage = 0.0;
    dff.clock(0.0001);
    dff.inputs.get("clk")!.voltage = 2.0;
    dff.clock(0.0001);
    // Let Q settle
    for (let i = 0; i < 3000; i++) dff.update(0.0001);
    expect(dff.outputs.get("q")!.voltage).toBeGreaterThan(1.0);
  });

  it("captures D=LOW on CLK rising edge", () => {
    const dff = createDFF();
    dff.inputs.get("d")!.voltage = 0.0;
    dff.inputs.get("clk")!.voltage = 0.0;
    dff.clock(0.0001);
    dff.inputs.get("clk")!.voltage = 2.0;
    dff.clock(0.0001);
    for (let i = 0; i < 3000; i++) dff.update(0.0001);
    expect(dff.outputs.get("q")!.voltage).toBeLessThan(0.6);
  });

  it("ignores D changes on CLK falling edge", () => {
    const dff = createDFF();
    // First: capture D=LOW on rising edge
    dff.inputs.get("d")!.voltage = 0.0;
    dff.inputs.get("clk")!.voltage = 0.0;
    dff.clock(0.0001);
    dff.inputs.get("clk")!.voltage = 2.0;
    dff.clock(0.0001);
    for (let i = 0; i < 3000; i++) dff.update(0.0001);

    // Now: D goes HIGH, CLK falls — should NOT capture
    dff.inputs.get("d")!.voltage = 2.0;
    dff.inputs.get("clk")!.voltage = 0.0;
    dff.clock(0.0001);
    for (let i = 0; i < 3000; i++) dff.update(0.0001);
    expect(dff.outputs.get("q")!.voltage).toBeLessThan(0.6);
  });

  it("Schmitt trigger: holds state in hysteresis band", () => {
    const dff = createDFF();
    // CLK at 0.8V — inside hysteresis band (0.6-1.0V)
    dff.inputs.get("d")!.voltage = 2.0;
    dff.inputs.get("clk")!.voltage = 0.0;
    dff.clock(0.0001); // establish low state
    dff.inputs.get("clk")!.voltage = 0.8; // inside band
    dff.clock(0.0001);
    // Should NOT trigger — stays in previous state
    for (let i = 0; i < 3000; i++) dff.update(0.0001);
    // Q should still be low (no edge detected)
    expect(dff.outputs.get("q")!.voltage).toBeLessThan(1.0);
  });

  it("metastability: D in undefined zone produces ~50/50 output over many trials", () => {
    let highCount = 0;
    const trials = 200;

    for (let seed = 0; seed < trials; seed++) {
      const dff = createDFF(seed);
      // D at 0.8V — in undefined zone
      dff.inputs.get("d")!.voltage = 0.8;
      dff.inputs.get("clk")!.voltage = 0.0;
      dff.clock(0.0001);
      dff.inputs.get("clk")!.voltage = 2.0;
      dff.clock(0.0001);
      // Let resolve
      for (let i = 0; i < 10000; i++) dff.update(0.0001);
      if (dff.outputs.get("q")!.voltage > 1.0) highCount++;
    }

    const ratio = highCount / trials;
    // Should be roughly 50/50 (allow 30-70% range)
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(0.7);
  });

  it("async reset drives Q low", () => {
    const dff = createDFF();
    // First capture D=HIGH
    dff.inputs.get("d")!.voltage = 2.0;
    dff.inputs.get("clk")!.voltage = 0.0;
    dff.clock(0.0001);
    dff.inputs.get("clk")!.voltage = 2.0;
    dff.clock(0.0001);
    for (let i = 0; i < 3000; i++) dff.update(0.0001);
    expect(dff.outputs.get("q")!.voltage).toBeGreaterThan(1.0);

    // Reset
    dff.setReset(true);
    for (let i = 0; i < 3000; i++) {
      dff.clock(0.0001);
      dff.update(0.0001);
    }
    expect(dff.outputs.get("q")!.voltage).toBeLessThan(0.6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run vitest run src/workers/physics/components/flip-flop.test.ts
```

Expected: FAIL — `DFlipFlop` not found.

- [ ] **Step 3: Implement DFlipFlop**

```ts
// src/workers/physics/components/flip-flop.ts
import type { SequentialComponent, Port, PhysicsConfig, RngFn } from "@/lib/types";
import { createPort } from "./base";
import { Signal } from "../signal";
import { NoiseGenerator } from "../noise";

export class DFlipFlop implements SequentialComponent {
  readonly kind = "sequential" as const;
  readonly inputs: Map<string, Port>;
  readonly outputs: Map<string, Port>;

  private readonly qSignal: Signal;
  private readonly config: PhysicsConfig;
  private readonly rng: RngFn;

  private lastClkLogic: 0 | 1 = 0;
  private resetActive: boolean = false;

  // Metastability state
  private metastable: boolean = false;
  private metaTimer: number = 0;
  private metaResolveTime: number = 0;

  // Propagation delay
  private pendingQ: 0 | 1 | null = null;
  private pendingTimer: number = 0;

  constructor(
    readonly id: string,
    _params: Record<string, unknown>,
    config: PhysicsConfig,
    rng: RngFn,
  ) {
    this.config = config;
    this.rng = rng;

    const dPort = createPort("d");
    const clkPort = createPort("clk");
    const qPort = createPort("q");

    this.inputs = new Map([
      ["d", dPort],
      ["clk", clkPort],
    ]);
    this.outputs = new Map([["q", qPort]]);

    const noiseLevel =
      ((config.simulation.defaultNoise / 100) * config.simulation.maxNoiseLevel) *
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
    // Handle pending propagation delay
    if (this.pendingQ !== null) {
      this.pendingTimer -= dt;
      if (this.pendingTimer <= 0) {
        this.qSignal.targetLogic = this.pendingQ;
        this.pendingQ = null;
      }
    }

    // Handle metastability resolution
    if (this.metastable) {
      this.metaTimer += dt;
      if (this.metaTimer >= this.metaResolveTime) {
        // Resolve: random collapse
        this.metastable = false;
        this.qSignal.targetLogic = this.rng() > 0.5 ? 1 : 0;
        // Restore normal damping would require config change — simplified here
      }
    }

    this.qSignal.update(dt);
    this.outputs.get("q")!.voltage = this.qSignal.voltage;
  }

  clock(dt: number): void {
    if (this.resetActive) {
      this.qSignal.targetLogic = 0;
      this.metastable = false;
      this.pendingQ = null;
      return;
    }

    const clkVoltage = this.inputs.get("clk")!.voltage;
    const { logicHighMin, logicLowMax } = this.config.voltage;

    // Schmitt trigger
    let clkLogic: 0 | 1;
    if (clkVoltage > logicHighMin) {
      clkLogic = 1;
    } else if (clkVoltage < logicLowMax) {
      clkLogic = 0;
    } else {
      clkLogic = this.lastClkLogic;
    }

    // Rising edge detection
    const isRisingEdge = this.lastClkLogic === 0 && clkLogic === 1;
    this.lastClkLogic = clkLogic;

    if (!isRisingEdge) return;

    const dVoltage = this.inputs.get("d")!.voltage;

    if (dVoltage > logicHighMin) {
      this.scheduleQ(1);
    } else if (dVoltage < logicLowMax) {
      this.scheduleQ(0);
    } else {
      // Undefined zone → metastability
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
    // Sample resolution time from exponential distribution
    const u = this.rng();
    this.metaResolveTime = -this.config.timing.tauMeta * Math.log(u || 1e-10);
    // Drive toward mid-rail
    this.qSignal.snapTo(this.config.voltage.systemMax / 2);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
bun run vitest run src/workers/physics/components/flip-flop.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Run all tests to check for regressions**

```bash
bun run test
```

Expected: All tests across all files PASS.

- [ ] **Step 6: Commit**

```bash
git add src/workers/physics/components/flip-flop.ts src/workers/physics/components/flip-flop.test.ts
git commit -m "feat: add DFlipFlop with Schmitt trigger, metastability, and t_CQ

Full flip-flop implementation: rising edge detection with hysteresis,
propagation delay (t_CQ), metastability with exponential resolution time,
async reset. All randomness via injected RngFn. Tests cover edge capture,
hysteresis band, 50/50 metastability distribution, and reset behavior."
```

---

<!-- Tasks 11+ continue in next section: CircuitGraph, Engine, WaveformBuffer, Workers, WebGPU, Stores, React UI, i18n, CI/CD -->
