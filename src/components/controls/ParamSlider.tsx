import * as Slider from "@radix-ui/react-slider";
import { useAtom } from "jotai";
import { paramAtomFamily } from "@/atoms/simulation-atoms";
import type { ControlDef } from "@/lib/types";

export function ParamSlider({ control }: { control: ControlDef }) {
  const key = `${control.targetComponent}.${control.param}`;
  const [value, setValue] = useAtom(paramAtomFamily(key));
  const numValue = typeof value === "number" ? value : ((control.defaultValue as number) ?? 0);

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 items-center pt-2 pb-1">
      <span className="text-[11px] uppercase tracking-[0.15em] text-fg-muted">{control.label}</span>
      <span className="readout text-[13px] text-fg tabular-nums">{numValue.toFixed(0)}</span>
      <Slider.Root
        className="col-span-2 relative flex items-center h-6 group select-none touch-none"
        min={control.min ?? 0}
        max={control.max ?? 100}
        step={1}
        value={[numValue]}
        onValueChange={([v]) => v !== undefined && setValue(v)}
        aria-label={control.label}
      >
        <Slider.Track className="relative h-1 grow bg-panel-muted rounded-full overflow-hidden">
          <Slider.Range className="absolute h-full bg-accent rounded-full" />
        </Slider.Track>
        <Slider.Thumb
          className="block w-5 h-5 bg-white rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.35)]
            light:bg-fg light:shadow-[0_1px_4px_rgba(0,0,0,0.15)]
            transition-transform duration-75 ease-out hover:scale-110 active:scale-95
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus
            focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
        />
      </Slider.Root>
    </div>
  );
}
