import { useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { circuitDefAtom } from "@/atoms/simulation-atoms";
import { dffCircuit } from "@/circuits/dff";
import { AboutSheet } from "@/components/about/AboutSheet";
import { ControlPanel } from "@/components/controls/ControlPanel";
import { ProbeSelector } from "@/components/controls/ProbeSelector";
import { WebGPUUnavailable } from "@/components/fallback/WebGPUUnavailable";
import { AppLayout } from "@/components/layout/AppLayout";
import { Toolbar } from "@/components/nav/Toolbar";
import { OscilloscopePanel } from "@/components/oscilloscope/OscilloscopePanel";
import { CircuitSchematic } from "@/components/schematic/CircuitSchematic";
import { SettingsSheet } from "@/components/settings/SettingsSheet";
import { ShortcutsOverlay, shortcutsOpenAtom } from "@/components/shortcuts/ShortcutsOverlay";
import { StatusStrip } from "@/components/status/StatusStrip";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSimulation } from "@/hooks/useSimulation";
import { useThemeSync } from "@/hooks/useThemeSync";
import { Providers } from "./providers";

function AppInner() {
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const digitalRef = useRef<HTMLCanvasElement>(null);
  const setCircuit = useSetAtom(circuitDefAtom);
  const setShortcutsOpen = useSetAtom(shortcutsOpenAtom);

  useEffect(() => {
    setCircuit(dffCircuit);
  }, [setCircuit]);

  useThemeSync();
  useSimulation(waveformRef, digitalRef);
  useKeyboardShortcuts({ onOpenHelp: () => setShortcutsOpen(true) });

  return (
    <AppLayout>
      <Toolbar className="col-span-full row-start-1" />
      <CircuitSchematic className="row-start-2 col-span-full 2xl:col-start-3 2xl:row-start-2 2xl:col-span-1 2xl:border-l 2xl:border-border" />
      <OscilloscopePanel
        waveformRef={waveformRef}
        digitalRef={digitalRef}
        className="row-start-3 col-start-1 2xl:row-start-2 2xl:col-start-2"
      />
      <aside
        className="row-start-4 col-start-1 flex flex-col overflow-y-auto border-t border-border
          md:row-start-3 md:col-start-2 md:border-t-0 md:border-l
          2xl:row-start-2 2xl:col-start-1 2xl:border-l-0 2xl:border-r"
      >
        <ControlPanel />
        <ProbeSelector />
      </aside>
      <StatusStrip className="col-span-full row-start-5 md:row-start-4 2xl:row-start-3" />
      <SettingsSheet />
      <AboutSheet />
      <ShortcutsOverlay />
    </AppLayout>
  );
}

export function App() {
  if (typeof navigator !== "undefined" && !("gpu" in navigator)) {
    return <WebGPUUnavailable />;
  }
  return (
    <Providers>
      <AppInner />
    </Providers>
  );
}
