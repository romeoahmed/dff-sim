import { useAtom } from "jotai";

import { paramAtomFamily } from "@/atoms/simulation-atoms";
import { Switch } from "@/components/ui/switch";
import type { ControlDef } from "@/lib/types";

export function ParamToggle({ control }: { control: ControlDef }) {
  const key = `${control.targetComponent}.${control.param}`;
  const [value, setValue] = useAtom(paramAtomFamily(key));
  const isOn = value === true;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 py-2">
      <span className="text-[11px] uppercase tracking-[0.15em] text-fg-muted">{control.label}</span>
      <Switch
        checked={isOn}
        onCheckedChange={setValue}
        aria-label={control.label}
        className="data-[state=checked]:bg-success data-[state=unchecked]:bg-panel-muted"
      />
    </div>
  );
}
