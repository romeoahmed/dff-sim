import type { Action } from "./model";

type LessonStep = Readonly<{
  title: string;
  hint: string;
  button: string;
  action: Action;
}>;

/** 引导按真实操作推进，反馈由逻辑模型生成。 */
export const lesson = [
  {
    title: "输入改变，输出会跟着变吗？",
    hint: "将 D 设为 1，保持 CLK = 0。Q 会立刻变成 1 吗？",
    button: "将 D 设为 1",
    action: { type: "data", value: 1 },
  },
  {
    title: "上升沿到来，会记住什么？",
    hint: "D 已为 1。让 CLK 从 0 变为 1，观察 Q 是否更新。",
    button: "产生上升沿",
    action: { type: "clock" },
  },
  {
    title: "时钟为高，还会继续采样吗？",
    hint: "保持 CLK = 1，把 D 改回 0。Q 会立刻跟着归零吗？",
    button: "将 D 设为 0",
    action: { type: "data", value: 0 },
  },
  {
    title: "下降沿也会更新 Q 吗？",
    hint: "把时钟降为 0。观察 Q 是否仍记着上一次采样的值。",
    button: "产生下降沿",
    action: { type: "clock" },
  },
  {
    title: "复位需要等时钟吗？",
    hint: "Q 还记着 1。将 RST 设为 1，观察它能否在没有上升沿时被清零。",
    button: "启用异步复位",
    action: { type: "reset", value: 1 },
  },
  {
    title: "释放复位，会恢复旧值吗？",
    hint: "将 RST 设回 0，保持 CLK 不变。Q 会恢复成复位前的 1 吗？",
    button: "释放复位",
    action: { type: "reset", value: 0 },
  },
] as const satisfies readonly LessonStep[];
