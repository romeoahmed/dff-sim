/**
 * renderer.ts
 * 基于 PixiJS v8 MeshRope 的高性能示波器渲染器
 */

import {
  Application,
  Container,
  Graphics,
  Text,
  Color,
  MeshRope,
  Texture,
  Point,
  DOMAdapter,
  WebWorkerAdapter,
} from "pixi.js";
import { Colors, VoltageSpecs, Simulation, Layout } from "./constants";
import type { WaveformDataSource } from "./types";

// 使用 Web Worker 适配器
DOMAdapter.set(WebWorkerAdapter);

/**
 * 渲染资源 (GPU 相关)
 */
interface ChannelRenderResource {
  rope: MeshRope;
  points: Point[];
}

/**
 * 通道配置 (元数据)
 */
interface ChannelConfig {
  color: string;
  label: string;
}

export class Oscilloscope {
  private app: Application | null = null;
  private digitalApp: Application | null = null;

  // 容器
  private staticLayer = new Container();
  private dynamicLayer = new Container();
  private digitalStaticLayer = new Container({ isRenderGroup: true });
  private digitalDynamicLayer = new Container({ isRenderGroup: true });

  // 文字容器 (用于批量销毁文字)
  private staticLabelContainer = new Container();
  private digitalLabelContainer = new Container();

  // 静态绘图画笔 (避免重复创建)
  private staticGraphics = new Graphics();
  private digitalStaticGraphics = new Graphics();

  // --- 资源与配置分离 ---
  // 配置：存储颜色、标签 (由 setData 设置)
  private waveformConfigs: ChannelConfig[] = [];
  private digitalConfigs: ChannelConfig[] = [];

  // 资源：存储 Pixi 对象 (由 init 创建)
  private waveformResources: ChannelRenderResource[] = [];
  private digitalResources: ChannelRenderResource[] = [];

  private dataSource: WaveformDataSource | null = null;

  private isInitialized: boolean = false;
  private width: number = 0;
  private height: number = 0;
  private digitalHeight: number = 0;
  private readonly bufferLength: number = Simulation.bufferLength;

  // 纹理缩放计算
  private readonly waveformLineWidth = Layout.waveformLineWidth;
  private readonly textureBaseHeight = 16; // Texture.WHITE 默认高度
  private get ropeScaleY() {
    return this.waveformLineWidth / this.textureBaseHeight;
  }

  constructor() {}

  /**
   * 绑定数据源与配置
   */
  setData(source: WaveformDataSource) {
    this.dataSource = source;

    // 1. 保存配置 (颜色/标签)
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

    // 2. 如果资源已经初始化 (比如运行时切换数据源)，需要立即应用颜色
    if (this.isInitialized) {
      this.applyStyles();
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

    const appConfig = {
      resolution: dpr,
      backgroundAlpha: 0,
      preference: "webgpu" as const,
      antialias: true,
      autoStart: false, // 手动渲染
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

    // 组装场景
    this.staticLayer.addChild(this.staticGraphics, this.staticLabelContainer);
    this.app.stage.addChild(this.staticLayer, this.dynamicLayer);

    this.digitalStaticLayer.addChild(
      this.digitalStaticGraphics,
      this.digitalLabelContainer,
    );
    this.digitalApp.stage.addChild(
      this.digitalStaticLayer,
      this.digitalDynamicLayer,
    );

    // 初始化渲染资源
    this.initMeshResources();

    this.isInitialized = true;

    // 应用颜色配置并绘制静态 UI
    this.applyStyles();
    this.redrawStaticElements();
  }

  /**
   * 创建 MeshRope 和 Point 对象
   */
  private initMeshResources() {
    // 辅助函数
    const createResource = (layer: Container): ChannelRenderResource => {
      const points = Array.from(
        { length: this.bufferLength },
        () => new Point(0, 0),
      );

      const rope = new MeshRope({
        texture: Texture.WHITE,
        points: points,
      });

      // Y 轴 scale 控制线宽
      rope.scale.set(1, this.ropeScaleY);

      layer.addChild(rope);
      return { rope, points };
    };

    // 创建资源，不包含颜色信息
    this.waveformResources = [
      createResource(this.dynamicLayer),
      createResource(this.dynamicLayer),
      createResource(this.dynamicLayer),
    ];

    this.digitalResources = [
      createResource(this.digitalDynamicLayer),
      createResource(this.digitalDynamicLayer),
      createResource(this.digitalDynamicLayer),
    ];
  }

  /**
   * 将 Config 中的颜色应用到 Resource 上
   *
   * 修复了颜色被覆盖重置的 Bug
   */
  private applyStyles() {
    const apply = (res: ChannelRenderResource[], conf: ChannelConfig[]) => {
      res.forEach((item, i) => {
        if (conf[i]) {
          item.rope.tint = new Color(conf[i].color);
        }
      });
    };

    apply(this.waveformResources, this.waveformConfigs);
    apply(this.digitalResources, this.digitalConfigs);
  }

  resize(width: number, height: number, digitalHeight: number, dpr: number) {
    if (!this.isInitialized || !this.app || !this.digitalApp) return;

    this.width = width;
    this.height = height;
    this.digitalHeight = digitalHeight;

    this.app.renderer.resize(width, height, dpr);
    this.digitalApp.renderer.resize(width, digitalHeight, dpr);

    // 更新 MeshRope 点的 X 轴分布
    const updateX = (resources: ChannelRenderResource[]) => {
      const stepX = width / (this.bufferLength - 1);
      for (const res of resources) {
        for (let i = 0; i < this.bufferLength; i++) {
          res.points[i]!.x = i * stepX;
        }
      }
    };

    updateX(this.waveformResources);
    updateX(this.digitalResources);

    this.redrawStaticElements();
  }

  redrawStaticElements() {
    if (!this.isInitialized) return;

    // --- 模拟示波器静态层 ---
    const g = this.staticGraphics;
    g.clear();

    // 彻底销毁旧文字
    this.staticLabelContainer
      .removeChildren()
      .forEach((child) => child.destroy(true));

    this.staticLayer.addChild(g);
    const { dOffset, clkOffset, qOffset } = Layout;

    this.drawThreshold(g, VoltageSpecs.logicHighMin, dOffset, false);
    this.drawThreshold(g, VoltageSpecs.logicLowMax, dOffset, true);

    // 使用 Config 里的数据绘制标签
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

    // --- 数字示波器静态层 ---
    const gd = this.digitalStaticGraphics;
    gd.clear();

    // 彻底销毁旧文字
    this.digitalLabelContainer
      .removeChildren()
      .forEach((child) => child.destroy(true));

    this.digitalStaticLayer.addChild(gd);
    const rowHeight = this.digitalHeight / this.digitalConfigs.length;

    this.digitalConfigs.forEach((conf, i) => {
      const cy = rowHeight * i + rowHeight / 2;

      // 标签
      const text = new Text({
        text: conf.label,
        style: {
          fontFamily: "Segoe UI",
          fontSize: 14,
          fontWeight: "bold",
          fill: conf.color,
        },
        anchor: { x: 0, y: 0.5 },
        x: Layout.labelOffsetX,
        y: cy,
      });
      this.digitalLabelContainer.addChild(text);

      // 分隔线
      if (i < this.digitalConfigs.length - 1) {
        const sepY = cy + rowHeight / 2;
        gd.stroke({ width: 1, color: Colors.grid, alpha: 1.0 });
        const [dash, gap] = Layout.dashPattern;
        for (let x = 0; x < this.width; x += dash + gap) {
          gd.moveTo(x, sepY).lineTo(Math.min(x + dash, this.width), sepY);
        }
        gd.stroke();
      }
    });
  }

  draw() {
    if (!this.isInitialized || !this.dataSource) return;

    const { dOffset, clkOffset, qOffset } = Layout;
    const { clk, d, q } = this.dataSource;

    // 更新模拟波形
    this.updateRopePoints(this.waveformResources[0]!, clk, clkOffset);
    this.updateRopePoints(this.waveformResources[1]!, d, dOffset);
    this.updateRopePoints(this.waveformResources[2]!, q, qOffset);
  }

  drawDigital() {
    if (!this.isInitialized || !this.dataSource) return;

    const { digitalLogicStep } = Layout;
    const rowHeight = this.digitalHeight / 3;
    const { clk, d, q } = this.dataSource;

    // 更新数字波形
    this.updateDigitalRope(
      this.digitalResources[0]!,
      clk,
      digitalLogicStep,
      rowHeight * 0.5,
    );
    this.updateDigitalRope(
      this.digitalResources[1]!,
      d,
      digitalLogicStep,
      rowHeight * 1.5,
    );
    this.updateDigitalRope(
      this.digitalResources[2]!,
      q,
      digitalLogicStep,
      rowHeight * 2.5,
    );
  }

  private updateRopePoints(
    res: ChannelRenderResource,
    data: Float32Array,
    yOffset: number,
  ) {
    const { voltageHeadroom, scaleY } = Layout;
    const points = res.points;
    const len = this.bufferLength;
    const ptr = this.dataSource!.writePointer;
    const baseY = yOffset + voltageHeadroom * scaleY;
    const invScaleY = 1 / this.ropeScaleY; // 反向缩放以抵消 MeshRope 的 scale.y

    let pointIdx = 0;

    // 逻辑：[ptr...end] -> [0...ptr] 映射到 points[0...len]
    for (let i = ptr; i < len; i++) {
      points[pointIdx]!.y = (baseY - data[i]! * scaleY) * invScaleY;
      pointIdx++;
    }
    for (let i = 0; i < ptr; i++) {
      points[pointIdx]!.y = (baseY - data[i]! * scaleY) * invScaleY;
      pointIdx++;
    }
  }

  private updateDigitalRope(
    res: ChannelRenderResource,
    data: Float32Array,
    step: number,
    centerY: number,
  ) {
    const points = res.points;
    const len = this.bufferLength;
    const ptr = this.dataSource!.writePointer;
    const threshold = VoltageSpecs.logicHighMin;

    const invScale = 1 / this.ropeScaleY;
    // 预计算缩放后的 Y 坐标
    const yHigh = (centerY - step / 2) * invScale;
    const yLow = (centerY + step / 2) * invScale;

    let pointIdx = 0;

    // 逻辑：[ptr...end] -> [0...ptr] 映射到 points[0...len]
    for (let i = ptr; i < len; i++) {
      points[pointIdx]!.y = data[i]! > threshold ? yHigh : yLow;
      pointIdx++;
    }
    for (let i = 0; i < ptr; i++) {
      points[pointIdx]!.y = data[i]! > threshold ? yHigh : yLow;
      pointIdx++;
    }
  }

  private drawThreshold(
    g: Graphics,
    val: number,
    offset: number,
    below: boolean,
  ) {
    const { scaleY, voltageHeadroom, dashPattern, thresholdLineWidth } = Layout;
    const y = offset + voltageHeadroom * scaleY - val * scaleY;
    g.stroke({ width: thresholdLineWidth, color: Colors.stroke, alpha: 1.0 });

    const [dash, gap] = dashPattern;
    for (let x = 0; x < this.width; x += dash + gap) {
      g.moveTo(x, y).lineTo(Math.min(x + dash, this.width), y);
    }
    g.stroke();

    const label = below
      ? `Low Level (${val.toFixed(1)}V)`
      : `High Level (${val.toFixed(1)}V)`;
    const textY =
      y + (below ? Layout.thresholdLabelBelow : Layout.thresholdLabelAbove);

    const text = new Text({
      text: label,
      style: { fontFamily: "Segoe UI", fontSize: 12, fill: Colors.fill },
      anchor: { x: 1, y: below ? 0 : 1 },
      x: this.width - Layout.thresholdLabelMargin,
      y: textY,
    });
    this.staticLabelContainer.addChild(text);
  }

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
      anchor: { x: 0, y: 0.5 },
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

    this.waveformConfigs = [];
    this.digitalConfigs = [];
    this.waveformResources = [];
    this.digitalResources = [];
  }
}
