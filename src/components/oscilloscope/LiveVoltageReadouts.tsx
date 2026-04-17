import { useAtomValue } from "jotai";
import { voltageAtomFamily } from "@/atoms/simulation-atoms";
import { activeProbesAtom } from "@/atoms/ui-atoms";

function Readout({ netId, label, color }: { netId: string; label: string; color: string }) {
  const v = useAtomValue(voltageAtomFamily(netId));
  return (
    <span
      className="readout px-2 py-0.5 bg-base/70 backdrop-blur-sm rounded border border-surface0 text-[10px] tabular-nums"
      style={{ color }}
    >
      {label}: {v.toFixed(2)}V
    </span>
  );
}

export function LiveVoltageReadouts() {
  const probes = useAtomValue(activeProbesAtom);
  return (
    <div className="absolute top-2 right-2 flex gap-1.5 pointer-events-none">
      {probes.map((p) => (
        <Readout key={p.netId} netId={p.netId} label={p.label} color={p.color} />
      ))}
    </div>
  );
}
