import { atom } from "jotai";
import { DefaultVoltageSpecs } from "@/lib/constants";
import type { VoltageSpecConfig } from "@/lib/types";

export const voltageSpecsAtom = atom<VoltageSpecConfig>(DefaultVoltageSpecs);
