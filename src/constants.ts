/**
 * 全局配置与常量定义
 */

import type { ColorConfig, VoltageSpecConfig } from "./types";

/**
 * 颜色配置对象
 */
export const Colors = {
  /** 时钟信号颜色 (CLK) */
  green: "#a6da95",

  /** 输入信号颜色 (D) */
  blue: "#8aadf4",

  /** 输出信号颜色 (Q) */
  red: "#ed8796",

  /** 高亮与数值显示 */
  yellow: "#eed49f",

  /** 普通文本 */
  text: "#cad3f5",

  /** 网格线颜色 */
  grid: "#363a4f",

  /** 描边颜色 */
  stroke: "#494d64",

  /** 填充颜色 */
  fill: "#5b6078",
} as const satisfies ColorConfig;

/**
 * 电压物理规范 (单位: 伏特 V)
 */
export const VoltageSpecs = {
  /** 逻辑 1 输入的最低电压阈值 */
  logicHighMin: 1.0,

  /** 逻辑 0 输入的最高电压阈值 */
  logicLowMax: 0.6,

  /** 输出逻辑 1 的最小电压 */
  outputHighMin: 1.8,

  /** 输出逻辑 1 的最大电压 */
  outputHighMax: 2.0,

  /** 输出逻辑 0 的最大电压 */
  outputLowMax: 0.2,

  /** 系统最大供电电压 */
  systemMax: 2.5,
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
