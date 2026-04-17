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
  const labelY = Number(firstPoint[1] ?? 0) - 12;

  const chipW = Math.max(54, label.length * 6 + 38);
  const chipH = 14;

  return (
    <g>
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-border-strong)"
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
      <g transform={`translate(${labelX}, ${labelY - chipH / 2})`}>
        <rect
          x={0}
          y={0}
          width={chipW}
          height={chipH}
          rx={3}
          className="fill-panel-raised stroke-border"
          strokeWidth={0.5}
        />
        <text
          x={6}
          y={chipH / 2}
          dominantBaseline="central"
          className="readout"
          style={{ fontSize: 9, letterSpacing: 0.3 }}
        >
          <tspan fill={color}>{label}</tspan>
          <tspan dx={6} className="fill-fg-muted tabular-nums">
            {voltage.toFixed(2)}V
          </tspan>
        </text>
      </g>
    </g>
  );
}
