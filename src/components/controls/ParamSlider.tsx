import { useAtom } from "jotai";
import { paramAtomFamily } from "@/atoms/simulation-atoms";
import { Slider } from "@/components/ui/slider";
import type { ControlDef } from "@/lib/types";

export function ParamSlider({ control }: { control: ControlDef }) {
  const key = `${control.targetComponent}.${control.param}`;
  const [value, setValue] = useAtom(paramAtomFamily(key));
  const numValue = typeof value === "number" ? value : ((control.defaultValue as number) ?? 0);

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 items-center pt-2 pb-1">
      <span className="text-[11px] uppercase tracking-[0.15em] text-fg-muted">{control.label}</span>
      <span className="readout text-[13px] text-fg tabular-nums">{numValue.toFixed(0)}</span>
      <Slider
        className="col-span-2"
        min={control.min ?? 0}
        max={control.max ?? 100}
        step={1}
        value={[numValue]}
        onValueChange={([v]) => v !== undefined && setValue(v)}
        aria-label={control.label}
      />
    </div>
  );
}
