import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  label?: string;
}

export function InstrumentBezel({ children, label }: Props) {
  return (
    <div className="relative flex flex-col min-h-0 m-2 rounded-lg border border-surface1 bg-crust/60 shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
      {label && (
        <div className="readout absolute top-2 left-3 text-[9px] uppercase tracking-[0.2em] text-overlay0 pointer-events-none">
          {label}
        </div>
      )}
      <div className="relative flex-1 min-h-0">{children}</div>
    </div>
  );
}
