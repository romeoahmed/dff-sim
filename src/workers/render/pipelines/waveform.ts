import type { Probe } from "@/lib/types";
import { type ShaderStyle, shaders, waveformFragShaders } from "../shaders";

export interface WaveformPipelineResources {
  pipelines: Record<ShaderStyle, GPURenderPipeline>;
  uniformBuffer: GPUBuffer;
  channelBuffer: GPUBuffer;
  storageBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  bufferLength: number;
  channelCount: number;
}

export function createWaveformPipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
  channelCount: number,
  bufferLength: number,
): WaveformPipelineResources {
  const vertModule = device.createShaderModule({ code: shaders.waveformVert });

  // Explicit bind group layout so all three pipelines share one compatible bind group.
  // layout: "auto" would generate a separate incompatible layout per pipeline.
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
    ],
  });
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  const makePipeline = (fragCode: string): GPURenderPipeline => {
    const fragModule = device.createShaderModule({ code: fragCode });
    return device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: vertModule, entryPoint: "vs_main" },
      fragment: {
        module: fragModule,
        entryPoint: "fs_main",
        targets: [
          {
            format,
            blend: {
              color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
              alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
            },
          },
        ],
      },
      primitive: { topology: "triangle-strip" },
    });
  };

  const pipelines: Record<ShaderStyle, GPURenderPipeline> = {
    clean: makePipeline(waveformFragShaders.clean),
    glow: makePipeline(waveformFragShaders.glow),
    phosphor: makePipeline(waveformFragShaders.phosphor),
  };

  const uniformBuffer = device.createBuffer({
    size: 48,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const storageBuffer = device.createBuffer({
    size: channelCount * bufferLength * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // ChannelConfig: color(vec4=16 B) + yOffset(f32=4 B) + _pad(vec3=12 B) = 32 B per channel
  const channelBuffer = device.createBuffer({
    size: Math.max(32 * channelCount, 32),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: storageBuffer } },
      { binding: 2, resource: { buffer: channelBuffer } },
    ],
  });

  return {
    pipelines,
    uniformBuffer,
    channelBuffer,
    storageBuffer,
    bindGroup,
    bufferLength,
    channelCount,
  };
}

export function uploadChannels(
  device: GPUDevice,
  buffer: GPUBuffer,
  probes: readonly Probe[],
  canvasHeight: number,
): void {
  const f = new Float32Array(8 * probes.length);
  const u = new Uint32Array(f.buffer);
  const rowHeight = canvasHeight / Math.max(probes.length, 1);
  for (const [i, probe] of probes.entries()) {
    const yOffset = rowHeight * probe.channelIndex + rowHeight * 0.5 - canvasHeight * 0.5;
    const color = hexToRgba(probe.color);
    f[i * 8 + 0] = color[0];
    f[i * 8 + 1] = color[1];
    f[i * 8 + 2] = color[2];
    f[i * 8 + 3] = color[3];
    f[i * 8 + 4] = yOffset;
    u[i * 8 + 5] = probe.channelIndex % 4;
  }
  device.queue.writeBuffer(buffer, 0, f);
}

export function uploadUniforms(
  device: GPUDevice,
  buffer: GPUBuffer,
  args: {
    width: number;
    height: number;
    scaleY: number;
    voltageHeadroom: number;
    lineWidth: number;
    writePointer: number;
    bufferLength: number;
    channelCount: number;
  },
): void {
  const f = new Float32Array(12);
  const u = new Uint32Array(f.buffer);
  f[0] = args.width;
  f[1] = args.height;
  f[2] = args.scaleY;
  f[3] = args.voltageHeadroom;
  f[4] = args.lineWidth;
  u[5] = args.writePointer;
  u[6] = args.bufferLength;
  u[7] = args.channelCount;
  device.queue.writeBuffer(buffer, 0, f);
}

function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return [r, g, b, 1.0];
}
