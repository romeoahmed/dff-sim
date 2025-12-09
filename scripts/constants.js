// @ts-check
/**
 * @file 全局配置与常量定义
 */

/**
 * 颜色配置对象
 * @typedef {object} ColorConfig
 * @property {string} green - 时钟信号颜色 (CLK)
 * @property {string} blue - 输入信号颜色 (D)
 * @property {string} red - 输出信号颜色 (Q)
 * @property {string} yellow - 高亮与数值显示
 * @property {string} text - 普通文本
 * @property {string} grid - 网格线颜色
 */

/**
 * @type {ColorConfig}
 */
export const Colors = {
  green: "#a6da95", // CLK
  blue: "#8aadf4", // D
  red: "#ed8796", // Q
  yellow: "#eed49f",
  text: "#cad3f5",
  grid: "#363a4f",
};

/**
 * 电压物理规范 (单位: 伏特 V)
 * @typedef {object} VoltageSpecConfig
 * @property {number} logicHighMin - 逻辑 1 输入的最低电压阈值
 * @property {number} logicLowMax - 逻辑 0 输入的最高电压阈值
 * @property {number} outputHighMin - 输出逻辑 1 的最小电压
 * @property {number} outputHighMax - 输出逻辑 1 的最大电压
 * @property {number} outputLowMax - 输出逻辑 0 的最大电压
 * @property {number} systemMax - 系统最大供电电压
 */

/**
 * @type {VoltageSpecConfig}
 */
export const VoltageSpecs = {
  logicHighMin: 1.0,
  logicLowMax: 0.6,
  outputHighMin: 1.8,
  outputHighMax: 2.0,
  outputLowMax: 0.2,
  systemMax: 2.5,
};
