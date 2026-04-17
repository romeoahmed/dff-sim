import * as Switch from "@radix-ui/react-switch";
import { useAtom } from "jotai";
import { paramAtomFamily } from "@/atoms/simulation-atoms";
import type { ControlDef } from "@/lib/types";

export function ParamToggle({ control }: { control: ControlDef }) {
  const key = `${control.targetComponent}.${control.param}`;
  const [value, setValue] = useAtom(paramAtomFamily(key));
  const isOn = value === true;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 py-2">
      {/* biome-ignore lint/a11y/noLabelWithoutControl: aria-label on Switch.Root handles a11y */}
      <label className="text-xs uppercase tracking-wider text-subtext0">{control.label}</label>
      <Switch.Root
        checked={isOn}
        onCheckedChange={setValue}
        className="relative w-14 h-7 rounded-full bg-surface1 data-[state=checked]:bg-green transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        aria-label={control.label}
      >
        <Switch.Thumb className="block w-5 h-5 bg-text rounded-full shadow-md translate-x-1 data-[state=checked]:translate-x-8 transition-transform duration-200 ease-out" />
        <span
          className="readout absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-base pointer-events-none opacity-0 data-[state=checked]:opacity-100 transition-opacity"
          aria-hidden
        >
          ON
        </span>
      </Switch.Root>
    </div>
  );
}
