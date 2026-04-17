import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { themeAtom } from "@/atoms/ui-atoms";

// Mirror the themeAtom onto <html data-theme=...> so the CSS variable layer
// in globals.css switches palettes. Persistence is handled by atomWithStorage.
export function useThemeSync(): void {
  const theme = useAtomValue(themeAtom);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
}
