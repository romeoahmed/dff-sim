/**
 * 渲染器：基于 Canvas 的示波器波形绘制
 */

import { Colors, VoltageSpecs, Simulation, Layout } from "./constants";
import type { VoltageData } from "./types";

/**
 * 示波器类
 *
 * 负责管理 Canvas 上下文、处理 DPI 缩放以及绘制实时波形
 */
export class Oscilloscope {
  /**
   * 逻辑宽度
   */
  width: number = 0;

  /**
   * 逻辑高度
   */
  height: number = 0;

  /**
   * 数据缓冲区最大长度
   */
  bufferLength: number = Simulation.bufferLength;

  /**
   * 存储各通道的历史电压数据
   */
  data: VoltageData = {
    d: new Array(this.bufferLength).fill(0),
    clk: new Array(this.bufferLength).fill(0),
    q: new Array(this.bufferLength).fill(0),
  };

  /**
   * Canvas 元素
   */
  canvas: HTMLCanvasElement;

  /**
   * 绘图上下文
   */
  ctx: CanvasRenderingContext2D;

  /**
   * 窗口 resize 事件处理函数的引用
   */
  private _resizeHandler: () => void;

  /**
   * 初始化示波器实例
   * @param canvasId - DOM 中 Canvas 元素的 ID
   */
  constructor(canvasId: string) {
    // 获取 Canvas 元素
    const el = document.getElementById(canvasId);
    if (!el) throw new Error(`Canvas element #${canvasId} not found`);
    if (!(el instanceof HTMLCanvasElement)) {
      throw new Error(`Element #${canvasId} is not a canvas`);
    }
    this.canvas = el;

    // 检查 canvas 是否在 DOM 树中
    if (!this.canvas.parentElement) {
      throw new Error(`Canvas #${canvasId} must be attached to the DOM`);
    }

    // 获取绘图上下文
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error(`Failed to get 2D context for #${canvasId}`);
    this.ctx = context;

    // 初始化尺寸
    this.resize();

    // 绑定窗口变化事件
    this._resizeHandler = () => this.resize();
    window.addEventListener("resize", this._resizeHandler);
  }

  /**
   * 处理 Canvas 的高分屏 (Retina) 适配
   *
   * 调整 canvas.width (物理像素) 与 canvas.style.width (CSS 像素) 的比例
   *
   * @remarks
   * DPI 适配方案参考 AI 辅助建议
   */
  resize() {
    const { canvasHeight, canvasPadding } = Layout;

    if (!this.canvas.parentElement) return;

    // 获取父容器尺寸（逻辑像素）
    const parentRect = this.canvas.parentElement.getBoundingClientRect();
    const displayWidth = parentRect.width - canvasPadding; // 减去 CSS padding
    const displayHeight = canvasHeight;

    // 获取设备像素比
    const dpr = window.devicePixelRatio || 1;

    // 1. 设置 CSS 尺寸
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;

    // 2. 设置 物理缓冲区尺寸
    this.canvas.width = Math.floor(displayWidth * dpr);
    this.canvas.height = Math.floor(displayHeight * dpr);

    // 3. 缩放绘图上下文，使后续绘图指令基于逻辑坐标
    this.ctx.setTransform(1, 0, 0, 1, 0, 0); // 重置 transform，避免多次 resize 导致缩放叠加
    this.ctx.scale(dpr, dpr);

    // 4. 更新内部逻辑宽高
    this.width = displayWidth;
    this.height = displayHeight;
  }

  /**
   * 推入新的电压采样点，并移除最早的数据（FIFO）
   * @param d - 输入 D 电压
   * @param clk - 时钟 CLK 电压
   * @param q - 输出 Q 电压
   */
  pushData(d: number, clk: number, q: number) {
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
   */
  draw() {
    const { dOffset, clkOffset, qOffset } = Layout;

    // 清除画布 (使用逻辑宽高)
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 绘制电压阈值参考线
    this.drawThresholdLine(
      VoltageSpecs.logicHighMin,
      `Input High Threshold (${VoltageSpecs.logicHighMin.toFixed(1)}V)`,
      dOffset,
    ); // 上方 (默认)
    this.drawThresholdLine(
      VoltageSpecs.logicLowMax,
      `Input Low Threshold (${VoltageSpecs.logicLowMax.toFixed(1)}V)`,
      dOffset,
      true,
    ); // 下方

    // 绘制三条通道波形
    // Y轴偏移量 (Offset) 用于在垂直方向将波形错开
    this.drawWaveform(this.data.clk, Colors.clk, clkOffset, "CLK");
    this.drawWaveform(this.data.d, Colors.d, dOffset, "D");
    this.drawWaveform(this.data.q, Colors.q, qOffset, "Q");
  }

  /**
   * 绘制单条波形线
   * @param dataArray - 电压数据数组
   * @param color - 线条颜色 Hex
   * @param yOffset - 垂直起始位置偏移
   * @param label - 通道标签
   */
  drawWaveform(
    dataArray: number[],
    color: string,
    yOffset: number,
    label: string,
  ) {
    const {
      waveformLineWidth,
      voltageHeadroom,
      scaleY,
      labelOffsetX,
      labelOffsetY,
      waveformLabelFont,
    } = Layout;

    this.ctx.beginPath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = waveformLineWidth; // 高分屏下实际渲染为 waveformLineWidth * DPR 像素
    this.ctx.lineJoin = "round";

    const pixelsPerPoint = this.width / this.bufferLength;

    const ctx = this.ctx;

    dataArray.forEach((value, i) => {
      const x = i * pixelsPerPoint;
      // 坐标变换：Canvas Y轴向下，因此需要 (Base - Value)
      // voltageHeadroom 是预留的顶部余量
      const y = yOffset + voltageHeadroom * scaleY - value * scaleY;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 绘制标签
    ctx.fillStyle = color;
    ctx.font = waveformLabelFont;
    ctx.fillText(label, labelOffsetX, Math.round(yOffset + labelOffsetY));
  }

  /**
   * 绘制虚线阈值参考线
   * @param voltage - 目标电压值
   * @param text - 说明文本
   * @param baseOffset - 参考基准线的 Y 轴偏移量
   * @param labelBelow - 标签是否绘制在线下方（默认在上方）
   */
  drawThresholdLine(
    voltage: number,
    text: string,
    baseOffset: number,
    labelBelow: boolean = false,
  ) {
    const {
      scaleY,
      voltageHeadroom,
      dashPattern,
      thresholdLineWidth,
      thresholdLabelBelow,
      thresholdLabelAbove,
      thresholdLabelMargin,
      thresholdLabelFont,
    } = Layout;

    // 计算基于 baseOffset 区域的相对高度
    const y = baseOffset + voltageHeadroom * scaleY - voltage * scaleY;

    this.ctx.beginPath();
    this.ctx.strokeStyle = Colors.stroke;
    this.ctx.lineWidth = thresholdLineWidth;
    this.ctx.setLineDash(dashPattern); // 虚线模式
    this.ctx.moveTo(0, y);
    this.ctx.lineTo(this.width, y);
    this.ctx.stroke();
    this.ctx.setLineDash([]); // 恢复实线

    this.ctx.fillStyle = Colors.fill;
    this.ctx.font = thresholdLabelFont;

    // 上方: y - thresholdLabelBelow，下方: y + thresholdLabelAbove
    const textY = labelBelow
      ? y + thresholdLabelBelow
      : y + thresholdLabelAbove;
    this.ctx.fillText(
      text,
      Math.round(this.width - thresholdLabelMargin),
      Math.round(textY),
    );
  }

  /**
   * 销毁实例，移除事件监听
   */
  destroy() {
    window.removeEventListener("resize", this._resizeHandler);

    // 清空数据缓冲区
    this.data.d.length = 0;
    this.data.clk.length = 0;
    this.data.q.length = 0;
  }
}
