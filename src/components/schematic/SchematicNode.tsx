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
        rx={6}
        className="fill-panel-raised stroke-border-strong"
        strokeWidth={1}
      />
      {/* subtle top-edge highlight: a physical-object chip catches light on its top rim */}
      <line
        x1={6}
        y1={0.5}
        x2={width - 6}
        y2={0.5}
        className="stroke-fg"
        strokeOpacity={0.08}
        strokeWidth={1}
      />
      <circle
        cx={9}
        cy={9}
        r={2.5}
        className="fill-canvas stroke-border-strong"
        strokeWidth={0.5}
      />
      <text
        x={width / 2}
        y={height / 2 - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        className="readout fill-fg"
        style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}
      >
        {partNumber}
      </text>
      <text
        x={width / 2}
        y={height / 2 + 12}
        textAnchor="middle"
        dominantBaseline="middle"
        className="readout fill-fg-subtle"
        style={{ fontSize: 9 }}
      >
        {component.id}
      </text>
    </g>
  );
}
