import { Trans } from "@lingui/react/macro";
import { useAtom } from "jotai";
import { useState } from "react";
import { voltageSpecsAtom } from "@/atoms/settings-atoms";
import { settingsOpenAtom } from "@/atoms/ui-atoms";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DefaultVoltageSpecs } from "@/lib/constants";
import { voltageSpecSchema } from "@/lib/validation";

export function SettingsSheet() {
  const [open, setOpen] = useAtom(settingsOpenAtom);
  const [specs, setSpecs] = useAtom(voltageSpecsAtom);
  const [draft, setDraft] = useState(specs);
  const [error, setError] = useState<string | null>(null);

  const validate = (candidate: typeof specs) => {
    const result = voltageSpecSchema.safeParse(candidate);
    return result.success ? null : (result.error.issues[0]?.message ?? "Invalid");
  };

  const onChange = (key: keyof typeof specs, value: number) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    setError(validate(next));
  };

  const onSave = () => {
    if (error) return;
    setSpecs(draft);
    setOpen(false);
  };

  const onReset = () => {
    setDraft(DefaultVoltageSpecs);
    setError(null);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="w-full max-w-md bg-panel-raised border-l border-border p-0 overflow-y-auto"
      >
        <SheetHeader className="sticky top-0 flex-row items-center justify-between px-6 h-14 border-b border-border bg-panel-raised/80 backdrop-blur-[20px] backdrop-saturate-[180%] space-y-0">
          <SheetTitle className="text-[17px] font-semibold text-fg text-body">
            <Trans>Voltage Settings</Trans>
          </SheetTitle>
        </SheetHeader>

        <div className="px-6 py-5">
          <p className="text-[13px] text-fg-muted text-caption mb-5">
            <Trans>
              Override the simulator's logic-level voltage bands. Changes apply live to the running
              circuit.
            </Trans>
          </p>

          <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-3">
            {(Object.keys(DefaultVoltageSpecs) as (keyof typeof DefaultVoltageSpecs)[]).map(
              (key) => (
                <label key={key} className="col-span-2 grid grid-cols-subgrid items-center">
                  <span className="readout text-[11px] uppercase tracking-[0.1em] text-fg-muted">
                    {key}
                  </span>
                  <input
                    type="number"
                    name={key}
                    step="0.01"
                    value={draft[key]}
                    onChange={(e) => onChange(key, Number(e.target.value))}
                    className="w-24 h-8 bg-panel-muted border border-border rounded-[11px] px-3 text-[13px] readout text-fg focus:outline-none focus:border-focus focus:ring-2 focus:ring-focus/30 transition-colors"
                  />
                </label>
              ),
            )}
          </div>

          {error && (
            <p className="mt-4 text-[13px] text-danger text-caption" role="alert">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center gap-3">
            <Button
              type="button"
              onClick={onSave}
              disabled={!!error}
              className="h-9 px-5 bg-accent text-white hover:bg-accent-pressed"
            >
              <Trans>Save</Trans>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onReset}
              className="h-9 px-5 rounded-full border-border-strong text-accent hover:bg-panel-muted"
            >
              <Trans>Reset</Trans>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
