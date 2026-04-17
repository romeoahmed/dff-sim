import { atom } from "jotai";
import type { VoltageSpecConfig } from "@/lib/types";
import { DefaultVoltageSpecs } from "@/lib/constants";

export const voltageSpecsAtom = atom<VoltageSpecConfig>(DefaultVoltageSpecs);
