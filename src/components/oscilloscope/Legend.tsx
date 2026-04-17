import { useAtomValue } from "jotai";
import { activeProbesAtom } from "@/atoms/ui-atoms";

export function Legend() {
  const probes = useAtomValue(activeProbesAtom);
  return (
    <div className="flex gap-4 px-4 py-2 border-t border-surface0">
      {probes.map((p) => (
        <div key={p.netId} className="flex items-center gap-1.5">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: p.color, boxShadow: `0 0 4px ${p.color}` }}
            aria-hidden
          />
          <span className="readout text-[10px] uppercase tracking-widest text-subtext0">
            {p.label}
          </span>
        </div>
      ))}
    </div>
  );
}
