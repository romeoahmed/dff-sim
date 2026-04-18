import type {
  GatesConfig,
  LayoutConfig,
  PhysicsConfig,
  SimulationConfig,
  TimingConfig,
  VoltageSpecConfig,
} from "./types";

export const DefaultVoltageSpecs = {
  logicHighMin: 1.0,
  logicLowMax: 0.6,
  outputHighMin: 1.8,
  outputHighMax: 2.0,
  outputLowMax: 0.2,
  systemMax: 2.5,
  clampMin: -0.5,
} as const satisfies VoltageSpecConfig;

export const DefaultSimulation = {
  maxNoiseLevel: 0.8,
  clockSpeedFactor: 0.002,
  defaultSpeed: 30,
  defaultNoise: 10,
  baseFrameRate: 60,
  bufferLength: 2048,
  outputNoiseRatio: 0.5,
  physicsDt: 0.0001,
} as const satisfies SimulationConfig;

export const DefaultTiming = {
  tSetup: 0.003,
  tHold: 0.001,
  tCQ: 0.002,
  tauMeta: 0.005,
  metaResolveNoiseSigma: 0.15,
} as const satisfies TimingConfig;

export const DefaultGates = {
  tPD: 0.001,
  zeta: 0.4,
  ringFreq: 120,
} as const satisfies GatesConfig;

export const DefaultPhysicsConfig = {
  voltage: DefaultVoltageSpecs,
  simulation: DefaultSimulation,
  timing: DefaultTiming,
  gates: DefaultGates,
} as const satisfies PhysicsConfig;

export const Layout = {
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
} as const satisfies LayoutConfig;
