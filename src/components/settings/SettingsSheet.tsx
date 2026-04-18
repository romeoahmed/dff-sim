import { Trans, useLingui } from "@lingui/react/macro";
import * as Dialog from "@radix-ui/react-dialog";
import { useAtom } from "jotai";
import { X } from "lucide-react";
import { useState } from "react";
import { voltageSpecsAtom } from "@/atoms/settings-atoms";
import { settingsOpenAtom } from "@/atoms/ui-atoms";
import { DefaultVoltageSpecs } from "@/lib/constants";
import { voltageSpecSchema } from "@/lib/validation";

export function SettingsSheet() {
  const [open, setOpen] = useAtom(settingsOpenAtom);
  const [specs, setSpecs] = useAtom(voltageSpecsAtom);
  const [draft, setDraft] = useState(specs);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLingui();

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
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-canvas/60 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className="fixed top-0 right-0 h-full w-full max-w-md bg-panel-raised border-l border-border z-50 overflow-y-auto focus-visible:outline-none"
          aria-describedby={undefined}
        >
          <div className="sticky top-0 flex items-center justify-between px-6 h-14 border-b border-border bg-panel-raised/80 backdrop-blur-[20px] backdrop-saturate-[180%]">
            <Dialog.Title className="text-[17px] font-semibold text-fg text-body">
              <Trans>Voltage Settings</Trans>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-fg-muted hover:bg-panel-muted hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label={t`Close`}
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-6 py-5">
            <p className="text-[13px] text-fg-muted text-caption mb-5">
              <Trans>
                Override the simulator's logic-level voltage bands. Changes apply live to the
                running circuit.
              </Trans>
            </p>

            <div className="space-y-3">
              {(Object.keys(DefaultVoltageSpecs) as (keyof typeof DefaultVoltageSpecs)[]).map(
                (key) => (
                  <label key={key} className="grid grid-cols-[1fr_auto] items-center gap-3">
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
              <button
                type="button"
                onClick={onSave}
                disabled={!!error}
                className="h-9 px-5 bg-accent text-white rounded-lg text-[14px] font-medium hover:bg-accent-pressed transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel-raised"
              >
                <Trans>Save</Trans>
              </button>
              <button
                type="button"
                onClick={onReset}
                className="h-9 px-5 rounded-full border border-border-strong text-accent text-[14px] hover:bg-panel-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel-raised"
              >
                <Trans>Reset</Trans>
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
