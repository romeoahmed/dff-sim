/**
 * 全局配置与常量定义
 */

import type { ColorConfig, VoltageSpecConfig } from "./types";

/**
 * 颜色配置
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
} as const satisfies VoltageSpecConfig;

/**
 * 仿真参数配置
 */
export const SimulationConfig = {
  /** 最大噪声电压 (V) */
  maxNoiseLevel: 0.8,

  /** 时钟速度系数 */
  clockSpeedFactor: 0.002,

  /** 默认时钟速度 (0-100) */
  defaultSpeed: 30,

  /** 默认噪声 (0-100) */
  defaultNoise: 10,

  /** 基准帧率 (用于物理计算归一化) */
  baseFrameRate: 60,

  /** 波形图各通道的 Y 轴偏移量 (px) */
  layout: {
    clkOffset: 20,
    dOffset: 100,
    qOffset: 180,
    scaleY: 30, // 1V 对应的像素高度
    canvasHeight: 300,
    canvasPadding: 32,
  },
} as const;
