import { I18nProvider } from "@lingui/react";
import { Provider as JotaiProvider } from "jotai";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { i18n } from "@/i18n";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider i18n={i18n}>
      <JotaiProvider>
        <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: "easeOut" }}>
          {children}
        </MotionConfig>
      </JotaiProvider>
    </I18nProvider>
  );
}
