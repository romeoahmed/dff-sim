import { useAtomValue } from "jotai";
import { circuitDefAtom } from "@/atoms/simulation-atoms";

export function StatusStrip() {
  const circuitDef = useAtomValue(circuitDefAtom);

  return (
    <footer className="flex items-center gap-4 px-4 py-1 border-t border-surface0 bg-mantle readout text-[10px] text-subtext0 tracking-wider">
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green animate-pulse" aria-hidden />
        RUNNING
      </span>
      <span className="text-overlay0">·</span>
      <span>10.0 kHz</span>
      <span className="text-overlay0">·</span>
      <span>WebGPU</span>
      {circuitDef && (
        <>
          <span className="text-overlay0">·</span>
          <span>{circuitDef.id}</span>
        </>
      )}
      <span className="ml-auto">DFF-Sim v2.0</span>
    </footer>
  );
}
