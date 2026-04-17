export interface GPUDeviceBundle {
  device: GPUDevice;
  adapter: GPUAdapter;
  format: GPUTextureFormat;
}

export async function createGPUDevice(): Promise<GPUDeviceBundle> {
  const adapter = await navigator.gpu.requestAdapter();
  if (adapter === null) {
    throw new Error("WebGPU not supported");
  }

  const device = (await adapter.requestDevice()) as GPUDevice | null;
  if (device === null) {
    throw new Error("WebGPU device unavailable");
  }

  const format = navigator.gpu.getPreferredCanvasFormat();

  return { device, adapter, format };
}

export function configureCanvas(
  canvas: OffscreenCanvas,
  device: GPUDevice,
  format: GPUTextureFormat,
): GPUCanvasContext {
  const ctx = canvas.getContext("webgpu");
  if (ctx === null) throw new Error("Cannot get WebGPU context");

  ctx.configure({ device, format, alphaMode: "premultiplied" });

  return ctx;
}
