/**
 * 渲染器策略接口
 */

import { Application } from "pixi.js";
import type { WaveformDataSource } from "../../../common/types";

export interface IRenderer {
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
  ): void;

  /**
   * 注入数据源
   * @param source - 波形数据源
   */
  setData(source: WaveformDataSource): void;

  /**
   * 响应尺寸变化
   * @param width - 逻辑宽度
   * @param height - 逻辑高度
   * @param digitalHeight - 数字高度
   */
  resize(width: number, height: number, digitalHeight: number): void;

  /**
   * 执行绘制逻辑
   */
  draw(): void;
  drawDigital(): void;
  redrawStaticElements(): void;

  /**
   * 卸载资源
   */
  detach(): void;
}
