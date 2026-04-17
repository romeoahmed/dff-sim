import * as Dialog from "@radix-ui/react-dialog";
import { useAtom, useAtomValue } from "jotai";
import { X } from "lucide-react";
import { aboutOpenAtom } from "@/atoms/ui-atoms";
import { circuitDefAtom } from "@/atoms/simulation-atoms";

export function AboutSheet() {
  const [open, setOpen] = useAtom(aboutOpenAtom);
  const circuitDef = useAtomValue(circuitDefAtom);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-base/80 backdrop-blur-sm z-40" />
        <Dialog.Content
          className="fixed top-0 right-0 h-full w-96 bg-mantle border-l border-surface0 p-6 z-50 overflow-y-auto"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-bold">About</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="p-1 rounded hover:bg-surface0" aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <h3 className="text-sm font-bold text-lavender mb-2">{circuitDef?.name}</h3>
          <p className="text-sm text-subtext0 mb-4">{circuitDef?.description}</p>

          <h4 className="text-xs uppercase tracking-wider text-subtext0 mt-4 mb-2">Tech Stack</h4>
          <ul className="text-sm text-text space-y-1">
            <li>React 19 + Tailwind v4</li>
            <li>WebGPU + WGSL rendering</li>
            <li>Jotai atomic state</li>
            <li>Multi-Worker Actor Model</li>
            <li>Physics: 10kHz sub-stepping, 1/f noise, metastability</li>
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
