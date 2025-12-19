/**
 * 示波器渲染器: 使用 PixiJS 进行高性能绘图
 */

import { Container, Graphics, Text, Application } from "pixi.js";
import {
  Colors,
  VoltageSpecs,
  Simulation,
  Layout,
} from "../../../common/constants";
import type { WaveformDataSource, ChannelConfig } from "../../../common/types";
import type { IRenderer } from "./base";

export class StdRenderer implements IRenderer {
  // 舞台
  private waveformStage: Container | null = null;
  private digitalStage: Container | null = null;

  // 容器
  private staticLayer = new Container({ isRenderGroup: true });
  private dynamicLayer = new Container();
  private digitalStaticLayer = new Container({ isRenderGroup: true });
  private digitalDynamicLayer = new Container();
  private staticLabelContainer = new Container();
  private digitalLabelContainer = new Container();

  // 资源
  private waveformGraphics = new Graphics();
  private digitalGraphics = new Graphics();
  private staticGraphics = new Graphics();
  private digitalStaticGraphics = new Graphics();

  // 数据源
  private dataSource: WaveformDataSource | null = null;
  private width = 0;
  private height = 0;
  private digitalHeight = 0;
  private readonly bufferLength = Simulation.bufferLength;

  // 缓存配置
  private readonly waveformConfigs: ChannelConfig[] = [
    { color: Colors.clk, label: "CLK" },
    { color: Colors.d, label: "D" },
    { color: Colors.q, label: "Q" },
  ];
  private readonly digitalConfigs: ChannelConfig[] = [
    { color: Colors.clk, label: "CLK" },
    { color: Colors.d, label: "D" },
    { color: Colors.q, label: "Q" },
  ];

  constructor() {}

  /**
   * 挂载到 Pixi 应用
   * @param appW - 模拟波形 Pixi 应用实例
   * @param appD - 数字波形 Pixi 应用实例
   * @param width - 逻辑宽度
   * @param height - 逻辑高度
   * @param digitalHeight - 数字高度
   */
  attach(
    appW: Application,
    appD: Application,
    width: number,
    height: number,
    digitalHeight: number,
  ) {
    this.waveformStage = appW.stage;
    this.digitalStage = appD.stage;
    this.width = width;
    this.height = height;
    this.digitalHeight = digitalHeight;

    // 1. 组装自己的层级
    this.staticLayer.addChild(this.staticGraphics, this.staticLabelContainer);
    this.dynamicLayer.addChild(this.waveformGraphics);

    this.digitalStaticLayer.addChild(
      this.digitalStaticGraphics,
      this.digitalLabelContainer,
    );
    this.digitalDynamicLayer.addChild(this.digitalGraphics);

    // 2. 挂载到 App 的 Stage 上
    this.waveformStage.addChild(this.staticLayer, this.dynamicLayer);
    this.digitalStage.addChild(
      this.digitalStaticLayer,
      this.digitalDynamicLayer,
    );

    // 3. 初次绘制
    this.redrawStaticElements();
  }

  /**
   * 注入数据源
   * @param source - 波形数据源
   */
  setData(source: WaveformDataSource) {
    if (!this.digitalStage) return;

    this.dataSource = source;
    this.redrawStaticElements();
  }

  /**
   * 响应尺寸变化
   * @param width - 逻辑宽度
   * @param height - 逻辑高度
   * @param digitalHeight - 数字波形逻辑高度
   */
  resize(width: number, height: number, digitalHeight: number) {
    this.width = width;
    this.height = height;
    this.digitalHeight = digitalHeight;
    this.redrawStaticElements();
  }

  /**
   * 卸载资源
   */
  detach() {
    // 1. 从舞台移除
    this.waveformStage?.removeChild(this.staticLayer, this.dynamicLayer);
    this.digitalStage?.removeChild(
      this.digitalStaticLayer,
      this.digitalDynamicLayer,
    );

    // 2. 销毁自己的资源
    this.staticLayer.destroy({ children: true });
    this.dynamicLayer.destroy({ children: true });
    this.digitalStaticLayer.destroy({ children: true });
    this.digitalDynamicLayer.destroy({ children: true });

    // 3. 断开引用
    this.waveformStage = null;
    this.digitalStage = null;
  }

  /**
   * 重绘静态元素 (网格线、标签等)
   */
  redrawStaticElements() {
    // 清理
    const g = this.staticGraphics;
    g.clear();
    this.staticLabelContainer.removeChildren().forEach((c) => c.destroy(true));

    const { dOffset, clkOffset, qOffset } = Layout;

    // 绘制阈值线
    this.drawThreshold(g, VoltageSpecs.logicHighMin, dOffset, false);
    this.drawThreshold(g, VoltageSpecs.logicLowMax, dOffset, true);

    // 绘制标签
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

    // 数字示波器部分
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

      // 分割线
      if (i < this.digitalConfigs.length - 1) {
        const sepY = cy + rowHeight / 2;
        for (let x = 0; x < this.width; x += 6) {
          gd.moveTo(x, sepY).lineTo(Math.min(x + 2, this.width), sepY);
        }
        gd.stroke({
          width: Layout.thresholdLineWidth,
          color: Colors.grid,
          alpha: 1.0,
        });
      }
    });
  }

  /**
   * 绘制模拟波形
   */
  draw() {
    if (!this.dataSource) return;

    const g = this.waveformGraphics;
    g.clear();

    const { dOffset, clkOffset, qOffset } = Layout;
    const { clk, d, q } = this.dataSource;

    // 绘制波形
    this.drawPolyLine(g, clk, Colors.clk, clkOffset);
    this.drawPolyLine(g, d, Colors.d, dOffset);
    this.drawPolyLine(g, q, Colors.q, qOffset);
  }

  /**
   * 绘制数字波形
   */
  drawDigital() {
    if (!this.dataSource) return;

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

  /**
   * 绘制模拟波形折线
   * @param g - Graphics 对象
   * @param data - 数据源
   * @param color - 线条颜色
   * @param yOffset - Y 轴偏移
   */
  private drawPolyLine(
    g: Graphics,
    data: Float32Array,
    color: string,
    yOffset: number,
  ) {
    const { voltageHeadroom, scaleY, waveformLineWidth } = Layout;
    const len = this.bufferLength;
    const ptr = this.dataSource!.writePointer;
    const stepX = this.width / (len - 1);
    const baseY = yOffset + voltageHeadroom * scaleY;

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
    g.stroke({
      width: waveformLineWidth,
      color,
      join: "round",
      cap: "round",
      alpha: 1.0,
    });
  }

  /**
   * 绘制数字波形折线
   * @param g - Graphics 对象
   * @param data - 数据源
   * @param color - 线条颜色
   * @param step - 步长
   * @param centerY - 中心 Y 坐标
   */
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
    const stepX = this.width / (len - 1);
    const yHigh = centerY - step / 2;
    const yLow = centerY + step / 2;

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

    // 提交绘制
    g.stroke({ width: Layout.waveformLineWidth, color, join: "round" });
  }

  /**
   * 绘制阈值线
   * @param g - Graphics 对象
   * @param val - 阈值电压
   * @param offset - Y 轴偏移
   * @param below - 是否为低电平阈值
   */
  private drawThreshold(
    g: Graphics,
    val: number,
    offset: number,
    below: boolean,
  ) {
    const { scaleY, voltageHeadroom, dashPattern, thresholdLineWidth } = Layout;
    const y = offset + voltageHeadroom * scaleY - val * scaleY;

    g.beginPath();
    // 绘制虚线
    const [dash, gap] = dashPattern;
    for (let x = 0; x < this.width; x += dash + gap) {
      g.moveTo(x, y).lineTo(Math.min(x + dash, this.width), y);
    }
    g.stroke({ width: thresholdLineWidth, color: Colors.stroke, alpha: 1.0 });

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

  /**
   * 绘制通道标签
   * @param container - 容器
   * @param str - 标签文本
   * @param color - 文字颜色
   * @param yOffset - Y 轴偏移
   */
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
}
