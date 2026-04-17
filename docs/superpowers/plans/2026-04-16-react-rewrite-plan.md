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
    "react": "^19.2.5",
    "react-dom": "^19.2.5",
    "jotai": "^2.19.1",
    "comlink": "^4.4.2",
    "lucide-react": "^1.8.0",
    "zod": "^4.3.6",
    "@lingui/core": "^5.9.5",
    "@lingui/react": "^5.9.5",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-slider": "^1.3.6",
    "@radix-ui/react-switch": "^1.2.6",
    "@radix-ui/react-toggle-group": "^1.1.11",
    "@radix-ui/react-slot": "^1.2.4",
    "tailwind-merge": "^3.5.0",
    "class-variance-authority": "^0.7.1",
    "@catppuccin/palette": "^1.8.0"
  },
  "devDependencies": {
    "typescript": "^6.0.2",
    "vite": "^8.0.8",
    "@vitejs/plugin-react": "^6.0.1",
    "@biomejs/biome": "^2.4.12",
    "vitest": "^4.1.4",
    "@testing-library/react": "^16.3.2",
    "@testing-library/jest-dom": "^6.9.1",
    "happy-dom": "^20.9.0",
    "@lingui/cli": "^5.9.5",
    "@lingui/macro": "^5.9.5",
    "@lingui/vite-plugin": "^5.9.5",
    "tailwindcss": "^4.2.2",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@types/bun": "^1.3.12"
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

- [ ] **Step 9: Create src/styles/theme.ts — programmatic Catppuccin colors**

Use `@catppuccin/palette` instead of hardcoding hex values. This generates CSS custom properties from the package:

```ts
// src/styles/theme.ts
import { flavors } from "@catppuccin/palette";

const macchiato = flavors.macchiato;

/** Export all Catppuccin Macchiato colors for use in JS (WebGPU uniforms, etc.) */
export const theme = {
  base: macchiato.colors.base.hex,
  mantle: macchiato.colors.mantle.hex,
  crust: macchiato.colors.crust.hex,
  surface0: macchiato.colors.surface0.hex,
  surface1: macchiato.colors.surface1.hex,
  surface2: macchiato.colors.surface2.hex,
  text: macchiato.colors.text.hex,
  subtext0: macchiato.colors.subtext0.hex,
  subtext1: macchiato.colors.subtext1.hex,
  overlay0: macchiato.colors.overlay0.hex,
  overlay1: macchiato.colors.overlay1.hex,
  green: macchiato.colors.green.hex,
  blue: macchiato.colors.blue.hex,
  red: macchiato.colors.red.hex,
  yellow: macchiato.colors.yellow.hex,
  mauve: macchiato.colors.mauve.hex,
  teal: macchiato.colors.teal.hex,
  lavender: macchiato.colors.lavender.hex,
  peach: macchiato.colors.peach.hex,
  sky: macchiato.colors.sky.hex,
  pink: macchiato.colors.pink.hex,
  flamingo: macchiato.colors.flamingo.hex,
  rosewater: macchiato.colors.rosewater.hex,
  maroon: macchiato.colors.maroon.hex,
  sapphire: macchiato.colors.sapphire.hex,
} as const;

/** Generate CSS custom properties string for injection into globals.css */
export function toCssVars(): string {
  return Object.entries(theme)
    .map(([name, hex]) => `  --color-${name}: ${hex};`)
    .join("\n");
}
```

- [ ] **Step 10a: Create src/styles/globals.css**

```css
@import "tailwindcss";

/* Catppuccin Macchiato — sourced from @catppuccin/palette (see theme.ts) */
@theme {
  --color-base: #24273a;
  --color-mantle: #1e2030;
  --color-crust: #181926;
  --color-surface0: #363a4f;
  --color-surface1: #494d64;
  --color-surface2: #5b6078;
  --color-text: #cad3f5;
  --color-subtext0: #a5adcb;
  --color-subtext1: #b8c0e0;
  --color-overlay0: #6e738d;
  --color-overlay1: #8087a2;
  --color-green: #a6da95;
  --color-blue: #8aadf4;
  --color-red: #ed8796;
  --color-yellow: #eed49f;
  --color-mauve: #c6a0f6;
  --color-teal: #7dc4e4;
  --color-lavender: #b7bdf8;
  --color-peach: #f5a97f;
  --color-sky: #91d7e3;
  --color-pink: #f5bde6;
  --color-flamingo: #f0c6c6;
  --color-rosewater: #f4dbd6;
  --color-maroon: #ee99a0;
  --color-sapphire: #7dc4e4;
}

body {
  background-color: var(--color-base);
  color: var(--color-text);
  font-family: "Segoe UI", system-ui, sans-serif;
}
```

Note: The CSS `@theme` block mirrors the `@catppuccin/palette` values so Tailwind can resolve them at build time. The `theme.ts` module is used in JS contexts (WebGPU color uniforms, probe color lookups) where CSS vars aren't accessible.

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
  LayoutConfig,
  PhysicsConfig,
  SimulationConfig,
  TimingConfig,
  VoltageSpecConfig,
} from "./types";

// Colors are sourced from @catppuccin/palette via src/styles/theme.ts
// No hardcoded hex values in constants — see theme.ts for color access

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

  it("setTargetLogic coerces booleans", () => {
    const src = new SignalSource("d", { baseHigh: 1.5, baseLow: 0.1 }, DefaultPhysicsConfig, createSeededRng(1));
    src.setTargetLogic(true);
    for (let i = 0; i < 5000; i++) src.update(0.0001);
    expect(src.outputs.get("out")!.voltage).toBeCloseTo(1.5, 0);
    src.setTargetLogic(false);
    for (let i = 0; i < 5000; i++) src.update(0.0001);
    expect(src.outputs.get("out")!.voltage).toBeCloseTo(0.1, 0);
  });

  it("setNoise adjusts noise amplitude", () => {
    const src = new SignalSource("d", {}, DefaultPhysicsConfig, createSeededRng(1));
    src.setNoise(0);
    const samples: number[] = [];
    for (let i = 0; i < 1000; i++) {
      src.update(0.0001);
      samples.push(src.outputs.get("out")!.voltage);
    }
    // With zero noise, late samples should have low variance
    const late = samples.slice(-100);
    const mean = late.reduce((a, b) => a + b, 0) / late.length;
    const variance = late.reduce((a, b) => a + (b - mean) ** 2, 0) / late.length;
    expect(variance).toBeLessThan(0.01);
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
  private readonly noise: NoiseGenerator;
  private readonly maxNoiseLevel: number;

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

    this.maxNoiseLevel = config.simulation.maxNoiseLevel;
    const noiseLevel = (config.simulation.defaultNoise / 100) * this.maxNoiseLevel;
    this.noise = new NoiseGenerator(rng, noiseLevel);

    this.signal = new Signal(
      {
        baseHigh,
        baseLow,
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

  clock(_dt: number): void {
    // SignalSource has no clock-edge behavior
  }

  /** Accepts `0 | 1 | boolean` — booleans coerced (true → 1, false → 0) */
  setTargetLogic(logic: 0 | 1 | boolean): void {
    this.signal.targetLogic = logic ? 1 : 0;
  }

  /** Set noise sigma by percent (0-100) */
  setNoise(percent: number): void {
    const sigma = (percent / 100) * this.maxNoiseLevel;
    this.noise.setSigma(sigma);
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

## Phase 6: Circuit Graph, Engine, Buffer

### Task 11: WaveformBuffer (N-channel ring buffer)

**Files:**
- Create: `src/workers/physics/waveform-buffer.ts`, `src/workers/physics/waveform-buffer.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/workers/physics/waveform-buffer.test.ts
import { describe, expect, it } from "vitest";
import { WaveformBuffer } from "./waveform-buffer";

describe("WaveformBuffer", () => {
  it("initializes with N channels of given length", () => {
    const buf = new WaveformBuffer(3, 2048);
    expect(buf.channelCount).toBe(3);
    expect(buf.length).toBe(2048);
    expect(buf.writePointer).toBe(0);
  });

  it("throws if length is not power of 2", () => {
    expect(() => new WaveformBuffer(3, 1000)).toThrow();
  });

  it("push advances write pointer with bitwise wrap", () => {
    const buf = new WaveformBuffer(2, 4); // 4 = power of 2
    buf.push([1.0, 2.0]);
    buf.push([3.0, 4.0]);
    expect(buf.writePointer).toBe(2);
    // 4 more pushes wraps around
    buf.push([5.0, 6.0]);
    buf.push([7.0, 8.0]);
    expect(buf.writePointer).toBe(0);
  });

  it("stores values in per-channel arrays", () => {
    const buf = new WaveformBuffer(2, 4);
    buf.push([1.0, 10.0]);
    buf.push([2.0, 20.0]);
    expect(buf.getChannel(0)[0]).toBe(1.0);
    expect(buf.getChannel(0)[1]).toBe(2.0);
    expect(buf.getChannel(1)[0]).toBe(10.0);
    expect(buf.getChannel(1)[1]).toBe(20.0);
  });

  it("reset clears all channels and pointer", () => {
    const buf = new WaveformBuffer(2, 4);
    buf.push([1.0, 2.0]);
    buf.reset();
    expect(buf.writePointer).toBe(0);
    expect(buf.getChannel(0)[0]).toBe(0);
  });

  it("throws if push values length doesn't match channelCount", () => {
    const buf = new WaveformBuffer(2, 4);
    expect(() => buf.push([1.0])).toThrow();
    expect(() => buf.push([1.0, 2.0, 3.0])).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run vitest run src/workers/physics/waveform-buffer.test.ts
```

Expected: FAIL — `WaveformBuffer` not found.

- [ ] **Step 3: Implement WaveformBuffer**

```ts
// src/workers/physics/waveform-buffer.ts
function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * N-channel ring buffer backed by Float32Arrays.
 * Length must be a power of 2 for O(1) bitwise wraparound.
 */
export class WaveformBuffer {
  readonly channelCount: number;
  readonly length: number;

  private readonly channels: Float32Array[];
  private readonly mask: number;
  private _writePointer: number = 0;

  constructor(channelCount: number, length: number) {
    if (!isPowerOfTwo(length)) {
      throw new Error(`WaveformBuffer length must be power of 2, got ${length}`);
    }
    this.channelCount = channelCount;
    this.length = length;
    this.mask = length - 1;
    this.channels = Array.from({ length: channelCount }, () => new Float32Array(length));
  }

  get writePointer(): number {
    return this._writePointer;
  }

  push(values: readonly number[]): void {
    if (values.length !== this.channelCount) {
      throw new Error(
        `Expected ${this.channelCount} values, got ${values.length}`,
      );
    }
    const ptr = this._writePointer;
    for (let i = 0; i < this.channelCount; i++) {
      this.channels[i]![ptr] = values[i]!;
    }
    this._writePointer = (ptr + 1) & this.mask;
  }

  getChannel(index: number): Float32Array {
    const ch = this.channels[index];
    if (!ch) throw new Error(`Channel ${index} out of range`);
    return ch;
  }

  reset(fillValue: number = 0): void {
    for (const ch of this.channels) ch.fill(fillValue);
    this._writePointer = 0;
  }

  /** Export all channels as a single interleaved Float32Array for GPU upload */
  toInterleavedBuffer(): Float32Array {
    const buf = new Float32Array(this.channelCount * this.length);
    for (let c = 0; c < this.channelCount; c++) {
      buf.set(this.channels[c]!, c * this.length);
    }
    return buf;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
bun run vitest run src/workers/physics/waveform-buffer.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/workers/physics/waveform-buffer.ts src/workers/physics/waveform-buffer.test.ts
git commit -m "feat: add N-channel WaveformBuffer with O(1) bitwise wraparound

Ring buffer backed by Float32Arrays, one per channel. N determined
by constructor arg. toInterleavedBuffer() produces GPU-ready layout."
```

---

### Task 12: CircuitGraph and SimulationEngine

**Files:**
- Create: `src/workers/physics/graph.ts`, `src/workers/physics/engine.ts`, `src/workers/physics/graph.test.ts`

- [ ] **Step 1: Write failing tests for CircuitGraph**

```ts
// src/workers/physics/graph.test.ts
import { describe, expect, it } from "vitest";
import { CircuitGraph } from "./graph";
import { ComponentRegistry } from "./components/registry";
import { DFlipFlop } from "./components/flip-flop";
import { ClockSource } from "./components/clock-source";
import { SignalSource } from "./components/signal-source";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { CircuitDefinition } from "@/lib/types";

const testRegistry = new ComponentRegistry();
testRegistry.register("ClockSource", (id, p, d) => new ClockSource(id, p, d.config, d.rng));
testRegistry.register("SignalSource", (id, p, d) => new SignalSource(id, p, d.config, d.rng));
testRegistry.register("DFlipFlop", (id, p, d) => new DFlipFlop(id, p, d.config, d.rng));

const dffDef: CircuitDefinition = {
  id: "test-dff",
  name: "Test DFF",
  description: "test",
  components: [
    { type: "ClockSource", id: "clk", params: {} },
    { type: "SignalSource", id: "d", params: {} },
    { type: "DFlipFlop", id: "dff0", params: {} },
  ],
  nets: [
    { id: "clk_net", driver: { componentId: "clk", port: "out" },
      loads: [{ componentId: "dff0", port: "clk" }] },
    { id: "d_net", driver: { componentId: "d", port: "out" },
      loads: [{ componentId: "dff0", port: "d" }] },
    { id: "q_net", driver: { componentId: "dff0", port: "q" }, loads: [] },
  ],
  probes: [
    { netId: "clk_net", label: "CLK", color: "#0f0", channelIndex: 0 },
    { netId: "d_net", label: "D", color: "#00f", channelIndex: 1 },
    { netId: "q_net", label: "Q", color: "#f00", channelIndex: 2 },
  ],
  controls: [],
};

describe("CircuitGraph", () => {
  it("instantiates all components from definition", () => {
    const graph = new CircuitGraph(dffDef, testRegistry, DefaultPhysicsConfig, createSeededRng(1));
    expect(graph.getComponent("clk")).toBeDefined();
    expect(graph.getComponent("d")).toBeDefined();
    expect(graph.getComponent("dff0")).toBeDefined();
  });

  it("creates nets with driver and loads", () => {
    const graph = new CircuitGraph(dffDef, testRegistry, DefaultPhysicsConfig, createSeededRng(1));
    const clkNet = graph.getNet("clk_net");
    expect(clkNet.loadPorts.length).toBe(1);
  });

  it("propagates driver voltage to loads", () => {
    const graph = new CircuitGraph(dffDef, testRegistry, DefaultPhysicsConfig, createSeededRng(1));
    const clkOut = graph.getComponent("clk").outputs.get("out")!;
    clkOut.voltage = 2.0;
    graph.propagate();
    const dffClk = graph.getComponent("dff0").inputs.get("clk")!;
    expect(dffClk.voltage).toBe(2.0);
  });

  it("throws on unknown net driver component", () => {
    const badDef: CircuitDefinition = {
      ...dffDef,
      nets: [{ id: "bad", driver: { componentId: "ghost", port: "out" }, loads: [] }],
    };
    expect(() =>
      new CircuitGraph(badDef, testRegistry, DefaultPhysicsConfig, createSeededRng(1)),
    ).toThrow("Unknown component");
  });

  it("collects probed net voltages", () => {
    const graph = new CircuitGraph(dffDef, testRegistry, DefaultPhysicsConfig, createSeededRng(1));
    graph.getComponent("clk").outputs.get("out")!.voltage = 1.5;
    graph.getComponent("d").outputs.get("out")!.voltage = 0.3;
    graph.propagate();
    const voltages = graph.collectProbeVoltages(dffDef.probes);
    expect(voltages[0]).toBe(1.5); // CLK channel 0
    expect(voltages[1]).toBe(0.3); // D channel 1
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run vitest run src/workers/physics/graph.test.ts
```

Expected: FAIL — `CircuitGraph` not found.

- [ ] **Step 3: Implement CircuitGraph**

```ts
// src/workers/physics/graph.ts
import type {
  CircuitDefinition,
  Component,
  Net,
  PhysicsConfig,
  Port,
  Probe,
  RngFn,
  SequentialComponent,
  CombinationalComponent,
} from "@/lib/types";
import type { ComponentRegistry } from "./components/registry";
import { isCombinational, isSequential } from "./components/base";

export class CircuitGraph {
  private readonly components = new Map<string, Component>();
  private readonly nets = new Map<string, Net>();
  private readonly sequentialList: SequentialComponent[] = [];
  private readonly combinationalOrder: CombinationalComponent[] = [];

  constructor(
    definition: CircuitDefinition,
    registry: ComponentRegistry,
    config: PhysicsConfig,
    rng: RngFn,
  ) {
    // 1. Instantiate components
    for (const def of definition.components) {
      const comp = registry.create(def.type, def.id, def.params, { config, rng });
      this.components.set(def.id, comp);
      if (isSequential(comp)) this.sequentialList.push(comp);
    }

    // 2. Build nets
    for (const netDef of definition.nets) {
      const driverComp = this.components.get(netDef.driver.componentId);
      if (!driverComp) {
        throw new Error(`Unknown component: ${netDef.driver.componentId}`);
      }
      const driverPort = driverComp.outputs.get(netDef.driver.port);
      if (!driverPort) {
        throw new Error(
          `Unknown output port: ${netDef.driver.componentId}.${netDef.driver.port}`,
        );
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
      this.nets.set(netDef.id, {
        id: netDef.id,
        driverPort,
        loadPorts,
        voltage: 0,
      });
    }

    // 3. Levelize combinational components (topological sort)
    this.combinationalOrder.push(...this.levelize());
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

  getAllComponents(): Iterable<Component> {
    return this.components.values();
  }

  /** Propagate all driver voltages to their load ports via nets */
  propagate(): void {
    for (const net of this.nets.values()) {
      net.voltage = net.driverPort.voltage;
      for (const load of net.loadPorts) {
        load.voltage = net.voltage;
      }
    }
  }

  /** Evaluate combinational components in level order */
  evaluateCombinational(): void {
    for (const comp of this.combinationalOrder) {
      comp.evaluate();
    }
  }

  /** Collect voltages at probed nets, in channelIndex order */
  collectProbeVoltages(probes: readonly Probe[]): number[] {
    const out: number[] = new Array(probes.length).fill(0);
    for (const probe of probes) {
      const net = this.nets.get(probe.netId);
      if (net) out[probe.channelIndex] = net.voltage;
    }
    return out;
  }

  /** Topological sort of combinational components */
  private levelize(): CombinationalComponent[] {
    const combinational: CombinationalComponent[] = [];
    for (const comp of this.components.values()) {
      if (isCombinational(comp)) combinational.push(comp);
    }
    if (combinational.length === 0) return [];

    // Simple BFS-based levelization: a gate can evaluate once all its input drivers are resolved.
    // Sequential outputs = level 0 (pseudo-primary inputs).
    const levelOf = new Map<string, number>();
    for (const seq of this.sequentialList) levelOf.set(seq.id, 0);

    const unresolved = new Set(combinational);
    let iteration = 0;
    const maxIterations = combinational.length + 1;

    while (unresolved.size > 0) {
      if (iteration++ > maxIterations) {
        throw new Error("Combinational feedback loop detected");
      }
      for (const comp of Array.from(unresolved)) {
        let maxInputLevel = -1;
        let allResolved = true;
        for (const port of comp.inputs.values()) {
          const driverId = this.findDriverOf(port);
          if (driverId === null) {
            maxInputLevel = Math.max(maxInputLevel, 0);
            continue;
          }
          const lvl = levelOf.get(driverId);
          if (lvl === undefined) {
            allResolved = false;
            break;
          }
          maxInputLevel = Math.max(maxInputLevel, lvl);
        }
        if (allResolved) {
          levelOf.set(comp.id, maxInputLevel + 1);
          unresolved.delete(comp);
        }
      }
    }

    return combinational.sort((a, b) => (levelOf.get(a.id) ?? 0) - (levelOf.get(b.id) ?? 0));
  }

  private findDriverOf(port: Port): string | null {
    for (const [, comp] of this.components) {
      for (const outPort of comp.outputs.values()) {
        if (outPort === port) return comp.id;
      }
    }
    // Walk nets: find net whose loadPorts include this port
    for (const net of this.nets.values()) {
      if (net.loadPorts.includes(port)) {
        for (const [compId, comp] of this.components) {
          for (const outPort of comp.outputs.values()) {
            if (outPort === net.driverPort) return compId;
          }
        }
      }
    }
    return null;
  }
}
```

- [ ] **Step 4: Run graph tests**

```bash
bun run vitest run src/workers/physics/graph.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Implement SimulationEngine**

```ts
// src/workers/physics/engine.ts
import type { CircuitDefinition, PhysicsConfig, RngFn, SequentialComponent } from "@/lib/types";
import { CircuitGraph } from "./graph";
import { WaveformBuffer } from "./waveform-buffer";
import type { ComponentRegistry } from "./components/registry";

/**
 * Orchestrates the circuit simulation:
 * - Owns CircuitGraph, WaveformBuffer
 * - Runs fixed-timestep sub-stepping at 10kHz via accumulator
 * - Exposes tick(realDt) for external scheduling
 */
export class SimulationEngine {
  private readonly graph: CircuitGraph;
  private readonly buffer: WaveformBuffer;
  private readonly probes: CircuitDefinition["probes"];
  private readonly sequentialList: readonly SequentialComponent[];
  private readonly dt: number;
  private accumulator: number = 0;

  constructor(
    definition: CircuitDefinition,
    registry: ComponentRegistry,
    private readonly config: PhysicsConfig,
    rng: RngFn,
  ) {
    this.graph = new CircuitGraph(definition, registry, config, rng);
    this.probes = definition.probes;
    this.buffer = new WaveformBuffer(definition.probes.length, config.simulation.bufferLength);
    this.sequentialList = this.graph.getSequential();
    this.dt = config.simulation.physicsDt;
  }

  /** Advance simulation by realDt seconds. Runs multiple fixed sub-steps. */
  tick(realDt: number): void {
    this.accumulator += Math.min(realDt, 0.1); // Clamp to prevent spiral-of-death
    while (this.accumulator >= this.dt) {
      this.stepPhysics(this.dt);
      this.accumulator -= this.dt;
    }
  }

  getBuffer(): WaveformBuffer {
    return this.buffer;
  }

  getComponent(id: string) {
    return this.graph.getComponent(id);
  }

  getAllComponents(): Iterable<import("@/lib/types").Component> {
    return this.graph.getAllComponents();
  }

  getProbeVoltages(): number[] {
    return this.graph.collectProbeVoltages(this.probes);
  }

  private stepPhysics(dt: number): void {
    // 1. Sequential: update signal physics (RLC, noise)
    for (const seq of this.sequentialList) seq.update(dt);

    // 2. Propagate driver voltages to load ports
    this.graph.propagate();

    // 3. Sequential: clock edge detection, setup/hold, capture
    for (const seq of this.sequentialList) seq.clock(dt);

    // 4. Re-propagate (sequential outputs may have changed)
    this.graph.propagate();

    // 5. Combinational: evaluate in level order
    this.graph.evaluateCombinational();

    // 6. Final propagate for combinational outputs
    this.graph.propagate();

    // 7. Sample probes and push to buffer
    this.buffer.push(this.graph.collectProbeVoltages(this.probes));
  }
}
```

- [ ] **Step 6: Run all tests to check for regressions**

```bash
bun run test
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/workers/physics/graph.ts src/workers/physics/graph.test.ts src/workers/physics/engine.ts
git commit -m "feat: add CircuitGraph with levelization and SimulationEngine

CircuitGraph instantiates components/nets from definition, topologically
sorts combinational logic, detects feedback loops, collects probe voltages.
SimulationEngine owns graph + buffer, runs fixed-timestep sub-stepping via
accumulator pattern."
```

---

## Phase 7: Physics Worker + Comlink

### Task 13: Physics Worker entry

**Files:**
- Create: `src/workers/physics/physics.worker.ts`, `src/workers/physics/components/default-registry.ts`

- [ ] **Step 1: Create default registry**

```ts
// src/workers/physics/components/default-registry.ts
import { ComponentRegistry } from "./registry";
import { ClockSource } from "./clock-source";
import { SignalSource } from "./signal-source";
import { DFlipFlop } from "./flip-flop";

export function createDefaultRegistry(): ComponentRegistry {
  const r = new ComponentRegistry();
  r.register("ClockSource", (id, p, d) => new ClockSource(id, p, d.config, d.rng));
  r.register("SignalSource", (id, p, d) => new SignalSource(id, p, d.config, d.rng));
  r.register("DFlipFlop", (id, p, d) => new DFlipFlop(id, p, d.config, d.rng));
  return r;
}
```

- [ ] **Step 2: Create Physics Worker entry**

```ts
// src/workers/physics/physics.worker.ts
import * as Comlink from "comlink";
import type { CircuitDefinition, PhysicsConfig, VoltageSpecConfig } from "@/lib/types";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { SimulationEngine } from "./engine";
import { createDefaultRegistry } from "./components/default-registry";

const TICK_INTERVAL_MS = 8; // ~120Hz

export interface PhysicsAPI {
  loadCircuit(definition: CircuitDefinition): void;
  setParam(componentId: string, key: string, value: number | boolean): void;
  setSettings(specs: Partial<VoltageSpecConfig>): void;
  registerRenderPort(port: MessagePort): void;
  registerStatusCallback(cb: (voltages: number[]) => void): void;
  start(): void;
  stop(): void;
}

class PhysicsWorker implements PhysicsAPI {
  private engine: SimulationEngine | null = null;
  private config: PhysicsConfig = DefaultPhysicsConfig;
  private registry = createDefaultRegistry();
  private tickHandle: ReturnType<typeof setTimeout> | null = null;
  private renderPort: MessagePort | null = null;
  private statusCallback: ((v: number[]) => void) | null = null;
  private lastStatusTime: number = 0;
  private lastTickTime: number = 0;

  loadCircuit(definition: CircuitDefinition): void {
    this.engine = new SimulationEngine(definition, this.registry, this.config, Math.random);
  }

  setParam(componentId: string, key: string, value: number | boolean): void {
    if (!this.engine) return;

    // Global params (e.g., "global.noise") broadcast to all components that accept them
    if (componentId === "global") {
      const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
      for (const comp of this.engine.getAllComponents()) {
        const setter = (comp as unknown as Record<string, unknown>)[setterName];
        if (typeof setter === "function") {
          (setter as (v: number | boolean) => void).call(comp, value);
        }
      }
      return;
    }

    const comp = this.engine.getComponent(componentId);
    const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    const setter = (comp as unknown as Record<string, unknown>)[setterName];
    if (typeof setter === "function") {
      (setter as (v: number | boolean) => void).call(comp, value);
    }
  }

  setSettings(specs: Partial<VoltageSpecConfig>): void {
    this.config = {
      ...this.config,
      voltage: { ...this.config.voltage, ...specs },
    };
    // Settings change requires circuit reload in the current implementation
  }

  registerRenderPort(port: MessagePort): void {
    this.renderPort = port;
  }

  registerStatusCallback(cb: (voltages: number[]) => void): void {
    this.statusCallback = cb;
  }

  start(): void {
    if (this.tickHandle !== null) return;
    this.lastTickTime = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = (now - this.lastTickTime) / 1000;
      this.lastTickTime = now;
      this.tick(dt);
      this.tickHandle = setTimeout(loop, TICK_INTERVAL_MS);
    };
    loop();
  }

  stop(): void {
    if (this.tickHandle !== null) {
      clearTimeout(this.tickHandle);
      this.tickHandle = null;
    }
  }

  private tick(dt: number): void {
    if (!this.engine) return;
    this.engine.tick(dt);

    // Send frame data to Render Worker (~120Hz)
    if (this.renderPort) {
      const buf = this.engine.getBuffer();
      const payload = buf.toInterleavedBuffer();
      this.renderPort.postMessage(
        {
          type: "frame",
          data: payload,
          writePointer: buf.writePointer,
          channelCount: buf.channelCount,
          length: buf.length,
        },
        [payload.buffer],
      );
    }

    // Send voltage status to main thread (~20Hz)
    const now = performance.now();
    if (now - this.lastStatusTime >= 50 && this.statusCallback) {
      this.statusCallback(this.engine.getProbeVoltages());
      this.lastStatusTime = now;
    }
  }
}

const api = new PhysicsWorker();
Comlink.expose(api);
```

- [ ] **Step 3: Verify typecheck**

```bash
bun run typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/workers/physics/physics.worker.ts src/workers/physics/components/default-registry.ts
git commit -m "feat: add Physics Worker with Comlink API

Worker entry exposes loadCircuit, setParam, setSettings, start/stop
via Comlink. Tick loop uses setTimeout at ~120Hz with delta-time
accumulator. Sends frame data to Render Worker via MessageChannel,
voltage status to main thread at ~20Hz."
```

---

## Phase 8: WebGPU Rendering

### Task 14: WebGPU device setup

**Files:**
- Create: `src/workers/render/gpu-device.ts`

- [ ] **Step 1: Implement GPU device setup**

```ts
// src/workers/render/gpu-device.ts
export interface GPUDeviceBundle {
  device: GPUDevice;
  adapter: GPUAdapter;
  format: GPUTextureFormat;
}

export async function createGPUDevice(): Promise<GPUDeviceBundle> {
  if (!("gpu" in navigator)) {
    throw new Error("WebGPU not available");
  }
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) throw new Error("No GPU adapter found");
  const device = await adapter.requestDevice();
  const format = navigator.gpu.getPreferredCanvasFormat();
  return { device, adapter, format };
}

export function configureCanvas(
  canvas: OffscreenCanvas,
  device: GPUDevice,
  format: GPUTextureFormat,
): GPUCanvasContext {
  const ctx = canvas.getContext("webgpu");
  if (!ctx) throw new Error("Failed to get webgpu context");
  ctx.configure({
    device,
    format,
    alphaMode: "premultiplied",
  });
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/workers/render/gpu-device.ts
git commit -m "feat: add WebGPU device setup utility"
```

---

### Task 15: WGSL shaders

**Files:**
- Create: `src/workers/render/shaders/waveform.vert.wgsl`, `src/workers/render/shaders/waveform-clean.frag.wgsl`, `src/workers/render/shaders/waveform-glow.frag.wgsl`, `src/workers/render/shaders/waveform-phosphor.frag.wgsl`, `src/workers/render/shaders/digital.wgsl`, `src/workers/render/shaders/index.ts`

- [ ] **Step 1: Create shared vertex shader for analog waveforms**

```wgsl
// src/workers/render/shaders/waveform.vert.wgsl
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
  yOffset: f32,
  color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> samples: array<f32>;
@group(0) @binding(2) var<storage, read> channels: array<ChannelConfig>;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) edgeDist: f32,
  @location(2) age: f32,
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
  let side = f32(vid & 1u) * 2.0 - 1.0; // +1 or -1
  let ch = channels[iid];

  // Read current and neighbor sample for direction
  let curV = readSample(iid, sampleIdx);
  let nextIdx = min(sampleIdx + 1u, u.bufferLength - 1u);
  let nextV = readSample(iid, nextIdx);

  let stepX = u.canvasSize.x / f32(u.bufferLength - 1u);
  let x = f32(sampleIdx) * stepX;
  let y = voltageToY(curV, ch.yOffset);

  let nextX = f32(nextIdx) * stepX;
  let nextY = voltageToY(nextV, ch.yOffset);

  let dx = nextX - x;
  let dy = nextY - y;
  let len = max(sqrt(dx * dx + dy * dy), 0.001);
  // Normal (perpendicular): (-dy, dx) normalized
  let nx = -dy / len;
  let ny = dx / len;

  let offsetX = nx * side * u.lineWidth * 0.5;
  let offsetY = ny * side * u.lineWidth * 0.5;

  let screenX = (x + offsetX) / u.canvasSize.x * 2.0 - 1.0;
  let screenY = 1.0 - (y + offsetY) / u.canvasSize.y * 2.0;

  var out: VSOut;
  out.pos = vec4<f32>(screenX, screenY, 0.0, 1.0);
  out.color = ch.color;
  out.edgeDist = side; // -1 at one edge, +1 at the other
  out.age = f32(u.bufferLength - sampleIdx) / f32(u.bufferLength);
  return out;
}
```

- [ ] **Step 2: Clean fragment shader**

```wgsl
// src/workers/render/shaders/waveform-clean.frag.wgsl
struct FSIn {
  @location(0) color: vec4<f32>,
  @location(1) edgeDist: f32,
  @location(2) age: f32,
};

@fragment
fn fs_main(in: FSIn) -> @location(0) vec4<f32> {
  let alpha = 1.0 - smoothstep(0.7, 1.0, abs(in.edgeDist));
  return vec4<f32>(in.color.rgb, in.color.a * alpha);
}
```

- [ ] **Step 3: Glow fragment shader**

```wgsl
// src/workers/render/shaders/waveform-glow.frag.wgsl
struct FSIn {
  @location(0) color: vec4<f32>,
  @location(1) edgeDist: f32,
  @location(2) age: f32,
};

@fragment
fn fs_main(in: FSIn) -> @location(0) vec4<f32> {
  let d = abs(in.edgeDist);
  let core = smoothstep(1.0, 0.3, d);
  let halo = exp(-d * d * 2.0);
  let intensity = core + halo * 0.6;
  return vec4<f32>(in.color.rgb * intensity, in.color.a * intensity);
}
```

- [ ] **Step 4: Phosphor fragment shader**

```wgsl
// src/workers/render/shaders/waveform-phosphor.frag.wgsl
struct FSIn {
  @location(0) color: vec4<f32>,
  @location(1) edgeDist: f32,
  @location(2) age: f32,
};

@fragment
fn fs_main(in: FSIn) -> @location(0) vec4<f32> {
  let edgeAlpha = 1.0 - smoothstep(0.7, 1.0, abs(in.edgeDist));
  let ageFade = mix(0.2, 1.0, in.age);
  return vec4<f32>(in.color.rgb * ageFade, in.color.a * edgeAlpha * ageFade);
}
```

- [ ] **Step 5: Digital shader (vert+frag in one file)**

```wgsl
// src/workers/render/shaders/digital.wgsl
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
  yOffset: f32,
  color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> samples: array<f32>;
@group(0) @binding(2) var<storage, read> channels: array<ChannelConfig>;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) edgeDist: f32,
};

fn readSample(channel: u32, i: u32) -> f32 {
  let idx = (u.writePointer + i) & (u.bufferLength - 1u);
  return samples[channel * u.bufferLength + idx];
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
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let alpha = 1.0 - smoothstep(0.7, 1.0, abs(in.edgeDist));
  return vec4<f32>(in.color.rgb, in.color.a * alpha);
}
```

- [ ] **Step 6: Create shader index**

```ts
// src/workers/render/shaders/index.ts
import waveformVert from "./waveform.vert.wgsl?raw";
import waveformClean from "./waveform-clean.frag.wgsl?raw";
import waveformGlow from "./waveform-glow.frag.wgsl?raw";
import waveformPhosphor from "./waveform-phosphor.frag.wgsl?raw";
import digital from "./digital.wgsl?raw";

export const shaders = {
  waveformVert,
  waveformClean,
  waveformGlow,
  waveformPhosphor,
  digital,
} as const;

export type ShaderStyle = "clean" | "glow" | "phosphor";
```

- [ ] **Step 7: Verify typecheck**

```bash
bun run typecheck
```

Expected: No errors (note: Vite's `?raw` import requires types; if missing, add `declare module "*.wgsl?raw" { const s: string; export default s; }` to a new `src/vite-env.d.ts`).

- [ ] **Step 8: Create vite-env.d.ts if needed**

```ts
// src/vite-env.d.ts
/// <reference types="vite/client" />

declare module "*.wgsl?raw" {
  const content: string;
  export default content;
}
```

- [ ] **Step 9: Commit**

```bash
git add src/workers/render/shaders/ src/vite-env.d.ts
git commit -m "feat: add WGSL shaders for N-channel waveform rendering

Shared vertex shader with triangle-strip extrusion for thick lines,
three switchable fragment shaders (clean, glow, phosphor), digital
step-function shader. All N-channel via instance_index."
```

---

### Task 16: Render pipelines and Render Worker

**Files:**
- Create: `src/workers/render/pipelines/waveform.ts`, `src/workers/render/pipelines/digital.ts`, `src/workers/render/render.worker.ts`

- [ ] **Step 1: Implement waveform pipeline**

```ts
// src/workers/render/pipelines/waveform.ts
import { shaders, type ShaderStyle } from "../shaders";
import type { Probe } from "@/lib/types";

export interface WaveformPipelineResources {
  pipelines: Record<ShaderStyle, GPURenderPipeline>;
  uniformBuffer: GPUBuffer;
  channelBuffer: GPUBuffer;
  storageBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  bufferLength: number;
  channelCount: number;
}

export function createWaveformPipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
  channelCount: number,
  bufferLength: number,
): WaveformPipelineResources {
  const vertModule = device.createShaderModule({ code: shaders.waveformVert });

  const makePipeline = (fragCode: string): GPURenderPipeline => {
    const fragModule = device.createShaderModule({ code: fragCode });
    return device.createRenderPipeline({
      layout: "auto",
      vertex: { module: vertModule, entryPoint: "vs_main" },
      fragment: {
        module: fragModule,
        entryPoint: "fs_main",
        targets: [{
          format,
          blend: {
            color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
          },
        }],
      },
      primitive: { topology: "triangle-strip", stripIndexFormat: undefined },
    });
  };

  const pipelines: Record<ShaderStyle, GPURenderPipeline> = {
    clean: makePipeline(shaders.waveformClean),
    glow: makePipeline(shaders.waveformGlow),
    phosphor: makePipeline(shaders.waveformPhosphor),
  };

  // 32 bytes: vec2 canvasSize + 5 floats + 3 u32s, padded
  const uniformBuffer = device.createBuffer({
    size: 48,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const storageBuffer = device.createBuffer({
    size: channelCount * bufferLength * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // Per-channel config: yOffset (f32) + padding + color (vec4 = 16 bytes) = 32 bytes aligned
  const channelBuffer = device.createBuffer({
    size: Math.max(32 * channelCount, 32),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: pipelines.clean.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: storageBuffer } },
      { binding: 2, resource: { buffer: channelBuffer } },
    ],
  });

  return { pipelines, uniformBuffer, channelBuffer, storageBuffer, bindGroup, bufferLength, channelCount };
}

export function uploadChannels(
  device: GPUDevice,
  buffer: GPUBuffer,
  probes: readonly Probe[],
  canvasHeight: number,
): void {
  const data = new Float32Array(8 * probes.length);
  const rowHeight = canvasHeight / Math.max(probes.length, 1);
  for (let i = 0; i < probes.length; i++) {
    const probe = probes[i]!;
    const yOffset = rowHeight * probe.channelIndex + rowHeight * 0.5 - canvasHeight * 0.5;
    const color = hexToRgba(probe.color);
    data[i * 8 + 0] = yOffset;
    // 1-3 padding
    data[i * 8 + 4] = color[0];
    data[i * 8 + 5] = color[1];
    data[i * 8 + 6] = color[2];
    data[i * 8 + 7] = color[3];
  }
  device.queue.writeBuffer(buffer, 0, data);
}

export function uploadUniforms(
  device: GPUDevice,
  buffer: GPUBuffer,
  args: {
    width: number;
    height: number;
    scaleY: number;
    voltageHeadroom: number;
    lineWidth: number;
    writePointer: number;
    bufferLength: number;
    channelCount: number;
  },
): void {
  const f = new Float32Array(12);
  const u = new Uint32Array(f.buffer);
  f[0] = args.width;
  f[1] = args.height;
  f[2] = args.scaleY;
  f[3] = args.voltageHeadroom;
  f[4] = args.lineWidth;
  u[5] = args.writePointer;
  u[6] = args.bufferLength;
  u[7] = args.channelCount;
  device.queue.writeBuffer(buffer, 0, f);
}

function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return [r, g, b, 1.0];
}
```

- [ ] **Step 2: Implement digital pipeline (simpler — single fragment)**

```ts
// src/workers/render/pipelines/digital.ts
import { shaders } from "../shaders";

export interface DigitalPipelineResources {
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  channelBuffer: GPUBuffer;
  storageBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
}

export function createDigitalPipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
  channelCount: number,
  bufferLength: number,
): DigitalPipelineResources {
  const module = device.createShaderModule({ code: shaders.digital });

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module, entryPoint: "vs_main" },
    fragment: {
      module,
      entryPoint: "fs_main",
      targets: [{
        format,
        blend: {
          color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
          alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
        },
      }],
    },
    primitive: { topology: "triangle-strip" },
  });

  const uniformBuffer = device.createBuffer({
    size: 48,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const storageBuffer = device.createBuffer({
    size: channelCount * bufferLength * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const channelBuffer = device.createBuffer({
    size: Math.max(32 * channelCount, 32),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: storageBuffer } },
      { binding: 2, resource: { buffer: channelBuffer } },
    ],
  });

  return { pipeline, uniformBuffer, channelBuffer, storageBuffer, bindGroup };
}
```

- [ ] **Step 3: Implement Render Worker**

```ts
// src/workers/render/render.worker.ts
import * as Comlink from "comlink";
import type { Probe } from "@/lib/types";
import { createGPUDevice, configureCanvas, type GPUDeviceBundle } from "./gpu-device";
import { createWaveformPipeline, uploadChannels as uploadWaveformChannels, uploadUniforms as uploadWaveformUniforms, type WaveformPipelineResources } from "./pipelines/waveform";
import { createDigitalPipeline, type DigitalPipelineResources } from "./pipelines/digital";
import type { ShaderStyle } from "./shaders";
import { DefaultPhysicsConfig, Layout } from "@/lib/constants";

export interface RenderAPI {
  init(args: {
    waveformCanvas: OffscreenCanvas;
    digitalCanvas: OffscreenCanvas;
    width: number;
    waveformHeight: number;
    digitalHeight: number;
    dpr: number;
    probes: readonly Probe[];
  }): Promise<void>;
  resize(width: number, waveformHeight: number, digitalHeight: number, dpr: number): void;
  setShaderStyle(style: ShaderStyle): void;
  updateProbes(probes: readonly Probe[]): void;
  registerFrameChannel(port: MessagePort): void;
}

class RenderWorker implements RenderAPI {
  private gpu: GPUDeviceBundle | null = null;
  private waveformCtx: GPUCanvasContext | null = null;
  private digitalCtx: GPUCanvasContext | null = null;
  private waveformRes: WaveformPipelineResources | null = null;
  private digitalRes: DigitalPipelineResources | null = null;

  private width: number = 0;
  private waveformHeight: number = 0;
  private digitalHeight: number = 0;
  private probes: readonly Probe[] = [];
  private shaderStyle: ShaderStyle = "clean";

  // Frame data from Physics Worker
  private latestFrame: Float32Array | null = null;
  private latestWritePointer: number = 0;

  private rafHandle: number | null = null;

  async init(args: Parameters<RenderAPI["init"]>[0]): Promise<void> {
    this.width = args.width;
    this.waveformHeight = args.waveformHeight;
    this.digitalHeight = args.digitalHeight;
    this.probes = args.probes;

    this.gpu = await createGPUDevice();
    this.waveformCtx = configureCanvas(args.waveformCanvas, this.gpu.device, this.gpu.format);
    this.digitalCtx = configureCanvas(args.digitalCanvas, this.gpu.device, this.gpu.format);

    const channelCount = args.probes.length;
    const bufferLength = DefaultPhysicsConfig.simulation.bufferLength;

    this.waveformRes = createWaveformPipeline(this.gpu.device, this.gpu.format, channelCount, bufferLength);
    this.digitalRes = createDigitalPipeline(this.gpu.device, this.gpu.format, channelCount, bufferLength);

    uploadWaveformChannels(this.gpu.device, this.waveformRes.channelBuffer, args.probes, args.waveformHeight);

    this.startRenderLoop();
  }

  resize(width: number, waveformHeight: number, digitalHeight: number, _dpr: number): void {
    this.width = width;
    this.waveformHeight = waveformHeight;
    this.digitalHeight = digitalHeight;
    if (this.gpu && this.waveformRes) {
      uploadWaveformChannels(this.gpu.device, this.waveformRes.channelBuffer, this.probes, waveformHeight);
    }
  }

  setShaderStyle(style: ShaderStyle): void {
    this.shaderStyle = style;
  }

  updateProbes(probes: readonly Probe[]): void {
    this.probes = probes;
    if (this.gpu && this.waveformRes) {
      uploadWaveformChannels(this.gpu.device, this.waveformRes.channelBuffer, probes, this.waveformHeight);
    }
  }

  registerFrameChannel(port: MessagePort): void {
    port.onmessage = (e) => {
      if (e.data?.type === "frame") {
        this.latestFrame = e.data.data;
        this.latestWritePointer = e.data.writePointer;
      }
    };
    port.start();
  }

  private startRenderLoop(): void {
    const loop = () => {
      this.renderFrame();
      this.rafHandle = requestAnimationFrame(loop);
    };
    loop();
  }

  private renderFrame(): void {
    if (!this.gpu || !this.waveformRes || !this.digitalRes || !this.waveformCtx || !this.digitalCtx) return;
    const device = this.gpu.device;
    const bufferLength = this.waveformRes.bufferLength;
    const channelCount = this.waveformRes.channelCount;

    // Upload latest frame data
    if (this.latestFrame) {
      device.queue.writeBuffer(this.waveformRes.storageBuffer, 0, this.latestFrame);
      device.queue.writeBuffer(this.digitalRes.storageBuffer, 0, this.latestFrame);
    }

    // Waveform pass
    uploadWaveformUniforms(device, this.waveformRes.uniformBuffer, {
      width: this.width,
      height: this.waveformHeight,
      scaleY: Layout.scaleY,
      voltageHeadroom: Layout.voltageHeadroom,
      lineWidth: Layout.waveformLineWidth,
      writePointer: this.latestWritePointer,
      bufferLength,
      channelCount,
    });

    const encoder = device.createCommandEncoder();
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: this.waveformCtx.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        }],
      });
      pass.setPipeline(this.waveformRes.pipelines[this.shaderStyle]);
      pass.setBindGroup(0, this.waveformRes.bindGroup);
      // 2 vertices per sample x bufferLength x channelCount instances
      pass.draw(bufferLength * 2, channelCount);
      pass.end();
    }
    {
      // Digital pass: separate uniform struct layout; upload inline
      const f = new Float32Array(12);
      const u = new Uint32Array(f.buffer);
      f[0] = this.width;
      f[1] = this.digitalHeight;
      f[2] = DefaultPhysicsConfig.voltage.logicHighMin; // threshold
      f[3] = -Layout.channelRowHeight * 0.25;           // yHigh (above center)
      f[4] = Layout.channelRowHeight * 0.25;            // yLow (below center)
      f[5] = Layout.waveformLineWidth;
      u[6] = this.latestWritePointer;
      u[7] = bufferLength;
      u[8] = channelCount;
      device.queue.writeBuffer(this.digitalRes.uniformBuffer, 0, f);

      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: this.digitalCtx.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        }],
      });
      pass.setPipeline(this.digitalRes.pipeline);
      pass.setBindGroup(0, this.digitalRes.bindGroup);
      pass.draw(bufferLength * 2, channelCount);
      pass.end();
    }
    device.queue.submit([encoder.finish()]);
  }
}

const api = new RenderWorker();
Comlink.expose(api);
```

- [ ] **Step 4: Verify typecheck**

```bash
bun run typecheck
```

Expected: No errors. If `@webgpu/types` is missing, add `@webgpu/types` to devDependencies and include in tsconfig types.

- [ ] **Step 5: Commit**

```bash
git add src/workers/render/
git commit -m "feat: add Render Worker with WebGPU N-channel pipelines

Three shader styles (clean, glow, phosphor) share vertex shader.
Digital pipeline renders step-function waveforms. Frame data received
via MessageChannel from Physics Worker; canvas rendered on rAF."
```

---

## Phase 9: Worker Bridge

### Task 17: Worker bridge utility

**Files:**
- Create: `src/lib/worker-bridge.ts`

- [ ] **Step 1: Implement bridge**

```ts
// src/lib/worker-bridge.ts
import * as Comlink from "comlink";
import type { PhysicsAPI } from "@/workers/physics/physics.worker";
import type { RenderAPI } from "@/workers/render/render.worker";

export interface WorkerBridge {
  physics: Comlink.Remote<PhysicsAPI>;
  render: Comlink.Remote<RenderAPI>;
  physicsWorker: Worker;
  renderWorker: Worker;
  terminate(): void;
}

/** Creates both Workers, wraps them with Comlink, connects them via MessageChannel. */
export async function createWorkerBridge(): Promise<WorkerBridge> {
  const physicsWorker = new Worker(
    new URL("@/workers/physics/physics.worker.ts", import.meta.url),
    { type: "module" },
  );
  const renderWorker = new Worker(
    new URL("@/workers/render/render.worker.ts", import.meta.url),
    { type: "module" },
  );

  const physics = Comlink.wrap<PhysicsAPI>(physicsWorker);
  const render = Comlink.wrap<RenderAPI>(renderWorker);

  // Direct Physics → Render channel for frame data
  const channel = new MessageChannel();
  await physics.registerRenderPort(Comlink.transfer(channel.port1, [channel.port1]));
  await render.registerFrameChannel(Comlink.transfer(channel.port2, [channel.port2]));

  return {
    physics,
    render,
    physicsWorker,
    renderWorker,
    terminate: () => {
      physics[Comlink.releaseProxy]();
      render[Comlink.releaseProxy]();
      physicsWorker.terminate();
      renderWorker.terminate();
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/worker-bridge.ts
git commit -m "feat: add worker bridge creating both Workers with MessageChannel

Creates Physics + Render Workers, wraps with Comlink, establishes
direct MessageChannel between them for frame data transfer."
```

---

## Phase 10: Jotai Atoms

### Task 18: Core atoms

**Files:**
- Create: `src/atoms/simulation-atoms.ts`, `src/atoms/settings-atoms.ts`, `src/atoms/ui-atoms.ts`

- [ ] **Step 1: Create simulation atoms**

```ts
// src/atoms/simulation-atoms.ts
import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import type { CircuitDefinition } from "@/lib/types";

/** Active circuit definition */
export const circuitDefAtom = atom<CircuitDefinition | null>(null);

/** One atom per probe voltage — keyed by netId */
export const voltageAtomFamily = atomFamily((_netId: string) => atom(0));

/** One atom per control parameter — keyed by "componentId.paramKey" */
export const paramAtomFamily = atomFamily((_key: string) =>
  atom<number | boolean>(0),
);
```

- [ ] **Step 2: Create settings atoms**

```ts
// src/atoms/settings-atoms.ts
import { atom } from "jotai";
import type { VoltageSpecConfig } from "@/lib/types";
import { DefaultVoltageSpecs } from "@/lib/constants";

export const voltageSpecsAtom = atom<VoltageSpecConfig>(DefaultVoltageSpecs);
```

- [ ] **Step 3: Create UI atoms**

```ts
// src/atoms/ui-atoms.ts
import { atom } from "jotai";
import type { Probe } from "@/lib/types";
import type { ShaderStyle } from "@/workers/render/shaders";
import { circuitDefAtom } from "./simulation-atoms";

export type { ShaderStyle };
export type Locale = "en" | "zh-CN";

export const shaderStyleAtom = atom<ShaderStyle>("clean");
export const settingsOpenAtom = atom(false);
export const aboutOpenAtom = atom(false);
export const localeAtom = atom<Locale>("en");

/** Set of active probe netIds */
export const activeProbeIdsAtom = atom<Set<string>>(new Set<string>());

/** Derived: active probes filtered from circuit def */
export const activeProbesAtom = atom<Probe[]>((get) => {
  const def = get(circuitDefAtom);
  if (!def) return [];
  const activeIds = get(activeProbeIdsAtom);
  // If no active selection, default to all probes
  if (activeIds.size === 0) return [...def.probes];
  return def.probes.filter((p) => activeIds.has(p.netId));
});
```

- [ ] **Step 4: Write test for atoms**

```ts
// src/atoms/simulation-atoms.test.ts
import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { voltageAtomFamily, paramAtomFamily, circuitDefAtom } from "./simulation-atoms";

describe("simulation-atoms", () => {
  it("voltageAtomFamily creates independent atoms per netId", () => {
    const store = createStore();
    store.set(voltageAtomFamily("clk_net"), 1.5);
    store.set(voltageAtomFamily("d_net"), 0.3);
    expect(store.get(voltageAtomFamily("clk_net"))).toBe(1.5);
    expect(store.get(voltageAtomFamily("d_net"))).toBe(0.3);
  });

  it("paramAtomFamily holds number and boolean values independently", () => {
    const store = createStore();
    store.set(paramAtomFamily("clk.speed"), 50);
    store.set(paramAtomFamily("d.targetLogic"), true);
    expect(store.get(paramAtomFamily("clk.speed"))).toBe(50);
    expect(store.get(paramAtomFamily("d.targetLogic"))).toBe(true);
  });

  it("circuitDefAtom defaults to null", () => {
    const store = createStore();
    expect(store.get(circuitDefAtom)).toBe(null);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
bun run vitest run src/atoms/simulation-atoms.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/atoms/
git commit -m "feat: add Jotai atoms for simulation, settings, and UI state

atomFamily for per-probe voltages and per-control params. Derived
activeProbesAtom filters from circuitDefAtom + activeProbeIdsAtom.
Static atoms for UI state (shader style, sidebars, locale)."
```

---

### Task 19: DFF circuit definition

**Files:**
- Create: `src/circuits/dff.ts`

- [ ] **Step 1: Implement DFF circuit definition**

```ts
// src/circuits/dff.ts
import type { CircuitDefinition } from "@/lib/types";
import { theme } from "@/styles/theme";

export const dffCircuit: CircuitDefinition = {
  id: "dff",
  name: "D Flip-Flop",
  description:
    "Single D flip-flop demonstrating edge-triggered capture, Schmitt trigger hysteresis, 1/f noise, clock jitter, and metastability resolution.",
  components: [
    { type: "ClockSource", id: "clk", params: { speed: 30, jitterRms: 0.02 } },
    { type: "SignalSource", id: "d", params: { baseHigh: 1.5, baseLow: 0.1 } },
    { type: "DFlipFlop", id: "dff0", params: {} },
  ],
  nets: [
    {
      id: "clk_net",
      driver: { componentId: "clk", port: "out" },
      loads: [{ componentId: "dff0", port: "clk" }],
    },
    {
      id: "d_net",
      driver: { componentId: "d", port: "out" },
      loads: [{ componentId: "dff0", port: "d" }],
    },
    {
      id: "q_net",
      driver: { componentId: "dff0", port: "q" },
      loads: [],
    },
  ],
  probes: [
    { netId: "clk_net", label: "CLK", color: theme.green, channelIndex: 0 },
    { netId: "d_net", label: "D", color: theme.blue, channelIndex: 1 },
    { netId: "q_net", label: "Q", color: theme.red, channelIndex: 2 },
  ],
  controls: [
    { type: "toggle", targetComponent: "d", param: "targetLogic", label: "Input D", defaultValue: false },
    { type: "slider", targetComponent: "clk", param: "speed", label: "Clock Speed", min: 1, max: 100, defaultValue: 30 },
    { type: "slider", targetComponent: "global", param: "noise", label: "Noise Level", min: 0, max: 100, defaultValue: 10 },
    { type: "momentary", targetComponent: "dff0", param: "reset", label: "Reset (Hold)", defaultValue: false },
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/circuits/dff.ts
git commit -m "feat: add D Flip-Flop circuit definition

Declarative circuit: one ClockSource, one SignalSource (D input),
one DFlipFlop. Three nets with probes for CLK/D/Q. Four controls:
toggle, speed slider, noise slider, reset momentary. Colors sourced
from @catppuccin/palette via theme.ts."
```

---

## Phase 11: React UI Components

### Task 20: Layout, Toolbar, CircuitSelector

**Files:**
- Create: `src/components/layout/AppLayout.tsx`, `src/components/nav/Toolbar.tsx`, `src/components/nav/CircuitSelector.tsx`

- [ ] **Step 1: AppLayout**

```tsx
// src/components/layout/AppLayout.tsx
import type { ReactNode } from "react";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-screen grid-rows-[auto_1fr_1fr] bg-base text-text overflow-hidden">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Toolbar**

```tsx
// src/components/nav/Toolbar.tsx
import { useAtom, useSetAtom } from "jotai";
import { Settings, Info, Globe, CircuitBoard } from "lucide-react";
import { shaderStyleAtom, settingsOpenAtom, aboutOpenAtom, localeAtom } from "@/atoms/ui-atoms";
import { CircuitSelector } from "./CircuitSelector";

export function Toolbar() {
  const [shaderStyle, setShaderStyle] = useAtom(shaderStyleAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setAboutOpen = useSetAtom(aboutOpenAtom);
  const [locale, setLocale] = useAtom(localeAtom);

  return (
    <header className="flex items-center gap-4 px-4 py-2 border-b border-surface0 bg-mantle">
      <div className="flex items-center gap-2 font-bold text-lavender">
        <CircuitBoard size={20} />
        <span>DFF-Sim</span>
      </div>

      <CircuitSelector />

      <div className="ml-auto flex items-center gap-1">
        <div className="flex rounded overflow-hidden border border-surface1">
          {(["clean", "glow", "phosphor"] as const).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => setShaderStyle(style)}
              className={`px-3 py-1 text-xs uppercase ${
                shaderStyle === style ? "bg-surface2 text-text" : "bg-surface0 text-subtext0"
              }`}
            >
              {style}
            </button>
          ))}
        </div>

        <button type="button" onClick={() => setSettingsOpen(true)}
          className="p-2 rounded hover:bg-surface0" aria-label="Settings">
          <Settings size={18} />
        </button>
        <button type="button" onClick={() => setAboutOpen(true)}
          className="p-2 rounded hover:bg-surface0" aria-label="About">
          <Info size={18} />
        </button>
        <button type="button"
          onClick={() => setLocale(locale === "en" ? "zh-CN" : "en")}
          className="p-2 rounded hover:bg-surface0" aria-label="Language">
          <Globe size={18} />
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: CircuitSelector**

```tsx
// src/components/nav/CircuitSelector.tsx
import { useAtom } from "jotai";
import { circuitDefAtom } from "@/atoms/simulation-atoms";
import { dffCircuit } from "@/circuits/dff";

const circuits = [dffCircuit]; // Add more circuits here as they're built

export function CircuitSelector() {
  const [circuitDef, setCircuitDef] = useAtom(circuitDefAtom);

  return (
    <select
      value={circuitDef?.id ?? ""}
      onChange={(e) => {
        const def = circuits.find((c) => c.id === e.target.value);
        if (def) setCircuitDef(def);
      }}
      className="bg-surface0 border border-surface1 rounded px-3 py-1 text-sm text-text"
    >
      {circuits.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/ src/components/nav/
git commit -m "feat: add AppLayout, Toolbar, CircuitSelector components

Full-viewport grid layout (h-screen, 3 rows: toolbar/schematic/scope).
Toolbar has logo, circuit selector, shader style toggle, action buttons.
CircuitSelector is a native select driven by circuitDefAtom."
```

---

### Task 21: Oscilloscope panel

**Files:**
- Create: `src/components/oscilloscope/OscilloscopePanel.tsx`, `src/components/oscilloscope/WaveformCanvas.tsx`, `src/components/oscilloscope/DigitalCanvas.tsx`, `src/components/oscilloscope/Legend.tsx`

- [ ] **Step 1: DigitalCanvas**

```tsx
// src/components/oscilloscope/DigitalCanvas.tsx
import { forwardRef } from "react";

export const DigitalCanvas = forwardRef<HTMLCanvasElement>((_, ref) => (
  <canvas
    ref={ref}
    className="w-full h-full block"
    aria-label="Digital logic view"
  />
));
DigitalCanvas.displayName = "DigitalCanvas";
```

- [ ] **Step 2: WaveformCanvas**

```tsx
// src/components/oscilloscope/WaveformCanvas.tsx
import { forwardRef } from "react";

export const WaveformCanvas = forwardRef<HTMLCanvasElement>((_, ref) => (
  <canvas
    ref={ref}
    className="w-full h-full block"
    aria-label="Real-time analog oscilloscope"
  />
));
WaveformCanvas.displayName = "WaveformCanvas";
```

- [ ] **Step 3: Legend**

```tsx
// src/components/oscilloscope/Legend.tsx
import { useAtomValue } from "jotai";
import { activeProbesAtom } from "@/atoms/ui-atoms";

export function Legend() {
  const probes = useAtomValue(activeProbesAtom);
  return (
    <div className="flex gap-4 px-4 py-2 border-t border-surface0 text-sm">
      {probes.map((p) => (
        <div key={p.netId} className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-subtext0">{p.label}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: OscilloscopePanel**

```tsx
// src/components/oscilloscope/OscilloscopePanel.tsx
import { type RefObject } from "react";
import { DigitalCanvas } from "./DigitalCanvas";
import { WaveformCanvas } from "./WaveformCanvas";
import { Legend } from "./Legend";

interface Props {
  waveformRef: RefObject<HTMLCanvasElement>;
  digitalRef: RefObject<HTMLCanvasElement>;
}

export function OscilloscopePanel({ waveformRef, digitalRef }: Props) {
  return (
    <section className="grid grid-rows-[auto_1fr_1fr_auto] min-h-0 bg-base">
      <div className="px-4 py-1 text-xs uppercase tracking-wider text-subtext0 border-b border-surface0">
        Digital Logic View
      </div>
      <div className="min-h-0">
        <DigitalCanvas ref={digitalRef} />
      </div>
      <div className="min-h-0 border-t border-surface0">
        <WaveformCanvas ref={waveformRef} />
      </div>
      <Legend />
    </section>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/oscilloscope/
git commit -m "feat: add OscilloscopePanel with Digital/Waveform canvases and Legend

Canvases via forwardRef for OffscreenCanvas transfer. Legend driven
by activeProbesAtom. Panel uses subgrid-compatible layout."
```

---

### Task 22: Controls

**Files:**
- Create: `src/components/controls/ControlPanel.tsx`, `src/components/controls/ParamSlider.tsx`, `src/components/controls/ParamToggle.tsx`, `src/components/controls/ParamMomentary.tsx`, `src/components/controls/ProbeSelector.tsx`

- [ ] **Step 1: ParamSlider**

```tsx
// src/components/controls/ParamSlider.tsx
import { useAtom } from "jotai";
import { paramAtomFamily } from "@/atoms/simulation-atoms";
import type { ControlDef } from "@/lib/types";

export function ParamSlider({ control }: { control: ControlDef }) {
  const key = `${control.targetComponent}.${control.param}`;
  const [value, setValue] = useAtom(paramAtomFamily(key));

  return (
    <label className="grid grid-cols-[1fr_auto] items-center gap-2 py-1">
      <span className="text-xs text-subtext0">{control.label}</span>
      <input
        type="range"
        min={control.min ?? 0}
        max={control.max ?? 100}
        value={typeof value === "number" ? value : (control.defaultValue as number) ?? 0}
        onChange={(e) => setValue(Number(e.target.value))}
        className="col-span-2 w-full accent-lavender"
      />
      <span className="col-span-2 text-xs text-right text-subtext1 font-mono">
        {typeof value === "number" ? value.toFixed(0) : 0}
      </span>
    </label>
  );
}
```

- [ ] **Step 2: ParamToggle**

```tsx
// src/components/controls/ParamToggle.tsx
import { useAtom } from "jotai";
import { paramAtomFamily } from "@/atoms/simulation-atoms";
import type { ControlDef } from "@/lib/types";

export function ParamToggle({ control }: { control: ControlDef }) {
  const key = `${control.targetComponent}.${control.param}`;
  const [value, setValue] = useAtom(paramAtomFamily(key));
  const isOn = value === true;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 py-2">
      <span className="text-xs text-subtext0">{control.label}</span>
      <button
        type="button"
        onClick={() => setValue(!isOn)}
        className={`px-3 py-1 rounded text-xs font-bold uppercase ${
          isOn ? "bg-blue text-base" : "bg-surface1 text-subtext0"
        }`}
      >
        {isOn ? "HIGH" : "LOW"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: ParamMomentary**

```tsx
// src/components/controls/ParamMomentary.tsx
import { useSetAtom } from "jotai";
import { paramAtomFamily } from "@/atoms/simulation-atoms";
import type { ControlDef } from "@/lib/types";

export function ParamMomentary({ control }: { control: ControlDef }) {
  const key = `${control.targetComponent}.${control.param}`;
  const setValue = useSetAtom(paramAtomFamily(key));

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 py-2">
      <span className="text-xs text-subtext0">{control.label}</span>
      <button
        type="button"
        onPointerDown={() => setValue(true)}
        onPointerUp={() => setValue(false)}
        onPointerLeave={() => setValue(false)}
        className="px-3 py-1 rounded text-xs font-bold uppercase bg-red/70 active:bg-red text-base"
      >
        HOLD
      </button>
    </div>
  );
}
```

- [ ] **Step 4: ControlPanel**

```tsx
// src/components/controls/ControlPanel.tsx
import { useAtomValue } from "jotai";
import { circuitDefAtom } from "@/atoms/simulation-atoms";
import { ParamSlider } from "./ParamSlider";
import { ParamToggle } from "./ParamToggle";
import { ParamMomentary } from "./ParamMomentary";

export function ControlPanel() {
  const circuitDef = useAtomValue(circuitDefAtom);
  if (!circuitDef) return null;

  return (
    <div className="px-4 py-3 border-b border-surface0">
      <h3 className="text-xs uppercase tracking-wider text-subtext0 mb-2">Controls</h3>
      {circuitDef.controls.map((ctrl) => {
        const key = `${ctrl.targetComponent}.${ctrl.param}`;
        if (ctrl.type === "slider") return <ParamSlider key={key} control={ctrl} />;
        if (ctrl.type === "toggle") return <ParamToggle key={key} control={ctrl} />;
        if (ctrl.type === "momentary") return <ParamMomentary key={key} control={ctrl} />;
        return null;
      })}
    </div>
  );
}
```

- [ ] **Step 5: ProbeSelector**

```tsx
// src/components/controls/ProbeSelector.tsx
import { useAtom, useAtomValue } from "jotai";
import { circuitDefAtom } from "@/atoms/simulation-atoms";
import { activeProbeIdsAtom } from "@/atoms/ui-atoms";

export function ProbeSelector() {
  const circuitDef = useAtomValue(circuitDefAtom);
  const [activeIds, setActiveIds] = useAtom(activeProbeIdsAtom);
  if (!circuitDef) return null;

  const toggleProbe = (netId: string) => {
    const next = new Set(activeIds);
    if (next.has(netId)) next.delete(netId);
    else next.add(netId);
    setActiveIds(next);
  };

  const isActive = (netId: string) =>
    activeIds.size === 0 || activeIds.has(netId);

  return (
    <div className="px-4 py-3 border-b border-surface0">
      <h3 className="text-xs uppercase tracking-wider text-subtext0 mb-2">Probes</h3>
      <div className="space-y-1">
        {circuitDef.probes.map((p) => (
          <label key={p.netId} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive(p.netId)}
              onChange={() => toggleProbe(p.netId)}
              className="accent-lavender"
            />
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-sm text-text">{p.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/controls/
git commit -m "feat: add dynamic control components driven by circuit def

ParamSlider/Toggle/Momentary each subscribe to one paramAtomFamily
atom — per-atom subscriptions eliminate cross-control re-renders.
ControlPanel iterates circuitDef.controls[]. ProbeSelector toggles
activeProbeIdsAtom; empty set means all probes active."
```

---

### Task 23: Circuit Schematic

**Files:**
- Create: `src/components/schematic/CircuitSchematic.tsx`, `src/components/schematic/SchematicNode.tsx`, `src/components/schematic/SchematicWire.tsx`

- [ ] **Step 1: SchematicNode**

```tsx
// src/components/schematic/SchematicNode.tsx
import type { ComponentDef } from "@/lib/types";
import { useAtomValue } from "jotai";
import { voltageAtomFamily } from "@/atoms/simulation-atoms";

interface Props {
  component: ComponentDef;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function SchematicNode({ component, x, y, width, height }: Props) {
  const label = component.type === "DFlipFlop" ? "D-FF" : component.type;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={width}
        height={height}
        rx={8}
        className="fill-surface1 stroke-overlay0"
        strokeWidth={2}
      />
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-text font-mono text-sm"
      >
        {label}
      </text>
      <text
        x={width / 2}
        y={height + 16}
        textAnchor="middle"
        className="fill-subtext0 text-xs"
      >
        {component.id}
      </text>
    </g>
  );
}
```

- [ ] **Step 2: SchematicWire**

```tsx
// src/components/schematic/SchematicWire.tsx
import { useAtomValue } from "jotai";
import { voltageAtomFamily } from "@/atoms/simulation-atoms";

interface Props {
  netId: string;
  label: string;
  color: string;
  points: string; // SVG polyline points
  threshold?: number;
}

export function SchematicWire({ netId, label, color, points, threshold = 1.0 }: Props) {
  const voltage = useAtomValue(voltageAtomFamily(netId));
  const isActive = voltage > threshold;
  return (
    <g>
      <polyline
        points={points}
        fill="none"
        stroke={isActive ? color : "currentColor"}
        strokeWidth={isActive ? 3 : 2}
        className={isActive ? "" : "text-overlay0"}
        style={{
          filter: isActive ? `drop-shadow(0 0 4px ${color})` : undefined,
          transition: "stroke-width 100ms, filter 100ms",
        }}
      />
      <text
        x={points.split(" ")[0]?.split(",")[0] ?? 0}
        y={Number(points.split(" ")[0]?.split(",")[1] ?? 0) - 6}
        className="fill-subtext0 text-xs font-mono"
      >
        {label}: {voltage.toFixed(2)}V
      </text>
    </g>
  );
}
```

- [ ] **Step 3: CircuitSchematic**

```tsx
// src/components/schematic/CircuitSchematic.tsx
import { useAtomValue } from "jotai";
import { circuitDefAtom } from "@/atoms/simulation-atoms";
import { SchematicNode } from "./SchematicNode";
import { SchematicWire } from "./SchematicWire";

/**
 * Simple auto-layout: components laid out left-to-right in a single row.
 * Real layout would use a proper graph layout algorithm (e.g., dagre).
 */
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

  const positions = new Map<string, { x: number; y: number }>();
  circuitDef.components.forEach((c, i) => {
    positions.set(c.id, { x: startX + i * (nodeW + gap), y: rowY });
  });

  // Naive wire routing: straight line between output and input midpoints
  const wires = circuitDef.nets.flatMap((net) => {
    const probe = circuitDef.probes.find((p) => p.netId === net.id);
    return net.loads.map((load) => {
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
  }).filter(Boolean);

  return (
    <section className="bg-mantle overflow-hidden min-h-0">
      <div className="px-4 py-1 text-xs uppercase tracking-wider text-subtext0 border-b border-surface0">
        Circuit Schematic — {circuitDef.name}
      </div>
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-[calc(100%-2rem)]"
      >
        {wires.map((w, i) => w && (
          <SchematicWire
            key={`${w.netId}-${i}`}
            netId={w.netId}
            label={w.label}
            color={w.color}
            points={w.points}
          />
        ))}
        {circuitDef.components.map((c) => {
          const pos = positions.get(c.id)!;
          return (
            <SchematicNode
              key={c.id}
              component={c}
              x={pos.x}
              y={pos.y}
              width={nodeW}
              height={nodeH}
            />
          );
        })}
      </svg>
    </section>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/schematic/
git commit -m "feat: add CircuitSchematic SVG rendering

Auto-layout places components left-to-right, routes wires with
right-angle path. Wires highlight with channel color when voltage
is above threshold (voltageAtomFamily per net). Voltages annotate
in real-time above each wire."
```

---

### Task 24: Settings and About sheets, WebGPU fallback

**Files:**
- Create: `src/components/settings/SettingsSheet.tsx`, `src/components/about/AboutSheet.tsx`, `src/components/fallback/WebGPUUnavailable.tsx`

- [ ] **Step 1: WebGPUUnavailable**

```tsx
// src/components/fallback/WebGPUUnavailable.tsx
import { AlertTriangle } from "lucide-react";

export function WebGPUUnavailable() {
  return (
    <div className="h-screen flex items-center justify-center bg-base text-text p-8">
      <div className="max-w-xl text-center space-y-4">
        <AlertTriangle size={48} className="mx-auto text-yellow" />
        <h1 className="text-2xl font-bold">WebGPU Required</h1>
        <p className="text-subtext0">
          This simulation requires WebGPU, which is not available in your browser.
        </p>
        <p className="text-subtext0 text-sm">
          Please use Chrome/Edge 113+, Firefox 141+, or Safari 26+.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: SettingsSheet (simplified shadcn-style sheet)**

```tsx
// src/components/settings/SettingsSheet.tsx
import * as Dialog from "@radix-ui/react-dialog";
import { useAtom } from "jotai";
import { X } from "lucide-react";
import { settingsOpenAtom } from "@/atoms/ui-atoms";
import { voltageSpecsAtom } from "@/atoms/settings-atoms";
import { DefaultVoltageSpecs } from "@/lib/constants";
import { voltageSpecSchema } from "@/lib/validation";
import { useState } from "react";

export function SettingsSheet() {
  const [open, setOpen] = useAtom(settingsOpenAtom);
  const [specs, setSpecs] = useAtom(voltageSpecsAtom);
  const [draft, setDraft] = useState(specs);
  const [error, setError] = useState<string | null>(null);

  const validate = (candidate: typeof specs) => {
    const result = voltageSpecSchema.safeParse(candidate);
    return result.success ? null : result.error.errors[0]?.message ?? "Invalid";
  };

  const onChange = (key: keyof typeof specs, value: number) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    setError(validate(next));
  };

  const onSave = () => {
    if (error) return;
    setSpecs(draft);
    setOpen(false);
  };

  const onReset = () => {
    setDraft(DefaultVoltageSpecs);
    setError(null);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-base/80 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed top-0 right-0 h-full w-96 bg-mantle border-l border-surface0 p-6 z-50 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-bold">Voltage Settings</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="p-1 rounded hover:bg-surface0" aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-3">
            {(Object.keys(DefaultVoltageSpecs) as (keyof typeof DefaultVoltageSpecs)[]).map((key) => (
              <label key={key} className="grid grid-cols-[1fr_auto] items-center gap-2">
                <span className="text-xs text-subtext0">{key}</span>
                <input
                  type="number"
                  step="0.01"
                  value={draft[key]}
                  onChange={(e) => onChange(key, Number(e.target.value))}
                  className="w-24 bg-surface0 border border-surface1 rounded px-2 py-1 text-sm"
                />
              </label>
            ))}
          </div>

          {error && <p className="mt-3 text-xs text-red">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={onSave} disabled={!!error}
              className="px-4 py-2 bg-green text-base font-bold rounded disabled:opacity-50">
              Save
            </button>
            <button type="button" onClick={onReset}
              className="px-4 py-2 bg-surface1 text-text rounded">
              Reset
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 3: AboutSheet**

```tsx
// src/components/about/AboutSheet.tsx
import * as Dialog from "@radix-ui/react-dialog";
import { useAtom, useAtomValue } from "jotai";
import { X } from "lucide-react";
import { aboutOpenAtom } from "@/atoms/ui-atoms";
import { circuitDefAtom } from "@/atoms/simulation-atoms";

export function AboutSheet() {
  const [open, setOpen] = useAtom(aboutOpenAtom);
  const circuitDef = useAtomValue(circuitDefAtom);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-base/80 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed top-0 right-0 h-full w-96 bg-mantle border-l border-surface0 p-6 z-50 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-bold">About</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="p-1 rounded hover:bg-surface0" aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <h3 className="text-sm font-bold text-lavender mb-2">{circuitDef?.name}</h3>
          <p className="text-sm text-subtext0 mb-4">{circuitDef?.description}</p>

          <h4 className="text-xs uppercase tracking-wider text-subtext0 mt-4 mb-2">Tech Stack</h4>
          <ul className="text-sm text-text space-y-1">
            <li>React 19 + Tailwind v4</li>
            <li>WebGPU + WGSL rendering</li>
            <li>Jotai atomic state</li>
            <li>Multi-Worker Actor Model</li>
            <li>Physics: 10kHz sub-stepping, 1/f noise, metastability</li>
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/ src/components/about/ src/components/fallback/
git commit -m "feat: add Settings/About sheets and WebGPU fallback

SettingsSheet uses Radix Dialog, validates voltage specs with Zod.
AboutSheet shows current circuit description. WebGPUUnavailable
displayed when navigator.gpu is absent."
```

---

## Phase 12: useSimulation Hook (Integration)

### Task 25: useSimulation hook

**Files:**
- Create: `src/hooks/useSimulation.ts`

- [ ] **Step 1: Implement hook**

```ts
// src/hooks/useSimulation.ts
import { useEffect, useRef, type RefObject } from "react";
import { useAtomValue, useStore } from "jotai";
import * as Comlink from "comlink";
import { createWorkerBridge, type WorkerBridge } from "@/lib/worker-bridge";
import { circuitDefAtom, voltageAtomFamily, paramAtomFamily } from "@/atoms/simulation-atoms";
import { activeProbesAtom, shaderStyleAtom } from "@/atoms/ui-atoms";
import { voltageSpecsAtom } from "@/atoms/settings-atoms";
import type { Probe } from "@/lib/types";
import { Layout } from "@/lib/constants";

export function useSimulation(
  waveformRef: RefObject<HTMLCanvasElement | null>,
  digitalRef: RefObject<HTMLCanvasElement | null>,
) {
  const circuitDef = useAtomValue(circuitDefAtom);
  const activeProbes = useAtomValue(activeProbesAtom);
  const shaderStyle = useAtomValue(shaderStyleAtom);
  const voltageSpecs = useAtomValue(voltageSpecsAtom);
  const store = useStore();

  const bridgeRef = useRef<WorkerBridge | null>(null);

  // Setup on circuit change
  useEffect(() => {
    if (!circuitDef || !waveformRef.current || !digitalRef.current) return;
    let cancelled = false;

    async function setup() {
      const waveCanvas = waveformRef.current;
      const digitalCanvas = digitalRef.current;
      if (!waveCanvas || !digitalCanvas) return;

      // Transfer canvases
      const waveOffscreen = waveCanvas.transferControlToOffscreen();
      const digitalOffscreen = digitalCanvas.transferControlToOffscreen();

      const bridge = await createWorkerBridge();
      if (cancelled) {
        bridge.terminate();
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      await bridge.render.init(
        Comlink.transfer(
          {
            waveformCanvas: waveOffscreen,
            digitalCanvas: digitalOffscreen,
            width: waveCanvas.clientWidth || 800,
            waveformHeight: Layout.canvasHeight,
            digitalHeight: Layout.digitalScopeHeight,
            dpr,
            probes: activeProbes,
          },
          [waveOffscreen, digitalOffscreen],
        ) as Parameters<typeof bridge.render.init>[0],
      );

      await bridge.physics.loadCircuit(circuitDef);

      // Status callback: write voltages into atoms
      await bridge.physics.registerStatusCallback(
        Comlink.proxy((voltages: number[]) => {
          for (const probe of activeProbes) {
            const v = voltages[probe.channelIndex];
            if (v !== undefined) {
              store.set(voltageAtomFamily(probe.netId), v);
            }
          }
        }),
      );

      await bridge.physics.start();
      bridgeRef.current = bridge;
    }

    setup();
    return () => {
      cancelled = true;
      bridgeRef.current?.terminate();
      bridgeRef.current = null;
    };
  }, [circuitDef]);

  // Shader style sync
  useEffect(() => {
    bridgeRef.current?.render.setShaderStyle(shaderStyle);
  }, [shaderStyle]);

  // Settings sync
  useEffect(() => {
    bridgeRef.current?.physics.setSettings(voltageSpecs);
  }, [voltageSpecs]);

  // Active probes sync
  useEffect(() => {
    bridgeRef.current?.render.updateProbes(activeProbes);
  }, [activeProbes]);

  // Subscribe to every param atom and forward changes to Physics
  useEffect(() => {
    if (!circuitDef) return;
    const unsubs = circuitDef.controls.map((ctrl) => {
      const key = `${ctrl.targetComponent}.${ctrl.param}`;
      const atom = paramAtomFamily(key);
      return store.sub(atom, () => {
        const value = store.get(atom);
        bridgeRef.current?.physics.setParam(ctrl.targetComponent, ctrl.param, value);
      });
    });
    return () => unsubs.forEach((u) => u());
  }, [circuitDef, store]);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useSimulation.ts
git commit -m "feat: add useSimulation hook integrating Workers with Jotai atoms

Manages Worker lifecycle: creates bridge on circuit load, transfers
OffscreenCanvases to Render Worker, starts Physics simulation.
Subscribes to param atoms and forwards changes via Comlink. Writes
voltage callbacks into voltageAtomFamily atoms. Tears down on
circuit change or unmount."
```

---

## Phase 13: Final Integration

### Task 26: App integration

**Files:**
- Modify: `src/app/App.tsx`, `src/app/providers.tsx`, `src/app/main.tsx`

- [ ] **Step 1: Create providers**

```tsx
// src/app/providers.tsx
import { Provider as JotaiProvider } from "jotai";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <JotaiProvider>{children}</JotaiProvider>;
}
```

- [ ] **Step 2: Rewrite App.tsx**

```tsx
// src/app/App.tsx
import { useEffect, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { AppLayout } from "@/components/layout/AppLayout";
import { Toolbar } from "@/components/nav/Toolbar";
import { OscilloscopePanel } from "@/components/oscilloscope/OscilloscopePanel";
import { CircuitSchematic } from "@/components/schematic/CircuitSchematic";
import { ControlPanel } from "@/components/controls/ControlPanel";
import { ProbeSelector } from "@/components/controls/ProbeSelector";
import { SettingsSheet } from "@/components/settings/SettingsSheet";
import { AboutSheet } from "@/components/about/AboutSheet";
import { WebGPUUnavailable } from "@/components/fallback/WebGPUUnavailable";
import { useSimulation } from "@/hooks/useSimulation";
import { circuitDefAtom } from "@/atoms/simulation-atoms";
import { dffCircuit } from "@/circuits/dff";
import { Providers } from "./providers";

function AppInner() {
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const digitalRef = useRef<HTMLCanvasElement>(null);
  const setCircuit = useSetAtom(circuitDefAtom);

  useEffect(() => {
    setCircuit(dffCircuit);
  }, [setCircuit]);

  useSimulation(waveformRef, digitalRef);

  return (
    <AppLayout>
      <Toolbar />
      <CircuitSchematic />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] min-h-0">
        <OscilloscopePanel waveformRef={waveformRef} digitalRef={digitalRef} />
        <aside className="flex flex-col overflow-y-auto border-l border-surface0">
          <ControlPanel />
          <ProbeSelector />
        </aside>
      </div>
      <SettingsSheet />
      <AboutSheet />
    </AppLayout>
  );
}

export function App() {
  if (typeof navigator !== "undefined" && !("gpu" in navigator)) {
    return <WebGPUUnavailable />;
  }
  return (
    <Providers>
      <AppInner />
    </Providers>
  );
}
```

- [ ] **Step 3: Verify typecheck and test build**

```bash
bun run typecheck
bun run build
```

Expected: No errors, dist/ produced.

- [ ] **Step 4: Run dev server and verify in browser**

```bash
bun run dev
```

Expected: Open http://localhost:5173, see toolbar, schematic with CLK/D/DFF nodes, oscilloscope with waveforms, controls responsive. Toggle D, move sliders — waveforms update.

- [ ] **Step 5: Commit**

```bash
git add src/app/
git commit -m "feat: integrate all components into full-viewport dashboard

App.tsx mounts Toolbar, Schematic, OscilloscopePanel, Controls,
sheets. useSimulation wires Workers to atoms. DFF circuit loaded
on mount. WebGPU fallback if navigator.gpu absent."
```

---

## Phase 14: i18n, CI/CD

### Task 27: Lingui setup

**Files:**
- Create: `lingui.config.ts`, `src/i18n/locales/en/messages.po`, `src/i18n/locales/zh-CN/messages.po`, `src/i18n/index.ts`
- Modify: `vite.config.ts`, `src/app/providers.tsx`

- [ ] **Step 1: Create lingui.config.ts**

```ts
// lingui.config.ts
import { defineConfig } from "@lingui/cli";

export default defineConfig({
  sourceLocale: "en",
  locales: ["en", "zh-CN"],
  catalogs: [
    {
      path: "src/i18n/locales/{locale}/messages",
      include: ["src"],
    },
  ],
});
```

- [ ] **Step 2: Update vite.config.ts**

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { lingui } from "@lingui/vite-plugin";
import path from "node:path";

export default defineConfig({
  plugins: [
    react({ babel: { plugins: ["@lingui/babel-plugin-lingui-macro"] } }),
    lingui(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: { sourcemap: false },
  base: "./",
});
```

- [ ] **Step 3: Create i18n init**

```ts
// src/i18n/index.ts
import { i18n } from "@lingui/core";
import { messages as enMessages } from "./locales/en/messages.po";
import { messages as zhMessages } from "./locales/zh-CN/messages.po";

i18n.load({ en: enMessages, "zh-CN": zhMessages });
i18n.activate("en");

export { i18n };
```

- [ ] **Step 4: Create empty locale files**

```
# src/i18n/locales/en/messages.po
msgid ""
msgstr ""
"Language: en\n"
```

```
# src/i18n/locales/zh-CN/messages.po
msgid ""
msgstr ""
"Language: zh-CN\n"
```

- [ ] **Step 5: Wrap providers with i18n**

```tsx
// src/app/providers.tsx
import { Provider as JotaiProvider } from "jotai";
import { I18nProvider } from "@lingui/react";
import type { ReactNode } from "react";
import { i18n } from "@/i18n";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider i18n={i18n}>
      <JotaiProvider>{children}</JotaiProvider>
    </I18nProvider>
  );
}
```

- [ ] **Step 6: Run extract and verify**

```bash
bun run lingui:extract
bun run typecheck
```

Expected: Catalogs scanned without errors.

- [ ] **Step 7: Commit**

```bash
git add lingui.config.ts src/i18n/ vite.config.ts src/app/providers.tsx
git commit -m "feat: add Lingui i18n with en/zh-CN catalogs

Lingui configured with Vite plugin, I18nProvider wraps app.
Empty catalogs ready for extraction. Locale switch via localeAtom."
```

---

### Task 28: CI/CD pipeline update

**Files:**
- Modify: `.github/workflows/deploy.yaml`

- [ ] **Step 1: Read current workflow**

Read the existing `.github/workflows/deploy.yaml` to understand its structure.

- [ ] **Step 2: Update workflow**

```yaml
# .github/workflows/deploy.yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Lint and format check
        run: bun run check

      - name: Type check
        run: bun run typecheck

      - name: Run tests
        run: bun run test

      - name: Build
        run: bun run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yaml
git commit -m "ci: update GitHub Actions for Bun + Biome + Vitest pipeline

Runs lint, typecheck, test, and build stages. Deploys dist/ to
GitHub Pages on push to main."
```

- [ ] **Step 4: Final push and merge**

```bash
# Push the feat/react-rewrite branch to remote
git push -u origin feat/react-rewrite

# Open PR (when ready)
gh pr create --title "React + WebGPU rewrite" --body "Complete ground-up rewrite per docs/superpowers/specs/2026-04-16-react-rewrite-design.md"
```

---

## Completion Checklist

After all 28 tasks:

- [ ] All unit tests pass: `bun run test`
- [ ] Typecheck passes: `bun run typecheck`
- [ ] Lint passes: `bun run check`
- [ ] Build succeeds: `bun run build`
- [ ] Dev server runs: `bun run dev`
- [ ] Browser verification: DFF simulation visible, waveforms animate, controls responsive
- [ ] Shader styles switchable (clean/glow/phosphor)
- [ ] Settings sheet opens, validates, saves
- [ ] Schematic wires highlight with voltage
- [ ] Probe selector toggles channels
- [ ] i18n locale switch works
- [ ] CI pipeline green

