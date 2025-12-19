/**
 * 管理 PixiJS Application 的生命周期
 */

import { Application, DOMAdapter, WebWorkerAdapter } from "pixi.js";

// 设置适配器
DOMAdapter.set(WebWorkerAdapter);

/**
 * PixiJS 主机
 */
export class PixiHost {
  // 模拟器波形和数字波形
  public appWaveform: Application;
  public appDigital: Application;

  // 初始化状态
  private isReady = false;

  /**
   * 初始化 Application 实例
   */
  constructor() {
    this.appWaveform = new Application();
    this.appDigital = new Application();
  }

  /**
   * 初始化图形上下文
   * @param canvasW - 模拟波形画布
   * @param canvasD - 数字波形画布
   * @param width - 画布宽度
   * @param height - 模拟波形画布高度
   * @param digitalHeight - 数字波形画布高度
   * @param dpr - 设备像素比
   */
  async init(
    canvasW: OffscreenCanvas,
    canvasD: OffscreenCanvas,
    width: number,
    height: number,
    digitalHeight: number,
    dpr: number,
  ) {
    if (this.isReady) return;

    // 基础配置
    const baseConfig = {
      resolution: dpr,
      backgroundAlpha: 0,
      preference: "webgpu" as const,
      antialias: true,
      autoStart: false, // 手动控制渲染
    };

    // 初始化两个 Application 实例
    await Promise.all([
      this.appWaveform.init({ ...baseConfig, canvas: canvasW, width, height }),
      this.appDigital.init({
        ...baseConfig,
        canvas: canvasD,
        width,
        height: digitalHeight,
      }),
    ]);

    this.isReady = true;
  }

  /**
   * 调整渲染器尺寸
   * @param width - 新宽度
   * @param height - 新高度
   * @param digitalHeight - 数字波形新高度
   * @param dpr - 设备像素比
   */
  resize(width: number, height: number, digitalHeight: number, dpr: number) {
    if (!this.isReady) return;

    // 调整渲染分辨率
    if (this.appWaveform.renderer.resolution !== dpr) {
      this.appWaveform.renderer.resolution = dpr;
      this.appDigital.renderer.resolution = dpr;
    }

    this.appWaveform.renderer.resize(width, height);
    this.appDigital.renderer.resize(width, digitalHeight);
  }

  /**
   * 执行渲染指令
   */
  render() {
    if (!this.isReady) return;
    this.appWaveform.renderer.render(this.appWaveform.stage);
    this.appDigital.renderer.render(this.appDigital.stage);
  }
}
