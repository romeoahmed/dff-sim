import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Probe } from "@/lib/types";
import type { ShaderStyle } from "@/workers/render/shaders";
import { circuitDefAtom } from "./simulation-atoms";

export type { ShaderStyle };
export type Locale = "en" | "zh-CN";
export type Theme = "light" | "dark";

export const shaderStyleAtom = atom<ShaderStyle>("clean");
export const settingsOpenAtom = atom(false);
export const aboutOpenAtom = atom(false);
export const localeAtom = atom<Locale>("en");
export const themeAtom = atomWithStorage<Theme>("dff-sim-theme", "dark");

export const activeProbeIdsAtom = atom<Set<string>>(new Set<string>());

export const activeProbesAtom = atom<Probe[]>((get) => {
  const def = get(circuitDefAtom);
  if (!def) return [];
  const activeIds = get(activeProbeIdsAtom);
  if (activeIds.size === 0) return [...def.probes];
  return def.probes.filter((p) => activeIds.has(p.netId));
});
