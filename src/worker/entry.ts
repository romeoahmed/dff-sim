/**
 * 核心仿真引擎 (Worker 线程)
 *
 * 1. 维护物理世界状态 (Signal, FlipFlop)
 * 2. 管理数据缓冲区 (WaveformBuffer)
 * 3. 执行 OffscreenCanvas 渲染 (Oscilloscope)
 * 4. 驱动高频物理循环 (Loop)
 * 5. 向主线程同步低频状态数据
 */

import { Signal, DFlipFlop } from "./physics/engine";
import { WaveformBuffer } from "./physics/buffer";
import { PixiHost } from "./render/host";
import { StdRenderer } from "./render/backends/standard";
import { ExpRenderer } from "./render/backends/experimental";
import { Simulation, VoltageSpecs } from "../common/constants";
import type { VoltageSpecConfig, WorkerMessage } from "../common/types";
import type { IRenderer } from "./render/backends/base";

/**
 * 仿真引擎类
 */
class SimulationEngine {
  // Pixi 主机
  private pixiHost = new PixiHost();
  private renderer: IRenderer | null = null;

  // 状态
  private isSwitching: boolean = false;

  private buffer: WaveformBuffer;
  private signalD: Signal;
  private signalClk: Signal;
  private dff: DFlipFlop;

  // 信号时钟控制
  private clockPhase: number = 0;
  private clockSpeed: number =
    Simulation.defaultSpeed * Simulation.clockSpeedFactor;

  // 重置信号
  private resetActive: boolean = false;

  // 循环控制
  private lastFrameTime: number = 0;
  private lastUiUpdateTime: number = 0;
  private animationFrameId: number | null = null;

  /**
   * 初始化仿真引擎
   */
  constructor() {
    // 初始化物理实体
    this.buffer = new WaveformBuffer(
      Simulation.bufferLength,
      VoltageSpecs.outputLowMax,
    );

    // 初始化信号源
    this.signalD = new Signal(
      (VoltageSpecs.logicHighMin + VoltageSpecs.systemMax) / 2,
      VoltageSpecs.logicLowMax / 2,
    );
    this.signalClk = new Signal(VoltageSpecs.outputHighMax, 0.0);
    this.dff = new DFlipFlop();
  }

  /**
   * 异步初始化渲染器
   * @param cw - 模拟波形画布
   * @param cd - 数字波形画布
   * @param w - 画布宽度
   * @param h - 模拟波形画布高度
   * @param dh - 数字波形画布高度
   * @param dpr - 设备像素比
   */
  public async initRenderer(
    cw: OffscreenCanvas,
    cd: OffscreenCanvas,
    w: number,
    h: number,
    dh: number,
    dpr: number,
  ) {
    // 初始化 Pixi 环境
    await this.pixiHost.init(cw, cd, w, h, dh, dpr);

    // 挂载默认渲染器
    this.switchRenderer("standard", w, h, dh);
  }

  /**
   * 切换渲染器
   * @param mode - 渲染器模式
   * @param w - 画布宽度
   * @param h - 模拟波形画布高度
   * @param dh - 数字波形画布高度
   */
  public switchRenderer(
    mode: "standard" | "experimental",
    w?: number,
    h?: number,
    dh?: number,
  ) {
    // 若无传入尺寸，使用当前 app 的尺寸
    const width = w ?? this.pixiHost.appWaveform.screen.width;
    const height = h ?? this.pixiHost.appWaveform.screen.height;
    const digiHeight = dh ?? this.pixiHost.appDigital.screen.height;

    // 1. 卸载旧的
    if (this.renderer) {
      this.renderer.detach();
      this.renderer = null;
    }

    // 2. 创建新的
    this.renderer =
      mode === "experimental" ? new ExpRenderer() : new StdRenderer();

    // 3. 挂载到现有的 App 上
    this.renderer.attach(
      this.pixiHost.appWaveform,
      this.pixiHost.appDigital,
      width,
      height,
      digiHeight,
    );

    // 4. 注入数据
    this.renderer.setData(this.buffer);
  }

  /**
   * 调整尺寸
   * @param w - 新宽度
   * @param h - 新高度
   * @param dh - 数字波形新高度
   * @param dpr - 设备像素比
   */
  public resize(w: number, h: number, dh: number, dpr: number) {
    this.pixiHost.resize(w, h, dh, dpr);
    this.renderer?.resize(w, h, dh);
  }

  /**
   * 更新仿真参数
   * @param key - 参数键
   * @param value - 参数值
   */
  public updateParam(key: string, value: number | boolean) {
    switch (key) {
      case "toggleD":
        this.signalD.targetLogic = value ? 1 : 0;
        break;
      case "reset":
        this.resetActive = value as boolean;
        break;
      case "noise": {
        const noiseVolts = ((value as number) / 100) * Simulation.maxNoiseLevel;
        this.signalD.noiseLevel = noiseVolts;
        this.dff.qSignal.noiseLevel = noiseVolts * Simulation.outputNoiseRatio;
        break;
      }
      case "speed":
        this.clockSpeed = (value as number) * Simulation.clockSpeedFactor;
        break;
    }
  }

  /**
   * 应用新的电压设置
   *
   * @param settings - 部分电压规格配置
   */
  public applySettings(settings: Partial<VoltageSpecConfig>) {
    // 1. 更新 Worker 线程内的全局常量副本
    Object.assign(VoltageSpecs, settings);

    // 2. 重新计算信号源的基准电压
    this.signalD.baseHigh =
      (VoltageSpecs.logicHighMin + VoltageSpecs.systemMax) / 2;
    this.signalD.baseLow = VoltageSpecs.logicLowMax / 2;

    this.signalClk.baseHigh = VoltageSpecs.outputHighMax;

    this.dff.qSignal.baseHigh =
      (VoltageSpecs.outputHighMin + VoltageSpecs.outputHighMax) / 2;
    this.dff.qSignal.baseLow = VoltageSpecs.outputLowMax / 2;

    // 3. 重置缓冲区
    const baselineVolt = VoltageSpecs.outputLowMax;
    this.buffer.reset(baselineVolt);

    // 4. 强制修正当前信号电压
    const snapSignal = (sig: Signal) => {
      sig.currentValue = sig.targetLogic === 1 ? sig.baseHigh : sig.baseLow;
    };
    snapSignal(this.signalD);
    snapSignal(this.signalClk);
    snapSignal(this.dff.qSignal);

    // 5. 重绘静态元素
    if (this.renderer) {
      this.renderer.redrawStaticElements();
    }

    // 6. 重置时钟相位
    this.clockPhase = 0;
  }

  /**
   * 启动仿真循环
   */
  public start() {
    if (!this.animationFrameId) {
      this.loop(0);
    }
  }

  /**
   * 主循环 (High Frequency Loop)
   *
   * 目标：60fps 或更高 (取决于显示器刷新率)
   *
   * @param timestamp - 当前时间戳
   */
  private loop = (timestamp: number) => {
    // 1. DeltaTime 计算与钳位
    // 首次运行或切后台过久时，重置时间锚点
    if (!this.lastFrameTime) this.lastFrameTime = timestamp;
    let dt = (timestamp - this.lastFrameTime) / 1000;

    // 钳位:
    // 防止因浏览器卡顿、Tab 休眠导致 dt 过大
    // 最大允许单帧模拟 0.1秒
    if (dt > 0.1) dt = 0.1;

    this.lastFrameTime = timestamp;

    // 2. 物理步进
    this.stepPhysics(dt);

    // 3. 渲染
    if (this.renderer && !this.isSwitching) {
      this.renderer.draw();
      this.renderer.drawDigital();
      this.pixiHost.render();
    }

    // 4. UI 状态同步
    // 每 50ms 同步一次 (20fps)
    if (timestamp - this.lastUiUpdateTime > 50) {
      this.syncUiStatus();
      this.lastUiUpdateTime = timestamp;
    }

    // 5. 请求下一帧
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  /**
   * 执行单步物理计算
   * @param dt - 时间增量 (秒)
   */
  private stepPhysics(dt: number) {
    // 更新时钟相位
    this.clockPhase += this.clockSpeed * dt * Simulation.baseFrameRate;

    // 累加相位限制在 [0, 2PI]
    if (this.clockPhase > Math.PI * 2) this.clockPhase -= Math.PI * 2;

    // 生成时钟信号
    this.signalClk.targetLogic = Math.sin(this.clockPhase) > 0 ? 1 : 0;

    // 更新各信号电压
    this.signalClk.update(dt);
    this.signalD.update(dt);

    // 执行 D 触发器逻辑
    const qVolts = this.dff.process(
      this.signalD.currentValue,
      this.signalClk.currentValue,
      this.resetActive,
      dt,
    );

    // 推入环形缓冲区
    this.buffer.push(
      this.signalD.currentValue,
      this.signalClk.currentValue,
      qVolts,
    );
  }

  /**
   * 发送状态给主线程
   */
  private syncUiStatus() {
    self.postMessage({
      type: "STATUS_UPDATE",
      d: this.signalD.currentValue,
      clk: this.signalClk.currentValue,
      q: this.dff.qSignal.currentValue,
    });
  }
}

// --- Worker 入口 ---

const engine = new SimulationEngine();

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case "INIT":
      await engine.initRenderer(
        msg.canvasWaveform,
        msg.canvasDigital,
        msg.width,
        msg.height,
        msg.digitalHeight,
        msg.dpr,
      );
      engine.start();
      break;

    case "RESIZE":
      engine.resize(msg.width, msg.height, msg.digitalHeight, msg.dpr);
      break;

    case "PARAM_UPDATE":
      engine.updateParam(msg.key, msg.value);
      break;

    case "SETTINGS_UPDATE":
      engine.applySettings(msg.settings);
      break;

    case "SWITCH_RENDERER":
      engine.switchRenderer(msg.mode);
      break;
  }
};
