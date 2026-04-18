import type { ReactNode } from "react";

// Responsive grid shell. Three layouts driven by breakpoints:
//   <md       : 5-row stack  — toolbar / schematic(140) / scope / aside / status
//   md..2xl   : 4 rows × 2 cols — toolbar / schematic(160) / [scope | aside] / status
//   2xl+      : 3 rows × 3 cols — toolbar / [aside | scope | schematic] / status
// Children use explicit `row-start-*` / `col-start-*` utilities to place themselves.
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="grid h-screen bg-canvas text-fg overflow-hidden
        grid-cols-1 grid-rows-[auto_140px_1fr_auto_auto]
        md:grid-cols-[1fr_320px] md:grid-rows-[auto_160px_1fr_auto]
        2xl:grid-cols-[340px_1fr_360px] 2xl:grid-rows-[auto_1fr_auto]"
    >
      {children}
    </div>
  );
}
