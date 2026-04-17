import { useAtom, useAtomValue } from "jotai";
import { circuitDefAtom, voltageAtomFamily } from "@/atoms/simulation-atoms";
import { activeProbeIdsAtom } from "@/atoms/ui-atoms";
import type { Probe } from "@/lib/types";

function ProbeRow({
  probe,
  active,
  onToggle,
}: {
  probe: Probe;
  active: boolean;
  onToggle: () => void;
}) {
  const voltage = useAtomValue(voltageAtomFamily(probe.netId));
  return (
    <label className="flex items-center gap-2.5 py-1 cursor-pointer group rounded px-1 -mx-1 hover:bg-surface0/60">
      <input
        type="checkbox"
        checked={active}
        onChange={onToggle}
        className="accent-lavender focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender focus-visible:ring-offset-2 focus-visible:ring-offset-base"
      />
      <span
        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
        style={{
          backgroundColor: probe.color,
          boxShadow: active ? `0 0 6px ${probe.color}` : undefined,
        }}
        aria-hidden
      />
      <span className="readout text-xs text-text flex-1" style={{ letterSpacing: 0.5 }}>
        {probe.label}
      </span>
      <span className="readout text-[10px] text-subtext0 tabular-nums">{voltage.toFixed(2)}V</span>
    </label>
  );
}

export function ProbeSelector() {
  const circuitDef = useAtomValue(circuitDefAtom);
  const [activeIds, setActiveIds] = useAtom(activeProbeIdsAtom);
  if (!circuitDef) return null;

  const toggleProbe = (netId: string) => {
    const next = new Set(activeIds);
    if (next.has(netId)) next.delete(netId);
    else next.add(netId);
    setActiveIds(next);
  };

  const isActive = (netId: string) => activeIds.size === 0 || activeIds.has(netId);

  return (
    <div className="px-4 py-3 border-b border-surface0">
      <h3 className="readout text-[10px] uppercase tracking-[0.2em] text-overlay1 mb-2">Probes</h3>
      <div>
        {circuitDef.probes.map((p) => (
          <ProbeRow
            key={p.netId}
            probe={p}
            active={isActive(p.netId)}
            onToggle={() => toggleProbe(p.netId)}
          />
        ))}
      </div>
    </div>
  );
}
