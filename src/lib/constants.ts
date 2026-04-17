import type {
  LayoutConfig,
  PhysicsConfig,
  SimulationConfig,
  TimingConfig,
  VoltageSpecConfig,
} from "./types";

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
