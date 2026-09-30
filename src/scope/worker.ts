import type { Frame } from "../model";
import type { ScopeMessage, ScopeStatus } from "./protocol";

type Context = OffscreenCanvasRenderingContext2D;
type Size = Readonly<{ width: number; height: number; dpr: number }>;
type Trace = Readonly<{ frames: readonly Frame[]; selected: number }>;

const lanes = [
  { key: "d", label: "D", color: "#88b9ff" },
  { key: "clk", label: "CLK", color: "#e8bb70" },
  { key: "q", label: "Q", color: "#80d6b0" },
  { key: "rst", label: "RST", color: "#c3aacd" },
] as const;

type Lane = (typeof lanes)[number];

/** 选中记录居中；边界处平移窗口，未发生的操作保留为空白。 */
function plotWindow({ frames, selected }: Trace, { width, height }: Size) {
  const left = 62;
  const right = width - 18;
  const top = 46;
  const bottom = height - 22;
  const count = Math.max(5, Math.min(16, Math.floor((right - left) / 40)));
  const index = Math.max(
    0,
    frames.findIndex((frame) => frame.step === selected),
  );
  const start = Math.max(0, Math.min(index - Math.floor(count / 2), frames.length - count));
  const cellWidth = (right - left) / count;

  return {
    left,
    right,
    top,
    bottom,
    count,
    cellWidth,
    laneHeight: (height - top - 28) / lanes.length,
    records: frames.slice(start, start + count).map((frame, offset) => ({
      frame,
      previous: frames[start + offset - 1] ?? frame,
      x: left + offset * cellWidth,
      selected: frame.step === selected,
    })),
  };
}

type Plot = ReturnType<typeof plotWindow>;

function drawGrid(ctx: Context, plot: Plot) {
  const { left, top, bottom, count, cellWidth, records } = plot;
  const selected = records.find((record) => record.selected);

  if (selected) {
    ctx.fillStyle = "#ffffff09";
    ctx.fillRect(selected.x, top - 10, cellWidth, bottom - top + 10);
  }

  ctx.font = "11px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "#ffffff0d";
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let i = 0; i <= count; i++) {
    const x = left + i * cellWidth;
    ctx.moveTo(x, top - 6);
    ctx.lineTo(x, bottom);
  }
  ctx.stroke();

  for (const record of records) {
    const { frame, x } = record;
    ctx.fillStyle = record.selected ? "#f2f5ec" : "#a0b2ad";
    ctx.fillText(String(frame.step).padStart(2, "0"), x + cellWidth / 2, 20);
    if (frame.event !== "rise") continue;

    ctx.strokeStyle = "#e8bb7060";
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x, top - 10);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#e8bb70";
    ctx.fillText("↑", x, top - 19);
  }
}

function drawLane(ctx: Context, plot: Plot, lane: Lane, index: number) {
  const { left, right, top, cellWidth, laneHeight, records } = plot;
  const { key, label, color } = lane;
  const high = top + index * laneHeight + 8;
  const low = high + laneHeight - 30;
  const y = (frame: Frame) => (frame[key] === 1 ? high : low);

  ctx.textAlign = "left";
  ctx.font = "600 12px ui-monospace, monospace";
  ctx.fillStyle = color;
  ctx.fillText(label, 15, (high + low) / 2);
  ctx.font = "10px ui-monospace, monospace";
  ctx.fillStyle = "#849c94";
  ctx.fillText("1", left - 15, high);
  ctx.fillText("0", left - 15, low);

  ctx.strokeStyle = "#ffffff08";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, low);
  ctx.lineTo(right, low);
  ctx.stroke();

  // 带入窗口前一状态，保留左边界上的跳变。
  ctx.beginPath();
  for (const { frame, previous, x } of records) {
    ctx.moveTo(x, y(previous));
    ctx.lineTo(x, y(frame));
    ctx.lineTo(x + cellWidth, y(frame));
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();

  const selected = records.find((record) => record.selected);
  if (!selected) return;

  ctx.beginPath();
  ctx.arc(selected.x + cellWidth / 2, y(selected.frame), 3.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

let context: Context | null = null;
let size: Size = { width: 0, height: 0, dpr: 1 };
let trace: Trace = { frames: [], selected: 0 };

const report = (status: ScopeStatus) => self.postMessage(status);

/** 在快照、尺寸或上下文改变时绘制。 */
function draw() {
  if (!context || size.width <= 0 || size.height <= 0) return;

  context.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  context.fillStyle = "#172725";
  context.fillRect(0, 0, size.width, size.height);

  const plot = plotWindow(trace, size);
  drawGrid(context, plot);
  for (const [index, lane] of lanes.entries()) {
    drawLane(context, plot, lane, index);
  }
}

self.addEventListener("message", ({ data }: MessageEvent<ScopeMessage>) => {
  switch (data.type) {
    case "init":
      context = data.canvas.getContext("2d", { alpha: false });
      report(context ? "available" : "unavailable");
      data.canvas.addEventListener("contextlost", () => report("unavailable"));
      data.canvas.addEventListener("contextrestored", () => {
        draw();
        report("available");
      });
      break;

    case "resize":
      size = { width: data.width, height: data.height, dpr: Math.min(data.dpr, 3) };
      if (context) {
        context.canvas.width = Math.round(size.width * size.dpr);
        context.canvas.height = Math.round(size.height * size.dpr);
      }
      break;

    case "draw":
      trace = { frames: data.frames, selected: data.selected };
      break;
  }

  draw();
});
