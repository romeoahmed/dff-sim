import { useAtom } from "jotai";
import { ChevronDown } from "lucide-react";
import { circuitDefAtom } from "@/atoms/simulation-atoms";
import { circuits } from "@/circuits";

export function CircuitSelector() {
  const [circuitDef, setCircuitDef] = useAtom(circuitDefAtom);

  return (
    <label className="relative flex items-center">
      <span className="readout text-[10px] uppercase tracking-widest text-overlay1 pr-2">
        Circuit
      </span>
      <select
        name="circuit"
        value={circuitDef?.id ?? ""}
        onChange={(e) => {
          const def = circuits.find((c) => c.id === e.target.value);
          if (def) setCircuitDef(def);
        }}
        className="appearance-none bg-surface0 border border-surface1 rounded pl-3 pr-8 py-1 text-xs text-text hover:border-overlay0 transition-colors focus-visible:outline-none focus-visible:border-lavender focus-visible:ring-1 focus-visible:ring-lavender"
        aria-label="Select circuit"
      >
        {circuits.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2 pointer-events-none text-subtext0" />
    </label>
  );
}
