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
      <span className="text-[11px] uppercase tracking-[0.15em] text-fg-muted">{control.label}</span>
      <Switch.Root
        checked={isOn}
        onCheckedChange={setValue}
        className="relative w-[52px] h-8 rounded-full bg-panel-muted data-[state=checked]:bg-success
          transition-colors duration-200 ease-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus
          focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
        aria-label={control.label}
      >
        <Switch.Thumb
          className="block w-7 h-7 bg-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.2),0_0_1px_rgba(0,0,0,0.08)]
            translate-x-0.5 data-[state=checked]:translate-x-[22px]
            transition-transform duration-200 ease-out"
        />
      </Switch.Root>
    </div>
  );
}
