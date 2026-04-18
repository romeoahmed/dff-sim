import type { CircuitDefinition } from "@/lib/types";

export interface SchematicDescriptionParts {
  readonly description: string;
  readonly componentCount: number;
  readonly typeSummary: ReadonlyArray<{ readonly type: string; readonly count: number }>;
  readonly netCount: number;
}

export function buildSchematicDescriptionParts(def: CircuitDefinition): SchematicDescriptionParts {
  const counts = new Map<string, number>();
  for (const c of def.components) {
    counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  }
  const typeSummary = Array.from(counts.entries()).map(([type, count]) => ({ type, count }));
  return {
    description: def.description,
    componentCount: def.components.length,
    typeSummary,
    netCount: def.nets.length,
  };
}
