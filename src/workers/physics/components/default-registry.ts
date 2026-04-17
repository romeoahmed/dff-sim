// 默认组件注册表：注册所有内置组件类型

import { ClockSource } from "./clock-source";
import { DFlipFlop } from "./flip-flop";
import { ComponentRegistry } from "./registry";
import { SignalSource } from "./signal-source";

export function createDefaultRegistry(): ComponentRegistry {
  const r = new ComponentRegistry();
  // 构造函数接受 ComponentDeps 作为第三参数
  r.register("ClockSource", (id, p, d) => new ClockSource(id, p, d));
  r.register("SignalSource", (id, p, d) => new SignalSource(id, p, d));
  r.register("DFlipFlop", (id, p, d) => new DFlipFlop(id, p, d));
  return r;
}
