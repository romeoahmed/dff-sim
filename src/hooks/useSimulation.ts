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
import { activeProbeIdsAtom, activeProbesAtom, shaderStyleAtom } from "@/atoms/ui-atoms";
import { Layout } from "@/lib/constants";
import { throttle } from "@/lib/throttle";
import type { CircuitDefinition } from "@/lib/types";
import { createWorkerBridge, type WorkerBridge } from "@/lib/worker-bridge";
import type { RenderAPI } from "@/workers/render/render.worker";

type RenderInitArgs = Parameters<RenderAPI["init"]>[0];

type StatusCallback = (voltages: number[]) => void;

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
  const bridgeInFlightRef = useRef<Promise<WorkerBridge> | null>(null);
  const offscreensTransferredRef = useRef(false);
  const statusCallbackProxyRef = useRef<StatusCallback | null>(null);
  // Defer termination across React 19 StrictMode's setup→cleanup→setup cycle:
  // transferControlToOffscreen and Comlink.transfer can each only run ONCE per canvas/port,
  // so we must reuse the same bridge rather than rebuild it.
  const pendingTerminationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousDefRef = useRef<CircuitDefinition | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-init on circuit change
  useEffect(() => {
    if (!circuitDef || !waveformRef.current || !digitalRef.current) return;
    const def = circuitDef;

    if (previousDefRef.current && previousDefRef.current !== def) {
      store.set(activeProbeIdsAtom, new Set<string>());
      clearCircuitAtoms(previousDefRef.current);
    }
    previousDefRef.current = def;

    if (pendingTerminationRef.current !== null) {
      clearTimeout(pendingTerminationRef.current);
      pendingTerminationRef.current = null;
    }

    let cancelled = false;

    async function setup() {
      const waveCanvas = waveformRef.current;
      const digitalCanvas = digitalRef.current;
      if (!waveCanvas || !digitalCanvas) return;

      if (!bridgeInFlightRef.current && !bridgeRef.current) {
        const promise = createWorkerBridge().then((b) => {
          bridgeRef.current = b;
          return b;
        });
        promise.catch(() => {
          if (bridgeInFlightRef.current === promise) {
            bridgeInFlightRef.current = null;
          }
        });
        bridgeInFlightRef.current = promise;
      }
      const bridge = bridgeRef.current ?? (await bridgeInFlightRef.current);
      if (!bridge || cancelled) return;

      if (!offscreensTransferredRef.current) {
        offscreensTransferredRef.current = true;
        const waveOffscreen = waveCanvas.transferControlToOffscreen();
        const digitalOffscreen = digitalCanvas.transferControlToOffscreen();
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
          ) as RenderInitArgs,
        );
        if (cancelled) return;
        bridge.render.setShaderStyle(shaderStyle);
      } else {
        // Canvases were already transferred on an earlier mount; reuse the bridge but
        // rebuild the GPU pipelines for the new circuit's probe count.
        await bridge.render.reconfigureChannels(activeProbes);
        if (cancelled) return;
      }

      await bridge.physics.loadCircuit(def);
      if (cancelled) return;
      bridge.physics.setSettings(voltageSpecs);

      if (!statusCallbackProxyRef.current) {
        const callback: StatusCallback = (voltages) => {
          const currentProbes = store.get(activeProbesAtom);
          for (const probe of currentProbes) {
            const v = voltages[probe.channelIndex];
            if (v !== undefined) {
              store.set(voltageAtomFamily(probe.netId), v);
            }
          }
        };
        statusCallbackProxyRef.current = callback;
        await bridge.physics.registerStatusCallback(Comlink.proxy(callback));
        if (cancelled) return;
      }

      await bridge.physics.start();
    }

    setup();

    return () => {
      cancelled = true;
      pendingTerminationRef.current = setTimeout(() => {
        statusCallbackProxyRef.current = null;
        bridgeRef.current?.terminate();
        bridgeRef.current = null;
        bridgeInFlightRef.current = null;
        offscreensTransferredRef.current = false;
        pendingTerminationRef.current = null;
      }, 0);
    };
  }, [circuitDef]);

  useEffect(() => {
    bridgeRef.current?.render.setShaderStyle(shaderStyle);
  }, [shaderStyle]);

  useEffect(() => {
    bridgeRef.current?.physics.setSettings(voltageSpecs);
  }, [voltageSpecs]);

  useEffect(() => {
    bridgeRef.current?.render.updateProbes(activeProbes);
  }, [activeProbes]);

  // Each slider gets its own throttled sender (16 ms ≈ 60 fps cap) to prevent Comlink queue buildup
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
