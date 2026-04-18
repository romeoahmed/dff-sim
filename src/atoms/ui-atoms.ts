import { atom } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";
import type { Probe } from "@/lib/types";
import type { ShaderStyle } from "@/workers/render/shaders";
import { circuitDefAtom } from "./simulation-atoms";

export type { ShaderStyle };
export type Locale = "en" | "zh-CN";
export type Theme = "light" | "dark";

// Guard against test environments where localStorage is a non-functional stub.
// noopStorage satisfies the StateStorage interface structurally (getItem/setItem/removeItem).
const noopStorage = {
  getItem(_key: string): string | null {
    return null;
  },
  setItem(_key: string, _value: string): void {},
  removeItem(_key: string): void {},
};

const mkSafeStorage = <T>() =>
  createJSONStorage<T>(() => {
    if (typeof window === "undefined") return noopStorage;
    const ls = window.localStorage;
    return ls && typeof ls.getItem === "function" ? ls : noopStorage;
  });

export const shaderStyleAtom = atomWithStorage<ShaderStyle>(
  "dff-sim-shader",
  "clean",
  mkSafeStorage<ShaderStyle>(),
);
export const settingsOpenAtom = atom(false);
export const aboutOpenAtom = atom(false);
export const shortcutsOpenAtom = atom(false);
export const localeAtom = atomWithStorage<Locale>("dff-sim-locale", "en", mkSafeStorage<Locale>());
export const themeAtom = atomWithStorage<Theme>("dff-sim-theme", "dark", mkSafeStorage<Theme>());

export const activeProbeIdsAtom = atom<Set<string>>(new Set<string>());

export const activeProbesAtom = atom<Probe[]>((get) => {
  const def = get(circuitDefAtom);
  if (!def) return [];
  const activeIds = get(activeProbeIdsAtom);
  if (activeIds.size === 0) return [...def.probes];
  return def.probes.filter((p) => activeIds.has(p.netId));
});
