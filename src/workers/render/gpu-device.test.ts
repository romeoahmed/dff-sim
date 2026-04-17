import { configureCanvas, createGPUDevice } from "./gpu-device";

const mockDevice = Object.freeze({ label: "mock-device" }) as unknown as GPUDevice;

const mockGPU = {
  requestAdapter: vi.fn(),
  getPreferredCanvasFormat: vi.fn(),
};

let mockAdapter: GPUAdapter;

beforeEach(() => {
  mockAdapter = {
    requestDevice: vi.fn<() => Promise<GPUDevice>>(),
  } as unknown as GPUAdapter;

  vi.resetAllMocks();

  mockGPU.requestAdapter.mockResolvedValue(mockAdapter);
  (
    mockAdapter as unknown as { requestDevice: ReturnType<typeof vi.fn> }
  ).requestDevice.mockResolvedValue(mockDevice);
  mockGPU.getPreferredCanvasFormat.mockReturnValue("bgra8unorm" as GPUTextureFormat);

  vi.stubGlobal("navigator", { gpu: mockGPU });
});

describe("createGPUDevice()", () => {
  it("解析为包含 device、adapter 和 format 的对象（成功路径）", async () => {
    const bundle = await createGPUDevice();

    expect(bundle.adapter).toBe(mockAdapter);
    expect(bundle.device).toBe(mockDevice);
    expect(bundle.format).toBe("bgra8unorm");
  });

  it("当 requestAdapter() 返回 null 时，拒绝并抛出 'WebGPU not supported'", async () => {
    mockGPU.requestAdapter.mockResolvedValue(null);

    await expect(createGPUDevice()).rejects.toThrow("WebGPU not supported");
  });

  it("当 requestDevice() 返回 null 时，拒绝并抛出 'WebGPU device unavailable'", async () => {
    (
      mockAdapter as unknown as { requestDevice: ReturnType<typeof vi.fn> }
    ).requestDevice.mockResolvedValue(null);

    await expect(createGPUDevice()).rejects.toThrow("WebGPU device unavailable");
  });
});

describe("configureCanvas()", () => {
  it("配置上下文并返回 GPUCanvasContext（成功路径）", () => {
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

  it("当 getContext() 返回 null 时，抛出 'Cannot get WebGPU context'", () => {
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(null),
    } as unknown as OffscreenCanvas;
    const format: GPUTextureFormat = "bgra8unorm";

    expect(() => configureCanvas(mockCanvas, mockDevice, format)).toThrow(
      "Cannot get WebGPU context",
    );
  });
});
