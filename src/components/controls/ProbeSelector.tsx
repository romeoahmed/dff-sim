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
    <label
      className="flex items-center gap-3 h-10 px-2 -mx-2 rounded-lg cursor-pointer
        hover:bg-panel-muted/60 transition-colors"
    >
      <input
        type="checkbox"
        name={`probe-${probe.netId}`}
        checked={active}
        onChange={onToggle}
        className="w-4 h-4 accent-accent rounded focus-visible:outline-none
          focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2
          focus-visible:ring-offset-panel"
      />
      <span
        className="inline-block w-2.5 h-2.5 rounded-full shrink-0 transition-shadow"
        style={{
          backgroundColor: probe.color,
          boxShadow: active ? `0 0 8px ${probe.color}` : undefined,
        }}
        aria-hidden
      />
      <span className="readout text-[13px] text-fg flex-1" style={{ letterSpacing: 0.5 }}>
        {probe.label}
      </span>
      <span className="readout text-[11px] text-fg-muted tabular-nums">{voltage.toFixed(2)}V</span>
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
    <div className="px-5 py-5">
      <h3 className="readout text-[11px] uppercase tracking-[0.2em] text-fg-subtle mb-3">Probes</h3>
      <div className="space-y-0.5">
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
