import * as Comlink from "comlink";
import { DefaultPhysicsConfig, Layout } from "@/lib/constants";
import type { Probe } from "@/lib/types";
import { configureCanvas, createGPUDevice, type GPUDeviceBundle } from "./gpu-device";
import {
  createDigitalPipeline,
  type DigitalPipelineResources,
  uploadDigitalUniforms,
} from "./pipelines/digital";
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

  private rafHandle: number | null = null;

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
    uploadWaveformChannels(
      this.gpu.device,
      this.digitalRes.channelBuffer,
      args.probes,
      args.digitalHeight,
    );

    this.startRenderLoop();
  }

  resize(width: number, waveformHeight: number, digitalHeight: number, _dpr: number): void {
    this.width = width;
    this.waveformHeight = waveformHeight;
    this.digitalHeight = digitalHeight;
    if (this.gpu && this.waveformRes && this.digitalRes) {
      uploadWaveformChannels(
        this.gpu.device,
        this.waveformRes.channelBuffer,
        this.probes,
        waveformHeight,
      );
      uploadWaveformChannels(
        this.gpu.device,
        this.digitalRes.channelBuffer,
        this.probes,
        digitalHeight,
      );
    }
  }

  setShaderStyle(style: ShaderStyle): void {
    this.shaderStyle = style;
  }

  updateProbes(probes: readonly Probe[]): void {
    this.probes = probes;
    if (this.gpu && this.waveformRes && this.digitalRes) {
      uploadWaveformChannels(
        this.gpu.device,
        this.waveformRes.channelBuffer,
        probes,
        this.waveformHeight,
      );
      uploadWaveformChannels(
        this.gpu.device,
        this.digitalRes.channelBuffer,
        probes,
        this.digitalHeight,
      );
    }
  }

  registerFrameChannel(port: MessagePort): void {
    port.onmessage = (e) => {
      if (e.data?.type === "frame") {
        const raw = e.data.data as ArrayBuffer | Float32Array;
        this.latestFrame = raw instanceof Float32Array ? raw : new Float32Array(raw);
        this.latestWritePointer = e.data.writePointer as number;
      }
    };
  }

  private startRenderLoop(): void {
    if (this.rafHandle !== null) return;
    const loop = () => {
      this.renderFrame();
      this.rafHandle = requestAnimationFrame(loop);
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
      uploadDigitalUniforms(device, this.digitalRes.uniformBuffer, {
        width: this.width,
        height: this.digitalHeight,
        threshold: DefaultPhysicsConfig.voltage.logicHighMin,
        yHigh: -Layout.channelRowHeight * 0.25,
        yLow: Layout.channelRowHeight * 0.25,
        lineWidth: Layout.waveformLineWidth,
        writePointer: this.latestWritePointer,
        bufferLength,
        channelCount,
      });

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
