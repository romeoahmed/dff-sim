import * as Slider from "@radix-ui/react-slider";
import { useAtom } from "jotai";
import { paramAtomFamily } from "@/atoms/simulation-atoms";
import type { ControlDef } from "@/lib/types";

export function ParamSlider({ control }: { control: ControlDef }) {
  const key = `${control.targetComponent}.${control.param}`;
  const [value, setValue] = useAtom(paramAtomFamily(key));
  const numValue = typeof value === "number" ? value : ((control.defaultValue as number) ?? 0);

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 items-center py-2">
      <span className="text-xs uppercase tracking-wider text-subtext0">{control.label}</span>
      <span className="readout text-xs text-text tabular-nums">{numValue.toFixed(0)}</span>
      <Slider.Root
        className="col-span-2 relative flex items-center h-6 group select-none touch-none"
        min={control.min ?? 0}
        max={control.max ?? 100}
        step={1}
        value={[numValue]}
        onValueChange={([v]) => v !== undefined && setValue(v)}
        aria-label={control.label}
      >
        <Slider.Track className="relative h-[2px] grow bg-surface1 rounded-full">
          <Slider.Range className="absolute h-full bg-gradient-to-r from-lavender to-blue rounded-full" />
        </Slider.Track>
        <Slider.Thumb className="block w-4 h-4 bg-text rounded-full border-2 border-base shadow-lg transition-transform duration-75 ease-out hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender focus-visible:ring-offset-2 focus-visible:ring-offset-base" />
      </Slider.Root>
    </div>
  );
}
