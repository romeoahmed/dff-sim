import * as Dialog from "@radix-ui/react-dialog";
import { atom, useAtom } from "jotai";
import { X } from "lucide-react";

export const shortcutsOpenAtom = atom(false);

const SHORTCUTS: Array<[string, string]> = [
  ["Space", "Toggle D input"],
  ["R", "Reset (hold)"],
  ["[  /  ]", "Decrease / increase noise"],
  ["−  /  =", "Decrease / increase clock speed"],
  ["1 / 2 / 3", "Shader style: Clean / Glow / Phosphor"],
  ["?", "Show this help"],
  ["Esc", "Close this help"],
];

export function ShortcutsOverlay() {
  const [open, setOpen] = useAtom(shortcutsOpenAtom);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-base/80 backdrop-blur-sm z-40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[32rem] max-w-[90vw] bg-mantle border border-surface1 rounded-lg shadow-2xl p-6"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-bold">Keyboard Shortcuts</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="p-1 rounded hover:bg-surface0" aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            {SHORTCUTS.map(([keys, desc]) => (
              <div key={keys} className="contents">
                <dt className="readout text-xs text-lavender tabular-nums">{keys}</dt>
                <dd className="text-sm text-subtext0">{desc}</dd>
              </div>
            ))}
          </dl>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
