import type { CombinationalComponent } from "@/lib/types";

export function settle(component: CombinationalComponent, dt: number, duration: number): void {
  const steps = Math.ceil(duration / dt);
  for (let i = 0; i < steps; i++) {
    component.evaluate();
    component.update(dt);
  }
}
