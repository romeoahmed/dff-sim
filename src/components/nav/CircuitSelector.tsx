import { useAtom } from "jotai";
import { ChevronDown } from "lucide-react";
import { circuitDefAtom } from "@/atoms/simulation-atoms";
import { circuits } from "@/circuits";

export function CircuitSelector() {
  const [circuitDef, setCircuitDef] = useAtom(circuitDefAtom);

  return (
    <label className="relative flex items-center">
      <span className="readout text-[10px] uppercase tracking-widest text-fg-subtle pr-2">
        Circuit
      </span>
      <select
        name="circuit"
        value={circuitDef?.id ?? ""}
        onChange={(e) => {
          const def = circuits.find((c) => c.id === e.target.value);
          if (def) setCircuitDef(def);
        }}
        className="appearance-none bg-panel-muted border border-border rounded-[11px] pl-3 pr-8 h-7 text-[13px] text-fg hover:border-border-strong transition-colors focus-visible:outline-none focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/40"
        aria-label="Select circuit"
      >
        {circuits.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2 pointer-events-none text-fg-muted" />
    </label>
  );
}
