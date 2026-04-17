import * as Dialog from "@radix-ui/react-dialog";
import { useAtom, useAtomValue } from "jotai";
import { X } from "lucide-react";
import { circuitDefAtom } from "@/atoms/simulation-atoms";
import { aboutOpenAtom } from "@/atoms/ui-atoms";

const TECH_STACK = [
  "React 19 + Tailwind v4",
  "WebGPU + WGSL rendering",
  "Jotai atomic state",
  "Multi-worker actor model",
  "Physics: 10 kHz sub-stepping, 1/f noise, metastability",
];

export function AboutSheet() {
  const [open, setOpen] = useAtom(aboutOpenAtom);
  const circuitDef = useAtomValue(circuitDefAtom);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-canvas/60 backdrop-blur-sm z-40" />
        <Dialog.Content
          className="fixed top-0 right-0 h-full w-full max-w-md bg-panel-raised border-l border-border z-50 overflow-y-auto focus-visible:outline-none"
          aria-describedby={undefined}
        >
          <div className="sticky top-0 flex items-center justify-between px-6 h-14 border-b border-border bg-panel-raised/80 backdrop-blur-[20px] backdrop-saturate-[180%]">
            <Dialog.Title className="text-[17px] font-semibold text-fg text-body">
              About
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

          <div className="px-6 py-6">
            {circuitDef && (
              <div className="mb-6">
                <h3 className="text-[22px] text-display text-fg mb-2">{circuitDef.name}</h3>
                <p className="text-[15px] text-body text-fg-muted">{circuitDef.description}</p>
              </div>
            )}

            <div className="mt-8">
              <h4 className="readout text-[11px] uppercase tracking-[0.2em] text-fg-subtle mb-3">
                Tech stack
              </h4>
              <ul className="space-y-2">
                {TECH_STACK.map((item) => (
                  <li
                    key={item}
                    className="text-[14px] text-caption text-fg flex items-start gap-2"
                  >
                    <span className="text-accent mt-0.5" aria-hidden>
                      —
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
