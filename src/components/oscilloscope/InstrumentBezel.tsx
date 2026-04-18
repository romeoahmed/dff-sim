import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  label?: string;
}

// Apple-pro-app-style card: subtle border, elevated surface, soft diffused
// shadow only in dark mode (DESIGN.md §6 — shadow is the "physical-object
// under studio light" metaphor, which doesn't translate to light mode).
export function InstrumentBezel({ children, label }: Props) {
  return (
    <div
      className="relative flex flex-col min-h-0 m-2 rounded-xl border border-border bg-panel
        overflow-hidden dark:shadow-[rgba(0,0,0,0.22)_3px_5px_30px_0px]"
    >
      {label && (
        <div
          className="readout absolute top-3 left-4 text-[10px] uppercase tracking-[0.2em]
            text-fg-subtle pointer-events-none"
        >
          {label}
        </div>
      )}
      <div className="relative flex-1 min-h-0">{children}</div>
    </div>
  );
}
