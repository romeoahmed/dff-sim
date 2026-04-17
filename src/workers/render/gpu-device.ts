// WebGPU 设备初始化模块

export interface GPUDeviceBundle {
  device: GPUDevice;
  adapter: GPUAdapter;
  format: GPUTextureFormat;
}

/**
 * 请求 WebGPU 适配器和设备，返回捆绑对象
 */
export async function createGPUDevice(): Promise<GPUDeviceBundle> {
  const adapter = await navigator.gpu.requestAdapter();
  if (adapter === null) {
    throw new Error("WebGPU not supported");
  }

  const device = await adapter.requestDevice();
  if (device === null) {
    throw new Error("WebGPU device unavailable");
  }

  const format = navigator.gpu.getPreferredCanvasFormat();

  return { device, adapter, format };
}

/**
 * 为 OffscreenCanvas 配置 WebGPU 上下文
 */
export function configureCanvas(
  canvas: OffscreenCanvas,
  device: GPUDevice,
  format: GPUTextureFormat,
): GPUCanvasContext {
  const ctx = canvas.getContext("webgpu") as GPUCanvasContext | null;
  if (ctx === null) {
    throw new Error("Cannot get WebGPU context");
  }

  ctx.configure({ device, format, alphaMode: "premultiplied" });

  return ctx;
}
