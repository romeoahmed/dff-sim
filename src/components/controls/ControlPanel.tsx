import { useAtomValue } from "jotai";
import { circuitDefAtom } from "@/atoms/simulation-atoms";
import { ParamMomentary } from "./ParamMomentary";
import { ParamSlider } from "./ParamSlider";
import { ParamToggle } from "./ParamToggle";

export function ControlPanel() {
  const circuitDef = useAtomValue(circuitDefAtom);
  if (!circuitDef) return null;

  return (
    <div className="px-4 py-3 border-b border-surface0">
      <h3 className="readout text-[10px] uppercase tracking-[0.2em] text-overlay1 mb-2">
        Controls
      </h3>
      {circuitDef.controls.map((ctrl) => {
        const key = `${ctrl.targetComponent}.${ctrl.param}`;
        if (ctrl.type === "slider") return <ParamSlider key={key} control={ctrl} />;
        if (ctrl.type === "toggle") return <ParamToggle key={key} control={ctrl} />;
        if (ctrl.type === "momentary") return <ParamMomentary key={key} control={ctrl} />;
        return null;
      })}
    </div>
  );
}
