import { shaders } from "../shaders";

export interface DigitalPipelineResources {
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  channelBuffer: GPUBuffer;
  storageBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  bufferLength: number;
  channelCount: number;
}

export function createDigitalPipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
  channelCount: number,
  bufferLength: number,
): DigitalPipelineResources {
  const module = device.createShaderModule({ code: shaders.digital });

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

  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: { module, entryPoint: "vs_main" },
    fragment: {
      module,
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

  const uniformBuffer = device.createBuffer({
    size: 48,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const storageBuffer = device.createBuffer({
    size: channelCount * bufferLength * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
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
    pipeline,
    uniformBuffer,
    channelBuffer,
    storageBuffer,
    bindGroup,
    bufferLength,
    channelCount,
  };
}

export function uploadDigitalUniforms(
  device: GPUDevice,
  buffer: GPUBuffer,
  args: {
    width: number;
    height: number;
    threshold: number;
    yHigh: number;
    yLow: number;
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
  f[2] = args.threshold;
  f[3] = args.yHigh;
  f[4] = args.yLow;
  f[5] = args.lineWidth;
  u[6] = args.writePointer;
  u[7] = args.bufferLength;
  u[8] = args.channelCount;
  device.queue.writeBuffer(buffer, 0, f);
}
