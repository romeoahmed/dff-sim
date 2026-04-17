import { useAtom } from "jotai";
import { X } from "lucide-react";
import { settingsOpenAtom } from "@/atoms/ui-atoms";

export function SettingsSheet() {
  const [open, setOpen] = useAtom(settingsOpenAtom);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-50 flex items-start justify-end"
    >
      <div className="h-full w-80 bg-mantle border-l border-surface0 shadow-xl p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="readout text-sm uppercase tracking-widest text-text">Settings</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close settings"
            className="text-overlay1 hover:text-text transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-subtext0">Voltage and simulation settings coming soon.</p>
      </div>
    </div>
  );
}
