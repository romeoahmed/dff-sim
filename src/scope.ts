import type { Frame } from "./model";
import type { ScopeMessage, ScopeStatus } from "./scope/protocol";

/** 转移画布并同步尺寸，单独报告绘图可用性。 */
export function mountScope(
  canvas: HTMLCanvasElement,
  onUnavailable: (unavailable: boolean) => void,
  signal: AbortSignal,
) {
  let worker: Worker | undefined;
  let observer: ResizeObserver | undefined;

  const dispose = () => {
    observer?.disconnect();
    worker?.terminate();
  };

  try {
    const renderer = new Worker(new URL("./scope/worker.ts", import.meta.url), { type: "module" });
    worker = renderer;

    const send = (message: ScopeMessage, transfer: Transferable[] = []) => {
      renderer.postMessage(message, transfer);
    };
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      send({ type: "resize", width, height, dpr: window.devicePixelRatio });
    };

    renderer.addEventListener("error", () => onUnavailable(true), { signal });
    renderer.addEventListener(
      "message",
      ({ data }: MessageEvent<ScopeStatus>) => {
        onUnavailable(data === "unavailable");
      },
      { signal },
    );

    const offscreen = canvas.transferControlToOffscreen();
    send({ type: "init", canvas: offscreen }, [offscreen]);

    observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("resize", resize, { signal });
    signal.addEventListener("abort", dispose, { once: true });

    return {
      draw: (frames: readonly Frame[], selected: number) =>
        send({ type: "draw", frames, selected }),
    };
  } catch {
    dispose();
    onUnavailable(true);
    return undefined;
  }
}
