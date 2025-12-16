/**
 * pixi-host.ts
 * 负责管理 PixiJS Application 的生命周期
 * 全局唯一，只初始化一次，永不销毁 (直到 Worker 终止)
 */

import { Application, DOMAdapter, WebWorkerAdapter } from "pixi.js";

// 设置适配器
DOMAdapter.set(WebWorkerAdapter);

export class PixiHost {
  public appWaveform: Application;
  public appDigital: Application;

  private isReady = false;

  constructor() {
    this.appWaveform = new Application();
    this.appDigital = new Application();
  }

  /**
   * 初始化图形上下文 (只调用一次)
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

    const baseConfig = {
      resolution: dpr,
      backgroundAlpha: 0,
      preference: "webgpu" as const,
      antialias: true,
      autoStart: false, // 手动控制渲染
    };

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
   * 执行渲染指令 (提交到 GPU)
   */
  render() {
    if (!this.isReady) return;
    this.appWaveform.renderer.render(this.appWaveform.stage);
    this.appDigital.renderer.render(this.appDigital.stage);
  }
}
