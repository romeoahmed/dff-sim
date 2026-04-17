// useSimulation: 连接 Worker 线程与 Jotai 原子状态的核心 Hook

import * as Comlink from "comlink";
import { useAtomValue, useStore } from "jotai";
import { type RefObject, useEffect, useRef } from "react";
import { voltageSpecsAtom } from "@/atoms/settings-atoms";
import {
  circuitDefAtom,
  clearCircuitAtoms,
  paramAtomFamily,
  voltageAtomFamily,
} from "@/atoms/simulation-atoms";
import { activeProbesAtom, shaderStyleAtom } from "@/atoms/ui-atoms";
import { Layout } from "@/lib/constants";
import { throttle } from "@/lib/throttle";
import { createWorkerBridge, type WorkerBridge } from "@/lib/worker-bridge";

export function useSimulation(
  waveformRef: RefObject<HTMLCanvasElement | null>,
  digitalRef: RefObject<HTMLCanvasElement | null>,
) {
  const circuitDef = useAtomValue(circuitDefAtom);
  const activeProbes = useAtomValue(activeProbesAtom);
  const shaderStyle = useAtomValue(shaderStyleAtom);
  const voltageSpecs = useAtomValue(voltageSpecsAtom);
  const store = useStore();

  const bridgeRef = useRef<WorkerBridge | null>(null);

  // 电路切换时初始化 Worker 桥接
  // activeProbes/store 在回调中通过 store.get 动态读取，不需要出现在依赖数组中
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — only re-init on circuit change
  useEffect(() => {
    if (!circuitDef || !waveformRef.current || !digitalRef.current) return;
    let cancelled = false;
    // 在 guard 之后捕获非空引用，供异步函数使用
    const def = circuitDef;

    async function setup() {
      const waveCanvas = waveformRef.current;
      const digitalCanvas = digitalRef.current;
      if (!waveCanvas || !digitalCanvas) return;

      const waveOffscreen = waveCanvas.transferControlToOffscreen();
      const digitalOffscreen = digitalCanvas.transferControlToOffscreen();

      const bridge = await createWorkerBridge();
      if (cancelled) {
        bridge.terminate();
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      await bridge.render.init(
        Comlink.transfer(
          {
            waveformCanvas: waveOffscreen,
            digitalCanvas: digitalOffscreen,
            width: waveCanvas.clientWidth || 800,
            waveformHeight: Layout.canvasHeight,
            digitalHeight: Layout.digitalScopeHeight,
            dpr,
            probes: activeProbes,
          },
          [waveOffscreen, digitalOffscreen],
        ) as Parameters<typeof bridge.render.init>[0],
      );

      await bridge.physics.loadCircuit(def);

      // 每次回调时从 store 读取最新 probe 列表，避免闭包陈旧引用
      await bridge.physics.registerStatusCallback(
        Comlink.proxy((voltages: number[]) => {
          const currentProbes = store.get(activeProbesAtom);
          for (const probe of currentProbes) {
            const v = voltages[probe.channelIndex];
            if (v !== undefined) {
              store.set(voltageAtomFamily(probe.netId), v);
            }
          }
        }),
      );

      await bridge.physics.start();
      bridgeRef.current = bridge;
    }

    setup();
    return () => {
      cancelled = true;
      bridgeRef.current?.terminate();
      bridgeRef.current = null;
      if (circuitDef) clearCircuitAtoms(circuitDef);
    };
  }, [circuitDef]); // eslint-disable-line react-hooks/exhaustive-deps

  // 着色器风格同步
  useEffect(() => {
    bridgeRef.current?.render.setShaderStyle(shaderStyle);
  }, [shaderStyle]);

  // 电压规格同步
  useEffect(() => {
    bridgeRef.current?.physics.setSettings(voltageSpecs);
  }, [voltageSpecs]);

  // 探针列表同步
  useEffect(() => {
    bridgeRef.current?.render.updateProbes(activeProbes);
  }, [activeProbes]);

  // 每个滑块独立节流发送（16ms ≈ 60fps 上限，防止 Comlink 队列积压）
  const throttledSendersRef = useRef<Map<string, (v: number | boolean) => void>>(new Map());

  useEffect(() => {
    if (!circuitDef) return;
    throttledSendersRef.current.clear();

    const unsubs = circuitDef.controls.map((ctrl) => {
      const key = `${ctrl.targetComponent}.${ctrl.param}`;
      const atom = paramAtomFamily(key);

      if (ctrl.type === "slider") {
        throttledSendersRef.current.set(
          key,
          throttle((v: number | boolean) => {
            bridgeRef.current?.physics.setParam(ctrl.targetComponent, ctrl.param, v);
          }, 16),
        );
      }

      return store.sub(atom, () => {
        const value = store.get(atom);
        const sender = throttledSendersRef.current.get(key);
        if (sender) {
          sender(value);
        } else {
          bridgeRef.current?.physics.setParam(ctrl.targetComponent, ctrl.param, value);
        }
      });
    });

    return () => {
      for (const u of unsubs) u();
      throttledSendersRef.current.clear();
    };
  }, [circuitDef, store]);
}
