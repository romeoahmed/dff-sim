import type { Component, ComponentDeps, ComponentFactory } from "@/lib/types";

export class ComponentRegistry {
  private readonly factories = new Map<string, ComponentFactory>();

  register(type: string, factory: ComponentFactory): void {
    this.factories.set(type, factory);
  }

  create(
    type: string,
    id: string,
    params: Record<string, unknown>,
    deps: ComponentDeps,
  ): Component {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`Unknown component type: ${type}`);
    }
    return factory(id, params, deps);
  }

  has(type: string): boolean {
    return this.factories.has(type);
  }
}
