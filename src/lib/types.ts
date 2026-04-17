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
