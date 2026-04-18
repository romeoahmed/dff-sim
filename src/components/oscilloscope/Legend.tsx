import { useAtomValue } from "jotai";
import { activeProbesAtom } from "@/atoms/ui-atoms";

export function Legend() {
  const probes = useAtomValue(activeProbesAtom);
  return (
    <div className="flex flex-wrap gap-4 px-4 py-2 border-t border-border bg-panel">
      {probes.map((p) => (
        <div key={p.netId} className="flex items-center gap-1.5">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: p.color, boxShadow: `0 0 6px ${p.color}66` }}
            aria-hidden
          />
          <span className="readout text-[11px] tracking-[0.15em] uppercase text-fg-muted">
            {p.label}
          </span>
        </div>
      ))}
    </div>
  );
}
