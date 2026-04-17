import { useSetAtom } from "jotai";
import { paramAtomFamily } from "@/atoms/simulation-atoms";
import type { ControlDef } from "@/lib/types";

export function ParamMomentary({ control }: { control: ControlDef }) {
  const key = `${control.targetComponent}.${control.param}`;
  const setValue = useSetAtom(paramAtomFamily(key));

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 py-2">
      {/* biome-ignore lint/a11y/noLabelWithoutControl: button has aria-label via screen reader */}
      <label className="text-xs uppercase tracking-wider text-subtext0">{control.label}</label>
      <button
        type="button"
        onPointerDown={() => setValue(true)}
        onPointerUp={() => setValue(false)}
        onPointerLeave={() => setValue(false)}
        onKeyDown={(e) => e.key === " " && setValue(true)}
        onKeyUp={(e) => e.key === " " && setValue(false)}
        className="readout px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest bg-red/10 border border-red/40 text-red transition-all duration-75 ease-out hover:bg-red/20 hover:border-red active:bg-red active:text-base active:translate-y-px active:shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-base"
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red mr-2 align-middle" />
        Hold
      </button>
    </div>
  );
}
