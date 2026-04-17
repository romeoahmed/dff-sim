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

  // Re-initialize the Worker bridge only when the circuit changes.
  // activeProbes and store are read inside callbacks via store.get() to avoid stale closures
  // and must NOT appear in the dependency array.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — only re-init on circuit change
  useEffect(() => {
    if (!circuitDef || !waveformRef.current || !digitalRef.current) return;
    let cancelled = false;
    // Capture non-null refs after the guard for use inside the async function
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
        ) as Parameters<typeof bridge.render.init>[0], // Comlink.transfer strips the call-site type
      );

      await bridge.physics.loadCircuit(def);

      // Read the latest probe list from the store on each callback to avoid stale closures
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
