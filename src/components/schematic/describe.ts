import type { CircuitDefinition } from "@/lib/types";

function groupByType(components: CircuitDefinition["components"]): [string, number][] {
  const counts = new Map<string, number>();
  for (const c of components) {
    counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  }
  return Array.from(counts.entries());
}

export function buildSchematicDescription(def: CircuitDefinition): string {
  const parts: string[] = [];
  if (def.description) parts.push(def.description);
  const typeSummary = groupByType(def.components)
    .map(([type, count]) => `${count} ${type}`)
    .join(", ");
  parts.push(`${def.components.length} components (${typeSummary})`);
  parts.push(`${def.nets.length} nets`);
  return parts.join(". ");
}
