import { useAtomValue } from "jotai";
import { circuitDefAtom } from "@/atoms/simulation-atoms";

export function StatusStrip({ className = "" }: { className?: string }) {
  const circuitDef = useAtomValue(circuitDefAtom);

  return (
    <footer
      className={`h-6 flex items-center gap-3 px-4 border-t border-border bg-panel readout text-[11px] uppercase tracking-[0.1em] text-fg-muted ${className}`}
    >
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse"
          aria-hidden
        />
        Running
      </span>
      <span className="text-fg-subtle" aria-hidden>
        •
      </span>
      <span>10.0 kHz</span>
      <span className="text-fg-subtle" aria-hidden>
        •
      </span>
      <span>WebGPU</span>
      {circuitDef && (
        <>
          <span className="text-fg-subtle" aria-hidden>
            •
          </span>
          <span>{circuitDef.id}</span>
        </>
      )}
      <span className="ml-auto text-fg-subtle">DFF·SIM v2.0</span>
    </footer>
  );
}
