/**
 * 核心仿真引擎 (Worker 线程)
 *
 * 职责：
 * 1. 维护物理世界状态 (Signal, FlipFlop)
 * 2. 管理数据缓冲区 (WaveformBuffer)
 * 3. 执行 OffscreenCanvas 渲染 (Oscilloscope)
 * 4. 驱动高频物理循环 (Loop)
 * 5. 向主线程同步低频状态数据
 */

import { Signal, DFlipFlop } from "./physics";
import { WaveformBuffer } from "./buffer";
import { Oscilloscope } from "./renderer";
import { Simulation, VoltageSpecs } from "./constants";
import type { VoltageSpecConfig, WorkerMessage } from "./types";

/**
 * 仿真引擎类
 * 封装所有物理实体与渲染器，避免全局变量污染
 */
class SimulationEngine {
  // --- 核心组件 ---
  private scope: Oscilloscope | null = null;
  private buffer: WaveformBuffer;
  private signalD: Signal;
  private signalClk: Signal;
  private dff: DFlipFlop;

  // --- 仿真状态 ---
  private clockPhase: number = 0;
  private clockSpeed: number =
    Simulation.defaultSpeed * Simulation.clockSpeedFactor;
  private resetActive: boolean = false;

  // --- 循环控制 ---
  private lastFrameTime: number = 0;
  private lastUiUpdateTime: number = 0;
  private animationFrameId: number | null = null;

  constructor() {
    // 初始化物理实体
    // 预填充 buffer 以避免初始时刻的视觉跳变
    this.buffer = new WaveformBuffer(Simulation.bufferLength);

    // 初始化信号源
    this.signalD = new Signal(
      (VoltageSpecs.logicHighMin + VoltageSpecs.systemMax) / 2,
      VoltageSpecs.logicLowMax / 2,
    );
    this.signalClk = new Signal(VoltageSpecs.outputHighMax, 0.0);
    this.dff = new DFlipFlop();
  }

  /**
   * 初始化渲染器与尺寸
   * (必须在接收到主线程的 OffscreenCanvas 后调用)
   */
  public initRenderer(
    canvasWaveform: OffscreenCanvas,
    canvasDigital: OffscreenCanvas,
    width: number,
    height: number,
    digitalHeight: number,
    dpr: number,
  ) {
    this.scope = new Oscilloscope(canvasWaveform, canvasDigital);
    this.scope.setData(this.buffer);
    this.scope.setSize(width, height, digitalHeight, dpr);
  }

  /**
   * 调整视口尺寸
   */
  public resize(
    width: number,
    height: number,
    digitalHeight: number,
    dpr: number,
  ) {
    if (this.scope) {
      this.scope.setSize(width, height, digitalHeight, dpr);
    }
  }

  /**
   * 更新仿真参数
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
   * 启动仿真循环
   */
  public start() {
    if (!this.animationFrameId) {
      this.loop(0);
    }
  }

  /**
   * 主循环 (High Frequency Loop)
   * 目标：60fps 或更高 (取决于显示器刷新率)
   */
  private loop = (timestamp: number) => {
    // 1. DeltaTime 计算与钳位
    // 首次运行或切后台过久时，重置时间锚点
    if (!this.lastFrameTime) this.lastFrameTime = timestamp;
    let dt = (timestamp - this.lastFrameTime) / 1000;

    // 【重要】钳位 (Clamping):
    // 防止因浏览器卡顿、Tab 休眠导致 dt 过大，进而破坏物理稳定性
    // 0.1s 意味着最低容忍 10fps，低于此帧率则物理时间变慢 ("子弹时间")
    if (dt > 0.1) dt = 0.1;

    this.lastFrameTime = timestamp;

    // 2. 物理步进 (Physics Step)
    this.stepPhysics(dt);

    // 3. 渲染 (Rendering)
    // 直接操作 OffscreenCanvas，不阻塞主线程
    if (this.scope) {
      this.scope.draw();
      this.scope.drawDigital();
    }

    // 4. UI 状态同步 (Throttling)
    // 降低 postMessage 频率，避免阻塞主线程的消息队列
    // 每 50ms 同步一次 (20fps)，足够人眼阅读数值
    if (timestamp - this.lastUiUpdateTime > 50) {
      this.syncUiStatus();
      this.lastUiUpdateTime = timestamp;
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  /**
   * 执行单步物理计算
   */
  private stepPhysics(dt: number) {
    // 更新时钟相位
    this.clockPhase += this.clockSpeed * dt * Simulation.baseFrameRate;
    // 防止浮点数精度溢出，限制在 0 ~ 2PI
    if (this.clockPhase > Math.PI * 2) this.clockPhase -= Math.PI * 2;

    // 生成时钟信号
    this.signalClk.targetLogic = Math.sin(this.clockPhase) > 0 ? 1 : 0;

    // 更新各信号电压 (含噪声与 RC 滤波)
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

  /**
   * 应用新的电压设置
   *
   * 需要同步更新全局配置和物理实例参数
   */
  public applySettings(settings: Partial<VoltageSpecConfig>) {
    // 1. 更新 Worker 线程内的全局常量副本
    Object.assign(VoltageSpecs, settings);

    // 2. 重新计算信号源的基准电压
    // 输入 D 的高电平基准 = (逻辑高阈值 + 系统最大值) / 2
    this.signalD.baseHigh =
      (VoltageSpecs.logicHighMin + VoltageSpecs.systemMax) / 2;
    // 输入 D 的低电平基准 = 逻辑低阈值 / 2
    this.signalD.baseLow = VoltageSpecs.logicLowMax / 2;

    // 时钟 CLK 的高电平基准
    this.signalClk.baseHigh = VoltageSpecs.outputHighMax;
    // 时钟 CLK 的低电平基准通常是 0.0，如果 outputLowMax 变了也可以微调，这里暂且不变

    // D触发器输出 Q 的基准
    this.dff.qSignal.baseHigh =
      (VoltageSpecs.outputHighMin + VoltageSpecs.outputHighMax) / 2;
    this.dff.qSignal.baseLow = VoltageSpecs.outputLowMax / 2;

    // 3. 示波器重绘

    // 计算新的静默电压
    const baselineVolt = VoltageSpecs.outputLowMax;

    // 清空历史波形
    this.buffer.reset(baselineVolt);

    // 强制修正当前信号的物理电压 (Snap to new levels)
    const snapSignal = (sig: Signal) => {
      // 如果当前目标是高，直接设为新的 baseHigh；否则设为新的 baseLow
      sig.currentValue = sig.targetLogic === 1 ? sig.baseHigh : sig.baseLow;
    };

    snapSignal(this.signalD);
    snapSignal(this.signalClk);
    snapSignal(this.dff.qSignal);

    // 重置时钟相位
    this.clockPhase = 0;
  }
}

// --- Worker 入口 ---

const engine = new SimulationEngine();

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case "INIT":
      engine.initRenderer(
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
  }
};
