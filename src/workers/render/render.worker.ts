import * as Comlink from "comlink";
import { DefaultPhysicsConfig, Layout } from "@/lib/constants";
import type { Probe } from "@/lib/types";
import { configureCanvas, createGPUDevice, type GPUDeviceBundle } from "./gpu-device";
import { createDigitalPipeline, type DigitalPipelineResources } from "./pipelines/digital";
import {
  createWaveformPipeline,
  uploadChannels as uploadWaveformChannels,
  uploadUniforms as uploadWaveformUniforms,
  type WaveformPipelineResources,
} from "./pipelines/waveform";
import type { ShaderStyle } from "./shaders";

export interface RenderAPI {
  init(args: {
    waveformCanvas: OffscreenCanvas;
    digitalCanvas: OffscreenCanvas;
    width: number;
    waveformHeight: number;
    digitalHeight: number;
    dpr: number;
    probes: readonly Probe[];
  }): Promise<void>;
  resize(width: number, waveformHeight: number, digitalHeight: number, dpr: number): void;
  setShaderStyle(style: ShaderStyle): void;
  updateProbes(probes: readonly Probe[]): void;
  registerFrameChannel(port: MessagePort): void;
}

class RenderWorker implements RenderAPI {
  private gpu: GPUDeviceBundle | null = null;
  private waveformCtx: GPUCanvasContext | null = null;
  private digitalCtx: GPUCanvasContext | null = null;
  private waveformRes: WaveformPipelineResources | null = null;
  private digitalRes: DigitalPipelineResources | null = null;

  private width = 0;
  private waveformHeight = 0;
  private digitalHeight = 0;
  private probes: readonly Probe[] = [];
  private shaderStyle: ShaderStyle = "clean";

  private latestFrame: Float32Array | null = null;
  private latestWritePointer = 0;

  // 渲染循环句柄，保留用于未来实现 destroy() 时取消动画帧
  // @ts-expect-error -- write-only field intentionally kept for future destroy() implementation
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: reserved for future destroy()
  private _rafHandle: number | null = null;

  async init(args: Parameters<RenderAPI["init"]>[0]): Promise<void> {
    this.width = args.width;
    this.waveformHeight = args.waveformHeight;
    this.digitalHeight = args.digitalHeight;
    this.probes = args.probes;

    this.gpu = await createGPUDevice();
    this.waveformCtx = configureCanvas(args.waveformCanvas, this.gpu.device, this.gpu.format);
    this.digitalCtx = configureCanvas(args.digitalCanvas, this.gpu.device, this.gpu.format);

    const channelCount = args.probes.length;
    const bufferLength = DefaultPhysicsConfig.simulation.bufferLength;

    this.waveformRes = createWaveformPipeline(
      this.gpu.device,
      this.gpu.format,
      channelCount,
      bufferLength,
    );
    this.digitalRes = createDigitalPipeline(
      this.gpu.device,
      this.gpu.format,
      channelCount,
      bufferLength,
    );

    uploadWaveformChannels(
      this.gpu.device,
      this.waveformRes.channelBuffer,
      args.probes,
      args.waveformHeight,
    );

    this.startRenderLoop();
  }

  resize(width: number, waveformHeight: number, digitalHeight: number, _dpr: number): void {
    this.width = width;
    this.waveformHeight = waveformHeight;
    this.digitalHeight = digitalHeight;
    if (this.gpu && this.waveformRes) {
      uploadWaveformChannels(
        this.gpu.device,
        this.waveformRes.channelBuffer,
        this.probes,
        waveformHeight,
      );
    }
  }

  setShaderStyle(style: ShaderStyle): void {
    this.shaderStyle = style;
  }

  updateProbes(probes: readonly Probe[]): void {
    this.probes = probes;
    if (this.gpu && this.waveformRes) {
      uploadWaveformChannels(
        this.gpu.device,
        this.waveformRes.channelBuffer,
        probes,
        this.waveformHeight,
      );
    }
  }

  registerFrameChannel(port: MessagePort): void {
    port.onmessage = (e) => {
      if (e.data?.type === "frame") {
        this.latestFrame = e.data.data as Float32Array;
        this.latestWritePointer = e.data.writePointer as number;
      }
    };
    port.start();
  }

  private startRenderLoop(): void {
    const loop = () => {
      this.renderFrame();
      this._rafHandle = requestAnimationFrame(loop);
    };
    loop();
  }

  private renderFrame(): void {
    if (!this.gpu || !this.waveformRes || !this.digitalRes || !this.waveformCtx || !this.digitalCtx)
      return;
    const device = this.gpu.device;
    const bufferLength = this.waveformRes.bufferLength;
    const channelCount = this.waveformRes.channelCount;

    if (this.latestFrame) {
      device.queue.writeBuffer(this.waveformRes.storageBuffer, 0, this.latestFrame);
      device.queue.writeBuffer(this.digitalRes.storageBuffer, 0, this.latestFrame);
    }

    uploadWaveformUniforms(device, this.waveformRes.uniformBuffer, {
      width: this.width,
      height: this.waveformHeight,
      scaleY: Layout.scaleY,
      voltageHeadroom: Layout.voltageHeadroom,
      lineWidth: Layout.waveformLineWidth,
      writePointer: this.latestWritePointer,
      bufferLength,
      channelCount,
    });

    const encoder = device.createCommandEncoder();
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.waveformCtx.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(this.waveformRes.pipelines[this.shaderStyle]);
      pass.setBindGroup(0, this.waveformRes.bindGroup);
      pass.draw(bufferLength * 2, channelCount);
      pass.end();
    }
    {
      const f = new Float32Array(12);
      const u = new Uint32Array(f.buffer);
      f[0] = this.width;
      f[1] = this.digitalHeight;
      f[2] = DefaultPhysicsConfig.voltage.logicHighMin;
      f[3] = -Layout.channelRowHeight * 0.25;
      f[4] = Layout.channelRowHeight * 0.25;
      f[5] = Layout.waveformLineWidth;
      u[6] = this.latestWritePointer;
      u[7] = bufferLength;
      u[8] = channelCount;
      device.queue.writeBuffer(this.digitalRes.uniformBuffer, 0, f);

      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.digitalCtx.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(this.digitalRes.pipeline);
      pass.setBindGroup(0, this.digitalRes.bindGroup);
      pass.draw(bufferLength * 2, channelCount);
      pass.end();
    }
    device.queue.submit([encoder.finish()]);
  }
}

const api = new RenderWorker();
Comlink.expose(api);
