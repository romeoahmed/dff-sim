import { useAtomValue } from "jotai";
import { voltageAtomFamily } from "@/atoms/simulation-atoms";

interface Props {
  netId: string;
  label: string;
  color: string;
  points: string;
  threshold?: number;
}

export function SchematicWire({ netId, label, color, points, threshold = 1.0 }: Props) {
  const voltage = useAtomValue(voltageAtomFamily(netId));
  const isActive = voltage > threshold;

  const firstPoint = points.split(" ")[0]?.split(",") ?? ["0", "0"];
  const labelX = Number(firstPoint[0] ?? 0);
  const labelY = Number(firstPoint[1] ?? 0) - 8;

  return (
    <g>
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-overlay0)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="8 4"
        filter="url(#wire-glow)"
        style={{
          opacity: isActive ? 1 : 0,
          transition: "opacity 80ms ease-out",
          animation: isActive ? "wire-flow 1s linear infinite" : "none",
        }}
      />
      <text
        x={labelX}
        y={labelY}
        className="readout fill-subtext0"
        style={{ fontSize: 10, letterSpacing: 0.3 }}
      >
        <tspan fill={color}>{label}</tspan>
        <tspan dx={6} className="tabular-nums">
          {voltage.toFixed(2)}V
        </tspan>
      </text>
    </g>
  );
}
