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
import { Providers } from "./providers";

function AppInner() {
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const digitalRef = useRef<HTMLCanvasElement>(null);
  const setCircuit = useSetAtom(circuitDefAtom);
  const setShortcutsOpen = useSetAtom(shortcutsOpenAtom);

  useEffect(() => {
    setCircuit(dffCircuit);
  }, [setCircuit]);

  useSimulation(waveformRef, digitalRef);
  useKeyboardShortcuts({ onOpenHelp: () => setShortcutsOpen(true) });

  return (
    <AppLayout>
      <Toolbar />
      <CircuitSchematic />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_clamp(280px,25vw,400px)] min-h-0">
        <OscilloscopePanel waveformRef={waveformRef} digitalRef={digitalRef} />
        <aside className="flex flex-col overflow-y-auto border-l border-surface0">
          <ControlPanel />
          <ProbeSelector />
        </aside>
      </div>
      <StatusStrip />
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
