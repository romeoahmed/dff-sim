// @ts-check
/**
 * @file 渲染器：基于 Canvas 的示波器波形绘制
 */

import { Colors } from "./constants.js";

/**
 * 示波器类
 *
 * 负责管理 Canvas 上下文、处理 DPI 缩放以及绘制实时波形
 */
export class Oscilloscope {
  /**
   * 逻辑宽度
   * @type {number}
   */
  width = 0;

  /**
   * 逻辑高度
   * @type {number}
   */
  height = 0;

  /**
   * 数据缓冲区最大长度
   * @type {number}
   */
  bufferLength = 500;

  /**
   * 存储各通道的历史电压数据
   * @type {{d: number[], clk: number[], q: number[]}}
   */
  data = {
    d: new Array(this.bufferLength).fill(0),
    clk: new Array(this.bufferLength).fill(0),
    q: new Array(this.bufferLength).fill(0),
  };

  /**
   * Canvas 元素
   * @type {HTMLCanvasElement}
   */
  canvas;

  /**
   * 绘图上下文
   * @type {CanvasRenderingContext2D}
   */
  ctx;

  /**
   * 初始化示波器实例
   * @param {string} canvasId - DOM 中 Canvas 元素的 ID
   */
  constructor(canvasId) {
    // 获取 Canvas 元素
    const el = document.getElementById(canvasId);
    if (!el) throw new Error(`Canvas element #${canvasId} not found`);
    this.canvas = /** @type {HTMLCanvasElement} */ (el);

    // 获取绘图上下文
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error(`Failed to get 2D context for #${canvasId}`);
    this.ctx = context;

    // 初始化尺寸并绑定窗口变化事件
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  /**
   * 处理 Canvas 的高分屏 (Retina) 适配
   *
   * 调整 canvas.width (物理像素) 与 canvas.style.width (CSS 像素) 的比例
   * @returns {void}
   */
  resize() {
    if (!this.canvas.parentElement) return;

    // 获取父容器尺寸（逻辑像素）
    const parentRect = this.canvas.parentElement.getBoundingClientRect();
    const displayWidth = parentRect.width - 32; // 减去 CSS padding
    const displayHeight = 300;

    // 获取设备像素比
    const dpr = window.devicePixelRatio || 1;

    // 1. 设置 CSS 尺寸
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;

    // 2. 设置 物理缓冲区尺寸
    this.canvas.width = Math.floor(displayWidth * dpr);
    this.canvas.height = Math.floor(displayHeight * dpr);

    // 3. 缩放绘图上下文，使后续绘图指令基于逻辑坐标
    this.ctx.scale(dpr, dpr);

    // 4. 更新内部逻辑宽高
    this.width = displayWidth;
    this.height = displayHeight;
  }

  /**
   * 推入新的电压采样点，并移除最早的数据（FIFO）
   * @param {number} d - 输入 D 电压
   * @param {number} clk - 时钟 CLK 电压
   * @param {number} q - 输出 Q 电压
   * @returns {void}
   */
  pushData(d, clk, q) {
    this.data.d.push(d);
    this.data.clk.push(clk);
    this.data.q.push(q);

    if (this.data.d.length > this.bufferLength) {
      this.data.d.shift();
      this.data.clk.shift();
      this.data.q.shift();
    }
  }

  /**
   * 执行单帧渲染
   * @returns {void}
   */
  draw() {
    // 清除画布 (使用逻辑宽高)
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 绘制电压阈值参考线
    this.drawThresholdLine(1.0, "Input High Threshold (1.0V)");
    this.drawThresholdLine(0.6, "Input Low Threshold (0.6V)");

    // 绘制三条通道波形
    // Y轴偏移量 (Offset) 用于在垂直方向将波形错开
    this.drawWaveform(this.data.clk, Colors.green, 20, "CLK");
    this.drawWaveform(this.data.d, Colors.blue, 100, "D");
    this.drawWaveform(this.data.q, Colors.red, 180, "Q");
  }

  /**
   * 绘制单条波形线
   * @param {number[]} dataArray - 电压数据数组
   * @param {string} color - 线条颜色 Hex
   * @param {number} yOffset - 垂直起始位置偏移
   * @param {string} label - 通道标签
   * @returns {void}
   */
  drawWaveform(dataArray, color, yOffset, label) {
    this.ctx.beginPath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2; // 高分屏下实际渲染为 2 * DPR 像素
    this.ctx.lineJoin = "round";

    const pixelsPerPoint = this.width / this.bufferLength;
    const scaleY = 30; // 1V = 30px 高度

    const ctx = this.ctx;

    for (let i = 0; i < dataArray.length; i++) {
      const x = i * pixelsPerPoint;
      // 坐标变换：Canvas Y轴向下，因此需要 (Base - Value)
      // 2.5V 是预留的顶部余量
      const y = yOffset + 2.5 * scaleY - dataArray[i] * scaleY;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 绘制标签
    ctx.fillStyle = color;
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(label, 5, yOffset + 20);
  }

  /**
   * 绘制虚线阈值参考线
   * @param {number} voltage - 目标电压值
   * @param {string} text - 说明文本
   * @returns {void}
   */
  drawThresholdLine(voltage, text) {
    const scaleY = 30;
    // 计算基于 Input D (yOffset=100) 区域的相对高度
    const y = 100 + 2.5 * scaleY - voltage * scaleY;

    this.ctx.beginPath();
    this.ctx.strokeStyle = "#494d64";
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]); // 虚线模式
    this.ctx.moveTo(0, y);
    this.ctx.lineTo(this.width, y);
    this.ctx.stroke();
    this.ctx.setLineDash([]); // 恢复实线

    this.ctx.fillStyle = "#5b6078";
    this.ctx.font = "10px sans-serif";
    this.ctx.fillText(text, this.width - 150, y - 5);
  }
}
