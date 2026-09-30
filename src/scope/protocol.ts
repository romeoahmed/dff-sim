import type { Frame } from "../model";

export type ScopeStatus = "available" | "unavailable";

/** 初始化转移画布，其余消息传递可克隆的快照。 */
export type ScopeMessage = Readonly<
  | { type: "init"; canvas: OffscreenCanvas }
  | { type: "resize"; width: number; height: number; dpr: number }
  | { type: "draw"; frames: readonly Frame[]; selected: number }
>;
