import type { Ref } from "react";

interface Props {
  ref?: Ref<HTMLCanvasElement>;
}

export function DigitalCanvas({ ref }: Props) {
  return (
    <canvas ref={ref} className="w-full h-full block" aria-label="Digital logic waveform display" />
  );
}
