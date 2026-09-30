export type Bit = 0 | 1;

export type Action = Readonly<
  { type: "data"; value: Bit } | { type: "clock" } | { type: "reset"; value: Bit }
>;

/** 一次操作完成后的状态，按操作顺序编号。 */
export type Frame = Readonly<{
  step: number;
  d: Bit;
  clk: Bit;
  q: Bit;
  rst: Bit;
  event: "initial" | "data" | "rise" | "fall" | "reset" | "release";
}>;

/** 教学起点约定为全零。 */
export const initialFrame: Frame = {
  step: 0,
  d: 0,
  clk: 0,
  q: 0,
  rst: 0,
  event: "initial",
};

function applyInput(frame: Frame, action: Action): Frame {
  switch (action.type) {
    case "data":
      if (action.value === frame.d) return frame;
      return { ...frame, d: action.value, event: "data" };

    case "reset":
      if (action.value === frame.rst) return frame;
      return {
        ...frame,
        rst: action.value,
        event: action.value === 1 ? "reset" : "release",
      };

    case "clock":
      return {
        ...frame,
        clk: frame.clk === 0 ? 1 : 0,
        event: frame.clk === 0 ? "rise" : "fall",
      };
  }
}

function output(frame: Frame): Bit {
  if (frame.rst === 1) return 0;
  if (frame.event === "rise") return frame.d;
  return frame.q;
}

/** 复位优先于采样；输入值相同时复用原记录。 */
export function transition(frame: Frame, action: Action): Frame {
  const next = applyInput(frame, action);
  if (next === frame) return frame;

  return { ...next, step: frame.step + 1, q: output(next) };
}

export const eventNames = {
  initial: "初始状态",
  data: "输入改变",
  rise: "上升沿 ↑",
  fall: "下降沿 ↓",
  reset: "复位生效",
  release: "释放复位",
} satisfies Record<Frame["event"], string>;

/** 根据记录快照解释该次操作。 */
export function explain(frame: Frame): string {
  const { d, clk, q, rst, event } = frame;
  if (rst === 1) return "RST = 1，复位优先于采样，Q 被强制为 0，无需等待时钟。";

  switch (event) {
    case "initial":
      return "所有信号从 0 开始。先将 D 设为 1，再推进时钟，观察 Q 何时更新。";

    case "reset":
    case "release":
      return `复位已释放，Q 仍为 ${q}。即使 CLK 为高，也要等下一个上升沿才采样。`;

    case "rise":
      return `CLK 从 0 变为 1，Q 采样此刻的 D = ${d}，得到 Q = ${q}。`;

    case "fall":
      return `CLK 从 1 变为 0。下降沿不触发采样，Q 保持为 ${q}。`;

    case "data": {
      const reason = clk === 1 ? "CLK 持续为高，不会再次采样。" : "输入改变本身不会更新输出。";
      return `D 变为 ${d}，没有新的上升沿，Q 仍为 ${q}。${reason}`;
    }
  }
}
