/**
 * 全局配置与常量定义：颜色、电压规范、布局与仿真参数
 */

import type {
  ColorConfig,
  LayoutConfig,
  SimulationConfig,
  VoltageSpecConfig,
} from "./types";

/**
 * 颜色配置 (Catppuccin Macchiato)
 * @see https://github.com/catppuccin/palette
 */
export const Colors = {
  clk: "#a6da95",
  d: "#8aadf4",
  q: "#ed8796",
  highlight: "#eed49f",
  text: "#cad3f5",
  grid: "#363a4f",
  stroke: "#494d64",
  fill: "#5b6078",
} as const satisfies ColorConfig;

/**
 * 电压物理规范 (单位: 伏特 V)
 */
export const VoltageSpecs = {
  logicHighMin: 1.0,
  logicLowMax: 0.6,
  outputHighMin: 1.8,
  outputHighMax: 2.0,
  outputLowMax: 0.2,
  systemMax: 2.5,
  clampMin: -0.5,
  smoothingFactor: 0.2,
  outputSmoothingFactor: 0.4,
} as const satisfies VoltageSpecConfig;

/**
 * 仿真参数配置
 */
export const Simulation = {
  maxNoiseLevel: 0.8,
  clockSpeedFactor: 0.002,
  defaultSpeed: 30,
  defaultNoise: 10,
  baseFrameRate: 60,
  bufferLength: 2048, // 环形缓冲区长度, 应为2的幂次方以优化性能
  outputNoiseRatio: 0.5,
} as const satisfies SimulationConfig;

/**
 * 波形图布局配置
 */
export const Layout = {
  clkOffset: 20,
  dOffset: 100,
  qOffset: 180,
  scaleY: 30,
  canvasHeight: 300,
  digitalScopeHeight: 150,
  canvasPadding: 32,
  digitalLogicStep: 30,
  waveformLineWidth: 2,
  thresholdLineWidth: 1,
  voltageHeadroom: 2.5,
  labelOffsetX: 6,
  labelOffsetY: 18,
  dashPattern: [5, 5],
  thresholdLabelMargin: 160,
  thresholdLabelAbove: -4,
  thresholdLabelBelow: 12,
  waveformLabelFont: 'bold 14px "Segoe UI", system-ui, sans-serif',
  thresholdLabelFont: '12px "Segoe UI", system-ui, sans-serif',
} as const satisfies LayoutConfig;
