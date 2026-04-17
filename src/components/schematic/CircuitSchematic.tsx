import { useAtomValue } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { circuitDefAtom } from "@/atoms/simulation-atoms";
import { buildSchematicDescription } from "./describe";
import { SchematicGrid } from "./SchematicGrid";
import { SchematicNode } from "./SchematicNode";
import { SchematicWire } from "./SchematicWire";

export function CircuitSchematic() {
  const circuitDef = useAtomValue(circuitDefAtom);
  if (!circuitDef) return <div />;

  const VIEWBOX_W = 1200;
  const VIEWBOX_H = 400;
  const nodeW = 120;
  const nodeH = 80;
  const gap = 180;
  const startX = 80;
  const rowY = VIEWBOX_H / 2 - nodeH / 2;

  const titleId = `schematic-title-${circuitDef.id}`;
  const descId = `schematic-desc-${circuitDef.id}`;
  const description = buildSchematicDescription(circuitDef);

  const positions = new Map<string, { x: number; y: number }>();
  circuitDef.components.forEach((c, i) => {
    positions.set(c.id, { x: startX + i * (nodeW + gap), y: rowY });
  });

  interface WireData {
    netId: string;
    label: string;
    color: string;
    points: string;
  }

  const wires = circuitDef.nets
    .flatMap((net) => {
      const probe = circuitDef.probes.find((p) => p.netId === net.id);
      return net.loads.map((load): WireData | null => {
        const src = positions.get(net.driver.componentId);
        const dst = positions.get(load.componentId);
        if (!src || !dst) return null;
        const x1 = src.x + nodeW;
        const y1 = src.y + nodeH / 2;
        const x2 = dst.x;
        const y2 = dst.y + nodeH / 2;
        const mx = (x1 + x2) / 2;
        return {
          netId: net.id,
          label: probe?.label ?? net.id,
          color: probe?.color ?? "#6e738d",
          points: `${x1},${y1} ${mx},${y1} ${mx},${y2} ${x2},${y2}`,
        };
      });
    })
    .filter((w): w is WireData => w !== null);

  return (
    <section className="relative bg-mantle/80 overflow-hidden min-h-0">
      <div className="absolute top-0 left-0 right-0 z-10 px-4 py-1.5 flex items-baseline gap-3 text-xs uppercase tracking-[0.2em] text-subtext0 bg-mantle/60 backdrop-blur-sm border-b border-surface0">
        <span className="readout text-overlay1">Schematic</span>
        <span className="text-text">{circuitDef.name}</span>
        <span className="ml-auto readout text-[10px] text-overlay0">
          {circuitDef.components.length} components · {circuitDef.nets.length} nets
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.svg
          key={circuitDef.id}
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
          role="img"
          aria-labelledby={titleId}
          aria-describedby={descId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <title id={titleId}>Circuit schematic: {circuitDef.name}</title>
          <desc id={descId}>{description}</desc>
          <SchematicGrid />
          {wires.map((w) => (
            <SchematicWire
              key={`${w.netId}:${w.points}`}
              netId={w.netId}
              label={w.label}
              color={w.color}
              points={w.points}
            />
          ))}
          {circuitDef.components.map((c, idx) => (
            <SchematicNode
              key={c.id}
              component={c}
              x={startX + idx * (nodeW + gap)}
              y={rowY}
              width={nodeW}
              height={nodeH}
            />
          ))}
        </motion.svg>
      </AnimatePresence>
    </section>
  );
}
