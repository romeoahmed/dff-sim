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

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-md bg-panel-muted border border-border text-[11px] readout text-fg">
      {children}
    </span>
  );
}

export function ShortcutsOverlay() {
  const [open, setOpen] = useAtom(shortcutsOpenAtom);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-canvas/70 backdrop-blur-sm z-40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[32rem] max-w-[90vw] bg-panel-raised border border-border-strong rounded-[14px] shadow-[rgba(0,0,0,0.22)_3px_5px_30px_0px] overflow-hidden focus-visible:outline-none"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between px-6 h-14 border-b border-border">
            <Dialog.Title className="text-[17px] font-semibold text-fg text-body">
              Keyboard Shortcuts
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-fg-muted hover:bg-panel-muted hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <dl className="px-6 py-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
            {SHORTCUTS.map(([keys, desc]) => (
              <div key={keys} className="contents">
                <dt className="flex items-center gap-1 flex-wrap">
                  {keys.split(/\s*\/\s*|\s{2,}/).map((k, i, arr) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static shortcut string
                    <span key={i} className="inline-flex items-center gap-1">
                      <Kbd>{k}</Kbd>
                      {i < arr.length - 1 && (
                        <span className="text-fg-subtle text-[11px]" aria-hidden>
                          /
                        </span>
                      )}
                    </span>
                  ))}
                </dt>
                <dd className="text-[14px] text-caption text-fg-muted self-center">{desc}</dd>
              </div>
            ))}
          </dl>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
