/**
 * 全局配置与常量定义
 */

import type {
  ColorConfig,
  SimulationConfigType,
  VoltageSpecConfig,
} from "./types";

/**
 * 颜色配置 (Catppuccin Macchiato)
 * @see https://github.com/catppuccin/palette
 */
export const Colors = {
  green: "#a6da95",
  blue: "#8aadf4",
  red: "#ed8796",
  yellow: "#eed49f",
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
  smoothingFactor: 0.5,
  outputSmoothingFactor: 0.8,
} as const satisfies VoltageSpecConfig;

/**
 * 仿真参数配置
 */
export const SimulationConfig = {
  maxNoiseLevel: 0.8,
  clockSpeedFactor: 0.002,
  defaultSpeed: 30,
  defaultNoise: 10,
  baseFrameRate: 60,
  bufferLength: 500,
  outputNoiseRatio: 0.5,
  layout: {
    clkOffset: 20,
    dOffset: 100,
    qOffset: 180,
    scaleY: 30,
    canvasHeight: 300,
    canvasPadding: 32,
    waveformLineWidth: 2,
    thresholdLineWidth: 1,
    voltageHeadroom: 2.5,
    labelOffsetX: 6,
    labelOffsetY: 18,
    dashPattern: [5, 5],
    thresholdLabelMargin: 160,
    thresholdLabelAbove: -4,
    thresholdLabelBelow: 12,
  },
} as const satisfies SimulationConfigType;
