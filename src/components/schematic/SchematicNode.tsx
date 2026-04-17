import type { ComponentDef } from "@/lib/types";

interface Props {
  component: ComponentDef;
  x: number;
  y: number;
  width: number;
  height: number;
}

const PART_NUMBER: Record<string, string> = {
  DFlipFlop: "74LV74",
  ClockSource: "CLK-GEN",
  SignalSource: "INPUT",
  ANDGate: "74LV08",
  ORGate: "74LV32",
  XORGate: "74LV86",
  NOTGate: "74LV04",
  FullAdder: "74LS283",
};

export function SchematicNode({ component, x, y, width, height }: Props) {
  const partNumber = PART_NUMBER[component.type] ?? component.type;

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={width}
        height={height}
        rx={2}
        className="fill-surface1 stroke-overlay0"
        strokeWidth={1}
      />
      <circle cx={8} cy={8} r={2.5} className="fill-base stroke-overlay0" strokeWidth={0.5} />
      <text
        x={width / 2}
        y={height / 2 - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        className="readout fill-text"
        style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}
      >
        {partNumber}
      </text>
      <text
        x={width / 2}
        y={height / 2 + 10}
        textAnchor="middle"
        dominantBaseline="middle"
        className="readout fill-overlay0"
        style={{ fontSize: 9 }}
      >
        {component.id}
      </text>
    </g>
  );
}
