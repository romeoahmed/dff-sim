import type { RefObject } from "react";
import { DigitalCanvas } from "./DigitalCanvas";
import { InstrumentBezel } from "./InstrumentBezel";
import { Legend } from "./Legend";
import { LiveVoltageReadouts } from "./LiveVoltageReadouts";
import { ProbeStateAnnouncer } from "./ProbeStateAnnouncer";
import { WaveformCanvas } from "./WaveformCanvas";

interface Props {
  waveformRef: RefObject<HTMLCanvasElement | null>;
  digitalRef: RefObject<HTMLCanvasElement | null>;
}

export function OscilloscopePanel({ waveformRef, digitalRef }: Props) {
  return (
    <section className="grid grid-rows-[1fr_1fr_auto] min-h-0">
      <InstrumentBezel label="Digital Logic">
        <DigitalCanvas ref={digitalRef} />
      </InstrumentBezel>
      <InstrumentBezel label="Oscilloscope">
        <WaveformCanvas ref={waveformRef} />
        <LiveVoltageReadouts />
      </InstrumentBezel>
      <Legend />
      <ProbeStateAnnouncer />
    </section>
  );
}
