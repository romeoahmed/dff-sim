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
        <Dialog.Overlay className="fixed inset-0 bg-base/80 backdrop-blur-sm z-40" />
        <Dialog.Content
          className="fixed top-0 right-0 h-full w-96 bg-mantle border-l border-surface0 p-6 z-50 overflow-y-auto"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-bold">Voltage Settings</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="p-1 rounded hover:bg-surface0" aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-3">
            {(Object.keys(DefaultVoltageSpecs) as (keyof typeof DefaultVoltageSpecs)[]).map(
              (key) => (
                <label key={key} className="grid grid-cols-[1fr_auto] items-center gap-2">
                  <span className="text-xs text-subtext0">{key}</span>
                  <input
                    type="number"
                    name={key}
                    step="0.01"
                    value={draft[key]}
                    onChange={(e) => onChange(key, Number(e.target.value))}
                    className="w-24 bg-surface0 border border-surface1 rounded px-2 py-1 text-sm"
                  />
                </label>
              ),
            )}
          </div>

          {error && <p className="mt-3 text-xs text-red">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={!!error}
              className="px-4 py-2 bg-green text-base font-bold rounded disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onReset}
              className="px-4 py-2 bg-surface1 text-text rounded"
            >
              Reset
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
