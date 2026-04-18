import { useEffect, useState } from "react";

// Reactive wrapper around window.matchMedia. SSR-safe: starts `false` when
// there's no window, then syncs on first mount. Re-subscribes if the query
// string changes (rare, but keeps this honest).
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
