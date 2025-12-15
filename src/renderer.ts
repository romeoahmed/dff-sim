/**
 * 示波器渲染器: 使用 PixiJS 进行高性能绘图
 */

import {
  Application,
  Container,
  Graphics,
  Text,
  DOMAdapter,
  WebWorkerAdapter,
} from "pixi.js";
import { Colors, VoltageSpecs, Simulation, Layout } from "./constants";
import type { WaveformDataSource, ChannelConfig } from "./types";

// 注册 Web Worker 适配器
DOMAdapter.set(WebWorkerAdapter);

export class Oscilloscope {
  private app: Application | null = null;
  private digitalApp: Application | null = null;

  // 容器与画笔
  private staticLayer = new Container({ isRenderGroup: true });
  private dynamicLayer = new Container();
  private digitalStaticLayer = new Container({ isRenderGroup: true });
  private digitalDynamicLayer = new Container();

  private staticLabelContainer = new Container();
  private digitalLabelContainer = new Container();

  // 复用 Graphics 实例
  private waveformGraphics = new Graphics();
  private digitalGraphics = new Graphics();
  private staticGraphics = new Graphics();
  private digitalStaticGraphics = new Graphics();

  // 配置与数据
  private waveformConfigs: ChannelConfig[] = [];
  private digitalConfigs: ChannelConfig[] = [];
  private dataSource: WaveformDataSource | null = null;

  // 状态
  private isInitialized = false;
  private width = 0;
  private height = 0;
  private digitalHeight = 0;
  private readonly bufferLength = Simulation.bufferLength;

  constructor() {}

  setData(source: WaveformDataSource) {
    this.dataSource = source;
    // 静态配置
    this.waveformConfigs = [
      { color: Colors.clk, label: "CLK" },
      { color: Colors.d, label: "D" },
      { color: Colors.q, label: "Q" },
    ];
    this.digitalConfigs = [
      { color: Colors.clk, label: "CLK" },
      { color: Colors.d, label: "D" },
      { color: Colors.q, label: "Q" },
    ];

    if (this.isInitialized) {
      this.redrawStaticElements();
    }
  }

  async init(
    canvasWaveform: OffscreenCanvas,
    canvasDigital: OffscreenCanvas,
    width: number,
    height: number,
    digitalHeight: number,
    dpr: number,
  ) {
    this.width = width;
    this.height = height;
    this.digitalHeight = digitalHeight;

    // 初始化 PixiJS 应用
    const appConfig = {
      resolution: dpr,
      backgroundAlpha: 0,
      preference: "webgpu" as const,
      antialias: true,
      autoStart: false,
    };

    this.app = new Application();
    await this.app.init({
      ...appConfig,
      canvas: canvasWaveform,
      width,
      height,
    });

    this.digitalApp = new Application();
    await this.digitalApp.init({
      ...appConfig,
      canvas: canvasDigital,
      width,
      height: digitalHeight,
    });

    // 组装 Stage
    this.staticLayer.addChild(this.staticGraphics, this.staticLabelContainer);
    this.app.stage.addChild(this.staticLayer, this.dynamicLayer);
    this.dynamicLayer.addChild(this.waveformGraphics);

    this.digitalStaticLayer.addChild(
      this.digitalStaticGraphics,
      this.digitalLabelContainer,
    );
    this.digitalApp.stage.addChild(
      this.digitalStaticLayer,
      this.digitalDynamicLayer,
    );
    this.digitalDynamicLayer.addChild(this.digitalGraphics);

    this.isInitialized = true;
    this.redrawStaticElements();
  }

  resize(width: number, height: number, digitalHeight: number, dpr: number) {
    if (!this.isInitialized || !this.app || !this.digitalApp) return;
    this.width = width;
    this.height = height;
    this.digitalHeight = digitalHeight;

    // 重新调整尺寸
    this.app.renderer.resize(width, height, dpr);
    this.digitalApp.renderer.resize(width, digitalHeight, dpr);

    // 重新绘制静态元素
    this.redrawStaticElements();
  }

  // --- 静态绘制 (低频) ---
  redrawStaticElements() {
    if (!this.isInitialized) return;

    // 清理
    const g = this.staticGraphics;
    g.clear();
    this.staticLabelContainer.removeChildren().forEach((c) => c.destroy(true));

    const { dOffset, clkOffset, qOffset } = Layout;
    this.drawThreshold(g, VoltageSpecs.logicHighMin, dOffset, false);
    this.drawThreshold(g, VoltageSpecs.logicLowMax, dOffset, true);

    const drawLabels = (
      container: Container,
      configs: ChannelConfig[],
      offsets: number[],
    ) => {
      configs.forEach((conf, i) => {
        this.drawLabel(container, conf.label, conf.color, offsets[i]!);
      });
    };
    drawLabels(this.staticLabelContainer, this.waveformConfigs, [
      clkOffset,
      dOffset,
      qOffset,
    ]);

    // 数字层静态
    const gd = this.digitalStaticGraphics;
    gd.clear();
    this.digitalLabelContainer.removeChildren().forEach((c) => c.destroy(true));

    const rowHeight = this.digitalHeight / this.digitalConfigs.length;
    this.digitalConfigs.forEach((conf, i) => {
      const cy = rowHeight * i + rowHeight / 2;

      const text = new Text({
        text: conf.label,
        style: {
          fontFamily: "Segoe UI",
          fontSize: 14,
          fontWeight: "bold",
          fill: conf.color,
        },
        anchor: { x: 0, y: 0.5 }, // 垂直居中
        x: Layout.labelOffsetX,
        y: cy,
      });
      this.digitalLabelContainer.addChild(text);

      if (i < this.digitalConfigs.length - 1) {
        const sepY = cy + rowHeight / 2;
        gd.stroke({
          width: Layout.thresholdLineWidth,
          color: Colors.grid,
          alpha: 1.0,
        });
        // 虚线
        for (let x = 0; x < this.width; x += 6) {
          gd.moveTo(x, sepY).lineTo(Math.min(x + 2, this.width), sepY);
        }
        gd.stroke();
      }
    });
  }

  // --- 动态绘制 (高频 - 每帧调用) ---
  draw() {
    if (!this.isInitialized || !this.dataSource) return;

    const g = this.waveformGraphics;
    g.clear();

    const { dOffset, clkOffset, qOffset } = Layout;
    const { clk, d, q } = this.dataSource;

    // 绘制波形
    this.drawPolyLine(g, clk, Colors.clk, clkOffset);
    this.drawPolyLine(g, d, Colors.d, dOffset);
    this.drawPolyLine(g, q, Colors.q, qOffset);
  }

  drawDigital() {
    if (!this.isInitialized || !this.dataSource) return;

    const g = this.digitalGraphics;
    g.clear();

    const { digitalLogicStep } = Layout;
    const rowHeight = this.digitalHeight / 3;
    const { clk, d, q } = this.dataSource;

    // 绘制数字波形
    this.drawDigitalLine(g, clk, Colors.clk, digitalLogicStep, rowHeight * 0.5);
    this.drawDigitalLine(g, d, Colors.d, digitalLogicStep, rowHeight * 1.5);
    this.drawDigitalLine(g, q, Colors.q, digitalLogicStep, rowHeight * 2.5);
  }

  private drawPolyLine(
    g: Graphics,
    data: Float32Array,
    color: string,
    yOffset: number,
  ) {
    const { voltageHeadroom, scaleY, waveformLineWidth } = Layout;
    const len = this.bufferLength;
    const ptr = this.dataSource!.writePointer;
    const stepX = this.width / len;
    const baseY = yOffset + voltageHeadroom * scaleY;

    // 设置一次样式
    g.stroke({
      width: waveformLineWidth,
      color,
      join: "round",
      cap: "round",
      alpha: 1.0,
    });
    g.beginPath();

    let x = 0;
    // 双循环遍历 Ring Buffer
    for (let i = ptr; i < len; i++) {
      const y = baseY - data[i]! * scaleY;
      if (i === ptr) g.moveTo(x, y);
      else g.lineTo(x, y);
      x += stepX;
    }
    for (let i = 0; i < ptr; i++) {
      const y = baseY - data[i]! * scaleY;
      g.lineTo(x, y);
      x += stepX;
    }
    g.stroke();
  }

  // 绘制数字波形 (方波)
  private drawDigitalLine(
    g: Graphics,
    data: Float32Array,
    color: string,
    step: number,
    centerY: number,
  ) {
    const len = this.bufferLength;
    const ptr = this.dataSource!.writePointer;
    const threshold = VoltageSpecs.logicHighMin;
    const stepX = this.width / len;
    const yHigh = centerY - step / 2;
    const yLow = centerY + step / 2;

    g.stroke({ width: Layout.waveformLineWidth, color, join: "round" });
    g.beginPath();

    let lastLogic = data[ptr]! > threshold;
    let curY = lastLogic ? yHigh : yLow;

    // 起点
    g.moveTo(0, curY);

    let x = 0;
    const process = (val: number) => {
      const isHigh = val > threshold;
      if (isHigh !== lastLogic) {
        const nextY = isHigh ? yHigh : yLow;
        g.lineTo(x, curY); // 水平
        g.lineTo(x, nextY); // 垂直 (方波特性)
        lastLogic = isHigh;
        curY = nextY;
      }
      x += stepX;
    };

    for (let i = ptr; i < len; i++) process(data[i]!);
    for (let i = 0; i < ptr; i++) process(data[i]!);

    // 收尾
    g.lineTo(this.width, curY);
    g.stroke();
  }

  // 绘制阈值线
  private drawThreshold(
    g: Graphics,
    val: number,
    offset: number,
    below: boolean,
  ) {
    const { scaleY, voltageHeadroom, dashPattern, thresholdLineWidth } = Layout;
    const y = offset + voltageHeadroom * scaleY - val * scaleY;

    g.stroke({ width: thresholdLineWidth, color: Colors.stroke, alpha: 1.0 });

    // 绘制虚线
    const [dash, gap] = dashPattern;
    for (let x = 0; x < this.width; x += dash + gap) {
      g.moveTo(x, y).lineTo(Math.min(x + dash, this.width), y);
    }
    g.stroke();

    // 绘制标签
    const label = below
      ? `Low Level (${val.toFixed(1)}V)`
      : `High Level (${val.toFixed(1)}V)`;
    const textY =
      y + (below ? Layout.thresholdLabelBelow : Layout.thresholdLabelAbove);

    const text = new Text({
      text: label,
      style: { fontFamily: "Segoe UI", fontSize: 12, fill: Colors.fill },
      anchor: { x: 1, y: below ? 0 : 1 }, // 右对齐
      x: this.width - Layout.thresholdLabelMargin,
      y: textY,
    });
    this.staticLabelContainer.addChild(text);
  }

  // 绘制通道标签
  private drawLabel(
    container: Container,
    str: string,
    color: string,
    yOffset: number,
  ) {
    const text = new Text({
      text: str,
      style: {
        fontFamily: "Segoe UI",
        fontSize: 14,
        fontWeight: "bold",
        fill: color,
      },
      anchor: { x: 0, y: 0.5 }, // 垂直居中
      x: Layout.labelOffsetX,
      y: Layout.labelOffsetY + yOffset,
    });
    container.addChild(text);
  }

  render() {
    if (!this.isInitialized || !this.app || !this.digitalApp) return;
    this.app.renderer.render(this.app.stage);
    this.digitalApp.renderer.render(this.digitalApp.stage);
  }

  destroy() {
    this.isInitialized = false;
    this.app?.destroy(true, true);
    this.digitalApp?.destroy(true, true);
    this.app = null;
    this.digitalApp = null;
    this.dataSource = null;
  }
}
