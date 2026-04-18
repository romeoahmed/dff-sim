import { useAtomValue } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { circuitDefAtom } from "@/atoms/simulation-atoms";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { buildSchematicDescription } from "./describe";
import { SchematicGrid } from "./SchematicGrid";
import { SchematicNode } from "./SchematicNode";
import { SchematicWire } from "./SchematicWire";

const LANDSCAPE_VIEWBOX = { w: 1200, h: 400 };
const PORTRAIT_VIEWBOX = { w: 400, h: 1200 };
const NODE = { w: 120, h: 80 };

// Orthogonal wire routing. In landscape we break the horizontal run at the
// midpoint x; in portrait we break the vertical run at the midpoint y. Keeps
// wires clean even when source and dest are at different row / column indices.
function landscapeWirePoints(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `${x1},${y1} ${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}
function portraitWirePoints(x1: number, y1: number, x2: number, y2: number): string {
  const my = (y1 + y2) / 2;
  return `${x1},${y1} ${x1},${my} ${x2},${my} ${x2},${y2}`;
}

export function CircuitSchematic({ className = "" }: { className?: string }) {
  const circuitDef = useAtomValue(circuitDefAtom);
  const isPortrait = useMediaQuery("(min-width: 1440px)");
  const { t } = useLingui();
  if (!circuitDef) return <div className={className} />;

  const viewbox = isPortrait ? PORTRAIT_VIEWBOX : LANDSCAPE_VIEWBOX;

  const titleId = `schematic-title-${circuitDef.id}`;
  const descId = `schematic-desc-${circuitDef.id}`;
  const description = buildSchematicDescription(circuitDef);

  // Place nodes: horizontal row in landscape, vertical column in portrait.
  const positions = new Map<string, { x: number; y: number }>();
  if (isPortrait) {
    const colX = viewbox.w / 2 - NODE.w / 2;
    const n = circuitDef.components.length;
    const totalH = n * NODE.h + (n - 1) * 80;
    const startY = (viewbox.h - totalH) / 2;
    circuitDef.components.forEach((c, i) => {
      positions.set(c.id, { x: colX, y: startY + i * (NODE.h + 80) });
    });
  } else {
    const n = circuitDef.components.length;
    const gap = 180;
    const totalW = n * NODE.w + (n - 1) * gap;
    const startX = (viewbox.w - totalW) / 2;
    const rowY = viewbox.h / 2 - NODE.h / 2;
    circuitDef.components.forEach((c, i) => {
      positions.set(c.id, { x: startX + i * (NODE.w + gap), y: rowY });
    });
  }

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
        // Wires exit the driver on its trailing edge and enter the load on its leading edge.
        // Landscape: trailing = right, leading = left. Portrait: trailing = bottom, leading = top.
        const x1 = isPortrait ? src.x + NODE.w / 2 : src.x + NODE.w;
        const y1 = isPortrait ? src.y + NODE.h : src.y + NODE.h / 2;
        const x2 = isPortrait ? dst.x + NODE.w / 2 : dst.x;
        const y2 = isPortrait ? dst.y : dst.y + NODE.h / 2;
        return {
          netId: net.id,
          label: probe?.label ?? net.id,
          color: probe?.color ?? "var(--color-border-strong)",
          points: isPortrait
            ? portraitWirePoints(x1, y1, x2, y2)
            : landscapeWirePoints(x1, y1, x2, y2),
        };
      });
    })
    .filter((w): w is WireData => w !== null);

  return (
    <section className={`relative bg-panel flex flex-col overflow-hidden min-h-0 ${className}`}>
      <header
        className="h-8 flex items-center gap-3 px-4 border-b border-border bg-panel-muted
          text-[11px] uppercase tracking-[0.2em]"
      >
        <span className="readout text-fg-subtle">
          <Trans>Schematic</Trans>
        </span>
        <span className="text-fg text-caption">{circuitDef.name}</span>
        <span className="ml-auto readout text-[10px] text-fg-subtle">
          <Plural
            value={circuitDef.components.length}
            one="# component"
            other="# components"
          />
          {" · "}
          <Plural
            value={circuitDef.nets.length}
            one="# net"
            other="# nets"
          />
        </span>
      </header>
      <div className="relative flex-1 min-h-0">
        <AnimatePresence mode="wait">
          <motion.svg
            key={`${circuitDef.id}-${isPortrait ? "p" : "l"}`}
            viewBox={`0 0 ${viewbox.w} ${viewbox.h}`}
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
            <title id={titleId}>{t`Circuit schematic: ${circuitDef.name}`}</title>
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
            {circuitDef.components.map((c) => {
              const pos = positions.get(c.id);
              if (!pos) return null;
              return (
                <SchematicNode
                  key={c.id}
                  component={c}
                  x={pos.x}
                  y={pos.y}
                  width={NODE.w}
                  height={NODE.h}
                />
              );
            })}
          </motion.svg>
        </AnimatePresence>
      </div>
    </section>
  );
}
