import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { atom, useAtom } from "jotai";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const shortcutsOpenAtom = atom(false);

const SHORTCUTS: Array<[string, MessageDescriptor]> = [
  ["Space", msg`Toggle D input`],
  ["R", msg`Reset (hold)`],
  ["[  /  ]", msg`Decrease / increase noise`],
  ["−  /  =", msg`Decrease / increase clock speed`],
  ["1 / 2 / 3", msg`Shader style: Clean / Glow / Phosphor`],
  ["?", msg`Show this help`],
  ["Esc", msg`Close this help`],
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
  const { i18n } = useLingui();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[32rem] max-w-[90vw] bg-panel-raised border border-border-strong rounded-[14px] shadow-[rgba(0,0,0,0.22)_3px_5px_30px_0px] p-0 overflow-hidden">
        <DialogHeader className="px-6 h-14 border-b border-border flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-[17px] font-semibold text-fg text-body">
            <Trans>Keyboard Shortcuts</Trans>
          </DialogTitle>
          <DialogDescription className="sr-only">
            <Trans>Keyboard shortcuts for driving the simulation without a mouse.</Trans>
          </DialogDescription>
        </DialogHeader>
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
              <dd className="text-[14px] text-caption text-fg-muted self-center">{i18n._(desc)}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
