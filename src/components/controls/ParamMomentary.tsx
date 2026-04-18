import { useSetAtom } from "jotai";
import { useState } from "react";
import { paramAtomFamily } from "@/atoms/simulation-atoms";
import type { ControlDef } from "@/lib/types";

export function ParamMomentary({ control }: { control: ControlDef }) {
  const key = `${control.targetComponent}.${control.param}`;
  const setValue = useSetAtom(paramAtomFamily(key));
  const [active, setActive] = useState(false);

  const on = () => {
    setActive(true);
    setValue(true);
  };
  const off = () => {
    setActive(false);
    setValue(false);
  };

  return (
    <div className="col-span-2 grid grid-cols-subgrid items-center py-1">
      <span className="text-[11px] uppercase tracking-[0.15em] text-fg-muted">{control.label}</span>
      <button
        type="button"
        onPointerDown={on}
        onPointerUp={off}
        onPointerLeave={off}
        onKeyDown={(e) => e.key === " " && on()}
        onKeyUp={(e) => e.key === " " && off()}
        data-active={active}
        className="readout inline-flex items-center gap-2 h-8 px-4 rounded-full border text-[11px]
          font-medium uppercase tracking-[0.1em]
          border-border bg-panel-muted text-fg
          hover:bg-panel-raised hover:border-border-strong
          data-[active=true]:bg-danger data-[active=true]:border-danger data-[active=true]:text-white
          transition-colors duration-75 ease-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus
          focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-danger group-data-[active=true]:bg-white"
          aria-hidden
        />
        Hold
      </button>
    </div>
  );
}
