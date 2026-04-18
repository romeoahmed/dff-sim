import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureCanvas, createGPUDevice } from "./gpu-device";

const mockDevice = Object.freeze({ label: "mock-device" }) as unknown as GPUDevice;

type MockAdapter = {
  requestDevice: ReturnType<typeof vi.fn<() => Promise<GPUDevice | null>>>;
};

const mockGPU = {
  requestAdapter: vi.fn<() => Promise<MockAdapter | null>>(),
  getPreferredCanvasFormat: vi.fn<() => GPUTextureFormat>(),
};

let mockAdapter: MockAdapter;

beforeEach(() => {
  mockAdapter = {
    requestDevice: vi.fn<() => Promise<GPUDevice | null>>(),
  };

  vi.resetAllMocks();

  mockGPU.requestAdapter.mockResolvedValue(mockAdapter);
  mockAdapter.requestDevice.mockResolvedValue(mockDevice);
  mockGPU.getPreferredCanvasFormat.mockReturnValue("bgra8unorm");

  vi.stubGlobal("navigator", { gpu: mockGPU });
});

describe("createGPUDevice()", () => {
  it("resolves to a bundle containing device, adapter, and format on the happy path", async () => {
    const bundle = await createGPUDevice();

    expect(bundle.adapter).toBe(mockAdapter);
    expect(bundle.device).toBe(mockDevice);
    expect(bundle.format).toBe("bgra8unorm");
  });

  it("rejects with 'WebGPU not supported' when requestAdapter() returns null", async () => {
    mockGPU.requestAdapter.mockResolvedValue(null);

    await expect(createGPUDevice()).rejects.toThrow("WebGPU not supported");
  });

  it("rejects with 'WebGPU device unavailable' when requestDevice() returns null", async () => {
    mockAdapter.requestDevice.mockResolvedValue(null);

    await expect(createGPUDevice()).rejects.toThrow("WebGPU device unavailable");
  });
});

describe("configureCanvas()", () => {
  it("configures the context and returns the GPUCanvasContext", () => {
    const mockConfigure = vi.fn();
    const mockCtx = { configure: mockConfigure } as unknown as GPUCanvasContext;
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockCtx),
    } as unknown as OffscreenCanvas;
    const format: GPUTextureFormat = "bgra8unorm";

    const result = configureCanvas(mockCanvas, mockDevice, format);

    expect(mockCanvas.getContext).toHaveBeenCalledWith("webgpu");
    expect(mockConfigure).toHaveBeenCalledWith({
      device: mockDevice,
      format,
      alphaMode: "premultiplied",
    });
    expect(result).toBe(mockCtx);
  });

  it("throws 'Cannot get WebGPU context' when getContext() returns null", () => {
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(null),
    } as unknown as OffscreenCanvas;
    const format: GPUTextureFormat = "bgra8unorm";

    expect(() => configureCanvas(mockCanvas, mockDevice, format)).toThrow(
      "Cannot get WebGPU context",
    );
  });
});
