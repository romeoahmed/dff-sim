/**
 * 基于 PixiJS v8 MeshRope 的高性能示波器渲染器
 */

import {
  Container,
  MeshRope,
  Texture,
  Point,
  Application,
  Color,
  Graphics,
  Text,
} from "pixi.js";
import {
  Colors,
  VoltageSpecs,
  Simulation,
  Layout,
} from "../../../common/constants";
import type { WaveformDataSource, ChannelConfig } from "../../../common/types";
import type { IRenderer } from "./base";

/**
 * 渲染资源 (GPU 相关)
 */
interface ChannelResource {
  rope: MeshRope;
  points: Point[];
}

export class ExpRenderer implements IRenderer {
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
  private staticGraphics = new Graphics();
  private digitalStaticGraphics = new Graphics();

  private waveformRes: ChannelResource[] = [];
  private digitalRes: ChannelResource[] = [];

  private dataSource: WaveformDataSource | null = null;
  private width = 0;
  private height = 0;
  private digitalHeight = 0;
  private bufferLength = Simulation.bufferLength;

  // 配置
  private readonly waveformConfigs = [
    { color: Colors.clk, label: "CLK" },
    { color: Colors.d, label: "D" },
    { color: Colors.q, label: "Q" },
  ];

  private readonly digitalConfigs = [
    { color: Colors.clk, label: "CLK" },
    { color: Colors.d, label: "D" },
    { color: Colors.q, label: "Q" },
  ];

  private readonly waveformLineWidth = Layout.waveformLineWidth; // 波形线条宽度
  private readonly textureHeight = 16; // 发光纹理高度，越大光晕越宽

  private get ropeScaleY() {
    // 目标宽度 / 纹理高度 = 缩放比例
    return (this.waveformLineWidth * 18) / this.textureHeight;
  }

  constructor() {}

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

    // 1. 初始化 Mesh 资源
    this.initMeshResources();

    // 2. 挂载容器
    this.staticLayer.addChild(this.staticLabelContainer);
    this.digitalStaticLayer.addChild(this.digitalLabelContainer);
    this.waveformStage.addChild(this.staticLayer, this.dynamicLayer);
    this.digitalStage.addChild(
      this.digitalStaticLayer,
      this.digitalDynamicLayer,
    );

    // 3. 初始绘制
    this.redrawStaticElements();
    this.resize(width, height, digitalHeight);
  }

  /**
   * 绑定数据源与配置
   */
  setData(source: WaveformDataSource) {
    if (!this.digitalStage) return;

    this.dataSource = source;
    this.applyStyles();
    this.redrawStaticElements();
  }

  detach() {
    // 1. 移除
    this.waveformStage?.removeChild(this.staticLayer, this.dynamicLayer);
    this.digitalStage?.removeChild(
      this.digitalStaticLayer,
      this.digitalDynamicLayer,
    );

    // 2. 销毁容器及内部 Mesh
    this.staticLayer.destroy({ children: true });
    this.dynamicLayer.destroy({ children: true });
    this.digitalStaticLayer.destroy({ children: true });
    this.digitalDynamicLayer.destroy({ children: true });

    // 3. 清空引用
    this.waveformRes = [];
    this.digitalRes = [];
    this.waveformStage = null;
    this.digitalStage = null;
  }

  /**
   * 创建 MeshRope 和 Point 对象
   */
  private initMeshResources() {
    // 辅助函数
    const createResource = (layer: Container): ChannelResource => {
      const points = Array.from(
        { length: this.bufferLength },
        () => new Point(0, 0),
      );

      const rope = new MeshRope({
        texture: Texture.WHITE,
        points: points,
      });

      // 缩放纹理
      rope.scale.set(1, this.ropeScaleY);

      layer.addChild(rope);
      return { rope, points };
    };

    // 创建资源，不包含颜色信息
    this.waveformRes = [
      createResource(this.dynamicLayer),
      createResource(this.dynamicLayer),
      createResource(this.dynamicLayer),
    ];

    this.digitalRes = [
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
    const apply = (res: ChannelResource[], conf: ChannelConfig[]) => {
      res.forEach((item, i) => {
        if (conf[i]) {
          item.rope.tint = new Color(conf[i].color);
        }
      });
    };

    apply(this.waveformRes, this.waveformConfigs);
    apply(this.digitalRes, this.digitalConfigs);
  }

  resize(width: number, height: number, digitalHeight: number) {
    this.width = width;
    this.height = height;
    this.digitalHeight = digitalHeight;

    // 更新 MeshRope 点的 X 轴分布
    const updateX = (resources: ChannelResource[]) => {
      const stepX = width / (this.bufferLength - 1);
      for (const res of resources) {
        for (let i = 0; i < this.bufferLength; i++) {
          res.points[i]!.x = i * stepX;
        }
      }
    };

    updateX(this.waveformRes);
    updateX(this.digitalRes);

    this.redrawStaticElements();
  }

  redrawStaticElements() {
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
        gd.beginPath();
        for (let x = 0; x < this.width; x += 6) {
          gd.moveTo(x, sepY).lineTo(Math.min(x + 2, this.width), sepY);
        }
        gd.stroke({ width: 1, color: Colors.grid, alpha: 1.0 });
      }
    });
  }

  draw() {
    if (!this.dataSource) return;

    const { dOffset, clkOffset, qOffset } = Layout;
    const { clk, d, q } = this.dataSource;

    // 更新模拟波形
    this.updateRopePoints(this.waveformRes[0]!, clk, clkOffset);
    this.updateRopePoints(this.waveformRes[1]!, d, dOffset);
    this.updateRopePoints(this.waveformRes[2]!, q, qOffset);
  }

  drawDigital() {
    if (!this.dataSource) return;

    const { digitalLogicStep } = Layout;
    const rowHeight = this.digitalHeight / 3;
    const { clk, d, q } = this.dataSource;

    // 更新数字波形
    this.updateDigitalRope(
      this.digitalRes[0]!,
      clk,
      digitalLogicStep,
      rowHeight * 0.5,
    );
    this.updateDigitalRope(
      this.digitalRes[1]!,
      d,
      digitalLogicStep,
      rowHeight * 1.5,
    );
    this.updateDigitalRope(
      this.digitalRes[2]!,
      q,
      digitalLogicStep,
      rowHeight * 2.5,
    );
  }

  private updateRopePoints(
    res: ChannelResource,
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
    res: ChannelResource,
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

    g.beginPath();
    const [dash, gap] = dashPattern;
    for (let x = 0; x < this.width; x += dash + gap) {
      g.moveTo(x, y).lineTo(Math.min(x + dash, this.width), y);
    }
    g.stroke({ width: thresholdLineWidth, color: Colors.stroke, alpha: 1.0 });

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
}
