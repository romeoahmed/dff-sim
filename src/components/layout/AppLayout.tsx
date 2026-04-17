import type { ReactNode } from "react";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-screen grid-rows-[auto_minmax(240px,45vh)_1fr_auto] bg-base text-text overflow-hidden">
      {children}
    </div>
  );
}
