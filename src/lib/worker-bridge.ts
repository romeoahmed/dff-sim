import * as Comlink from "comlink";
import type { PhysicsAPI } from "@/workers/physics/physics.worker";
import type { RenderAPI } from "@/workers/render/render.worker";

export interface WorkerBridge {
  physics: Comlink.Remote<PhysicsAPI>;
  render: Comlink.Remote<RenderAPI>;
  physicsWorker: Worker;
  renderWorker: Worker;
  terminate(): void;
}

export async function createWorkerBridge(): Promise<WorkerBridge> {
  const physicsWorker = new Worker(
    new URL("@/workers/physics/physics.worker.ts", import.meta.url),
    { type: "module" },
  );
  const renderWorker = new Worker(new URL("@/workers/render/render.worker.ts", import.meta.url), {
    type: "module",
  });

  const physics = Comlink.wrap<PhysicsAPI>(physicsWorker);
  const render = Comlink.wrap<RenderAPI>(renderWorker);

  // Direct physics→render channel so frame data never passes through the main thread
  const channel = new MessageChannel();
  await physics.registerRenderPort(Comlink.transfer(channel.port1, [channel.port1]));
  await render.registerFrameChannel(Comlink.transfer(channel.port2, [channel.port2]));

  return {
    physics,
    render,
    physicsWorker,
    renderWorker,
    terminate: () => {
      physics[Comlink.releaseProxy]();
      render[Comlink.releaseProxy]();
      physicsWorker.terminate();
      renderWorker.terminate();
    },
  };
}
