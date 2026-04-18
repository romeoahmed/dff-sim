import { useAtomValue } from "jotai";
import { voltageAtomFamily } from "@/atoms/simulation-atoms";
import { activeProbesAtom } from "@/atoms/ui-atoms";

function Readout({ netId, label, color }: { netId: string; label: string; color: string }) {
  const v = useAtomValue(voltageAtomFamily(netId));
  return (
    <span
      className="readout inline-flex items-center gap-1.5 h-6 px-2.5 rounded-[11px] bg-panel/70
        backdrop-blur-[20px] backdrop-saturate-[180%] border border-border text-[11px] text-fg
        tabular-nums"
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
      <span className="text-fg-muted">{v.toFixed(2)}V</span>
    </span>
  );
}

export function LiveVoltageReadouts() {
  const probes = useAtomValue(activeProbesAtom);
  return (
    <div className="absolute top-3 right-3 flex flex-wrap gap-1.5 pointer-events-none max-w-[75%] justify-end">
      {probes.map((p) => (
        <Readout key={p.netId} netId={p.netId} label={p.label} color={p.color} />
      ))}
    </div>
  );
}
