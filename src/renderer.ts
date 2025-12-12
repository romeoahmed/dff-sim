/**
 * 渲染器：基于 Canvas 的示波器波形绘制
 */

import { Colors, VoltageSpecs, Simulation, Layout } from "./constants";
import type { WaveformDataSource, DigitalChannelConfig } from "./types";

/**
 * 示波器类
 *
 * 负责管理 Canvas 上下文、处理 DPI 缩放以及绘制实时波形
 */
export class Oscilloscope {
  /**
   * 逻辑宽度
   */
  private width: number = 0;

  /**
   * 逻辑高度
   */
  private height: number = 0;

  /**
   * 数据缓冲区最大长度
   */
  private bufferLength: number = Simulation.bufferLength;

  /**
   * 数据源
   */
  private dataSource: WaveformDataSource | null = null;

  /**
   * Canvas 元素
   */
  canvas: HTMLCanvasElement;

  /**
   * 绘图上下文
   */
  ctx: CanvasRenderingContext2D;

  /**
   * 数字逻辑视图 Canvas 元素
   */
  digitalCanvas: HTMLCanvasElement;

  /**
   * 数字逻辑视图绘图上下文
   */
  digitalCtx: CanvasRenderingContext2D;

  /**
   * 数字通道配置缓存
   * 避免在 drawDigital 中重复创建对象
   */
  private digitalChannels: DigitalChannelConfig[];

  /**
   * 监听父容器大小变化的观察者
   */
  private observer: ResizeObserver;

  /**
   * 初始化示波器实例
   * @param canvasId - DOM 中 Canvas 元素的 ID
   * @param digitalCanvasId - DOM 中数字逻辑视图 Canvas 元素的 ID
   */
  constructor(canvasId: string, digitalCanvasId: string) {
    // 辅助函数：获取并验证 Canvas 元素
    const getCanvas = (id: string) => {
      const el = document.getElementById(id);
      if (!(el instanceof HTMLCanvasElement))
        throw new Error(`#${id} not canvas`);
      return el;
    };

    this.canvas = getCanvas(canvasId);
    this.ctx = this.canvas.getContext("2d")!;

    this.digitalCanvas = getCanvas(digitalCanvasId);
    this.digitalCtx = this.digitalCanvas.getContext("2d")!;

    // 初始化数字通道配置
    this.digitalChannels = [];

    // 初始化尺寸
    this.resize();

    // 创建 ResizeObserver
    // parentElement 尺寸变化时触发
    this.observer = new ResizeObserver(() => {
      this.resize();
    });

    // 开始监听父容器
    if (this.canvas.parentElement) {
      this.observer.observe(this.canvas.parentElement);
    }
  }

  setData(source: WaveformDataSource) {
    this.dataSource = source;

    // 更新数字通道配置的引用
    this.digitalChannels = [
      { data: source.clk, color: Colors.clk, label: "CLK" },
      { data: source.d, color: Colors.d, label: "D" },
      { data: source.q, color: Colors.q, label: "Q" },
    ];
  }

  /**
   * 辅助方法：更新 Canvas 尺寸与缩放
   * @param canvas - Canvas 元素
   * @param ctx - 绘图上下文
   * @param width - 逻辑宽度 (CSS 像素)
   * @param height - 逻辑高度 (CSS 像素)
   * @param dpr - 设备像素比
   */
  private updateCanvasSize(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dpr: number,
  ) {
    // 设置 CSS 尺寸
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // 设置物理缓冲区尺寸
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    // 缩放绘图上下文
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    // 偏移 0.5 像素以获得更清晰的 1px 线条 (全局)
    ctx.translate(0.5, 0.5);
  }

  /**
   * 处理 Canvas 的高分屏 (Retina) 适配
   *
   * 调整 canvas.width (物理像素) 与 canvas.style.width (CSS 像素) 的比例
   *
   * @remarks
   * DPI 适配方案参考 AI 辅助建议
   */
  private resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const { canvasHeight, digitalScopeHeight, canvasPadding } = Layout;

    // 获取父容器尺寸（逻辑像素）
    const rect = parent.getBoundingClientRect();
    const w = rect.width - canvasPadding; // 减去 CSS padding

    // 获取设备像素比
    const dpr = window.devicePixelRatio || 1;

    // 更新内部逻辑宽高
    this.width = w;
    this.height = canvasHeight;

    // 更新模拟示波器
    this.updateCanvasSize(this.canvas, this.ctx, w, canvasHeight, dpr);
    // 更新数字示波器
    this.updateCanvasSize(
      this.digitalCanvas,
      this.digitalCtx,
      w,
      digitalScopeHeight,
      dpr,
    );
  }

  /**
   * 推入新的电压采样点，并移除最早的数据 (Ring Buffer)
   * @param d - 输入 D 电压
   * @param clk - 时钟 CLK 电压
   * @param q - 输出 Q 电压
   */
  // pushData(d: number, clk: number, q: number) {
  //   // 直接覆盖当前位置
  //   this.data.d[this.writePointer] = d;
  //   this.data.clk[this.writePointer] = clk;
  //   this.data.q[this.writePointer] = q;

  //   // 指针后移，如果到了末尾则自动回到 0
  //   // 指针回绕优化：使用位运算 & 代替 %
  //   // 前提：this.bufferLength 必须是 2 的幂 (256, 512, 1024, 2048...)
  //   // 1024 的二进制是 10000000000
  //   // 1023 的二进制是 01111111111 (掩码)
  //   // 任何数 & 1023，结果一定在 0~1023 之间
  //   // this.writePointer = (this.writePointer + 1) % this.bufferLength;
  //   this.writePointer = (this.writePointer + 1) & (this.bufferLength - 1);
  // }

  /**
   * 执行单帧渲染
   */
  draw() {
    if (!this.dataSource) return;

    const { dOffset, clkOffset, qOffset } = Layout;

    // 清除画布 (覆盖整个逻辑区域)
    this.ctx.clearRect(-0.5, -0.5, this.width + 1, this.height + 1);

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
    this.drawWaveform(this.dataSource.clk, Colors.clk, clkOffset, "CLK");
    this.drawWaveform(this.dataSource.d, Colors.d, dOffset, "D");
    this.drawWaveform(this.dataSource.q, Colors.q, qOffset, "Q");
  }

  /**
   * 绘制数字逻辑视图
   * 改进点：动态布局、路径优化（减少 lineTo 调用）、代码解耦
   */
  drawDigital() {
    const {
      digitalScopeHeight,
      waveformLineWidth,
      waveformLabelFont,
      labelOffsetX,
      digitalLogicStep, // 波形的高低电平高度差 (像素)
    } = Layout;

    const ctx = this.digitalCtx;
    const w = this.width;
    const h = digitalScopeHeight;

    // 1. 清空画布
    ctx.clearRect(-0.5, -0.5, w + 1, h + 1);

    // 2. 配置通道数据
    const channels = this.digitalChannels;

    // 3. 动态计算行高
    const channelCount = channels.length;
    // 每一行分配的高度
    const rowHeight = h / channelCount;

    // 4. 绘制每个通道
    channels.forEach((ch, index) => {
      // 计算当前通道的基准 Y 坐标 (垂直居中)
      // 例如：第一行中心在 rowHeight * 0.5，第二行在 rowHeight * 1.5
      const centerY = rowHeight * index + rowHeight / 2;

      // 保存上下文状态，使用 translate 简化坐标计算
      ctx.save();

      // 将坐标原点移动到当前通道的垂直中心
      ctx.translate(0, centerY);

      // --- 绘制波形 ---
      this.drawDigitalChannelPath(
        ctx,
        ch.data,
        ch.color,
        w,
        digitalLogicStep,
        waveformLineWidth,
      );

      // --- 绘制标签 ---
      ctx.fillStyle = ch.color;
      ctx.font = waveformLabelFont;
      ctx.textBaseline = "middle"; // 文字垂直居中
      ctx.fillText(ch.label, labelOffsetX, 0);

      // 绘制分隔虚线
      if (index < channelCount - 1) {
        ctx.strokeStyle = Colors.grid;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        const separatorY = Math.floor(rowHeight / 2); // 取整保证清晰
        ctx.moveTo(0, separatorY);
        ctx.lineTo(w, separatorY);
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  /**
   * 辅助方法：绘制单个数字通道路径
   * 核心优化：仅在电平发生变化（Edge）时才绘制线段，大幅减少绘图指令
   * @param ctx - Canvas 绘图上下文
   * @param data - 电压数据数组
   * @param color - 线条颜色 Hex
   * @param width - 画布宽度 (逻辑像素)
   * @param logicStep - 高低电平垂直跨度 (像素)
   * @param lineWidth - 线条宽度 (像素)
   */
  private drawDigitalChannelPath(
    ctx: CanvasRenderingContext2D,
    data: Float32Array,
    color: string,
    width: number,
    logicStep: number,
    lineWidth: number,
  ) {
    if (data.length === 0 || !this.dataSource) return;

    const len = this.bufferLength;
    const ptr = this.dataSource.writePointer;
    const threshold = VoltageSpecs.logicHighMin;
    const pixelsPerPoint = width / len;

    // 计算 Y 轴偏移量：高电平向上(-)，低电平向下(+)
    // 假设 logicStep 是总高度，那么半高是 logicStep/2
    const yHigh = -logicStep / 2;
    const yLow = logicStep / 2;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";

    // 精确获取起点的 Y 值
    const startLogic = data[ptr]! > threshold;
    const startY = startLogic ? yHigh : yLow;

    // 记录上一次的逻辑状态，用于判断跳变
    let lastLogic = startLogic;
    let currentY = startY;

    ctx.moveTo(0, currentY);

    let logicalIdx = 0;

    // --- 第一段循环：从 ptr 到 数组末尾 (旧数据) ---
    for (let i = ptr; i < len; i++) {
      const isHigh = data[i]! > threshold;
      if (isHigh !== lastLogic) {
        const x = logicalIdx * pixelsPerPoint;
        const newY = isHigh ? yHigh : yLow;
        ctx.lineTo(x, currentY);
        ctx.lineTo(x, newY);

        lastLogic = isHigh;
        currentY = newY;
      }
      logicalIdx++;
    }

    // --- 第二段循环：从 0 到 ptr (新数据) ---
    for (let i = 0; i < ptr; i++) {
      const isHigh = data[i]! > threshold;
      if (isHigh !== lastLogic) {
        const x = logicalIdx * pixelsPerPoint;
        const newY = isHigh ? yHigh : yLow;
        ctx.lineTo(x, currentY);
        ctx.lineTo(x, newY);

        lastLogic = isHigh;
        currentY = newY;
      }
      logicalIdx++;
    }

    // 绘制最后一段横线到底
    ctx.lineTo(width, currentY);
    ctx.stroke();
  }

  /**
   * 绘制单条波形线
   * @param dataArray - 电压数据数组
   * @param color - 线条颜色 Hex
   * @param yOffset - 垂直起始位置偏移
   * @param label - 通道标签
   */
  private drawWaveform(
    dataArray: Float32Array,
    color: string,
    yOffset: number,
    label: string,
  ) {
    if (dataArray.length === 0 || !this.dataSource) return;

    const {
      waveformLineWidth,
      scaleY,
      labelOffsetX,
      labelOffsetY,
      waveformLabelFont,
      voltageHeadroom,
    } = Layout;

    const ctx = this.ctx;
    const len = this.bufferLength;
    const ptr = this.dataSource.writePointer;

    const baseY = yOffset + voltageHeadroom * scaleY;
    const pixelsPerPoint = this.width / len;

    this.ctx.beginPath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = waveformLineWidth; // 高分屏下实际渲染为 waveformLineWidth * DPR 像素
    this.ctx.lineJoin = "round";

    let logicalIndex = 0; // 记录这是第几个点 (时间维度)

    // --- 第一段：从 指针 -> 数组末尾 ---
    for (let i = ptr; i < len; i++) {
      const x = logicalIndex * pixelsPerPoint;
      const y = baseY - dataArray[i]! * scaleY;
      if (logicalIndex === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      logicalIndex++;
    }

    // --- 第二段：从 数组开头 -> 指针 ---
    for (let i = 0; i < ptr; i++) {
      const x = logicalIndex * pixelsPerPoint;
      const y = baseY - dataArray[i]! * scaleY;
      ctx.lineTo(x, y);
      logicalIndex++;
    }

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
  private drawThresholdLine(
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
    // 断开 ResizeObserver 监听
    this.observer.disconnect();

    // 清空数据源引用
    this.dataSource = null;

    // 清空数字通道配置缓存
    this.digitalChannels = [];
  }
}
