import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { localeAtom } from "@/atoms/ui-atoms";
import { activateLocale } from "@/i18n";

export function useLocaleSync(): void {
  const locale = useAtomValue(localeAtom);
  useEffect(() => {
    activateLocale(locale).catch((err) => {
      // Surface but don't crash; app remains usable with previous locale.
      console.error("Failed to activate locale", locale, err);
    });
  }, [locale]);
}
