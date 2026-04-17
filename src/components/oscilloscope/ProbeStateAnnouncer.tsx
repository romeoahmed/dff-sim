import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { voltageAtomFamily } from "@/atoms/simulation-atoms";
import { activeProbesAtom } from "@/atoms/ui-atoms";
import { DefaultPhysicsConfig } from "@/lib/constants";
import type { Probe } from "@/lib/types";

function probeLogic(voltage: number, previous: 0 | 1): 0 | 1 {
  const { logicHighMin, logicLowMax } = DefaultPhysicsConfig.voltage;
  if (voltage > logicHighMin) return 1;
  if (voltage < logicLowMax) return 0;
  return previous;
}

type TransitionHandler = (netId: string, label: string, state: 0 | 1) => void;

function ProbeRow({ probe, onTransition }: { probe: Probe; onTransition: TransitionHandler }) {
  const v = useAtomValue(voltageAtomFamily(probe.netId));
  const prevRef = useRef<0 | 1>(0);
  const current = probeLogic(v, prevRef.current);

  useEffect(() => {
    if (current !== prevRef.current) {
      prevRef.current = current;
      onTransition(probe.netId, probe.label, current);
    }
  }, [current, probe.netId, probe.label, onTransition]);

  return null;
}

export function ProbeStateAnnouncer() {
  const probes = useAtomValue(activeProbesAtom);
  const messagesRef = useRef<Map<string, string>>(new Map());
  const [message, setMessage] = useState<string>("");

  const handleTransition = useCallback<TransitionHandler>((netId, label, state) => {
    messagesRef.current.set(netId, `${label} ${state === 1 ? "HIGH" : "LOW"}`);
    setMessage(Array.from(messagesRef.current.values()).join(", "));
  }, []);

  return (
    <>
      {probes.map((p) => (
        <ProbeRow key={p.netId} probe={p} onTransition={handleTransition} />
      ))}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
    </>
  );
}
