import { lesson } from "./lesson";
import { eventNames, explain } from "./model";
import type { Frame } from "./model";
import type { Intent, State } from "./state";

function element<T extends HTMLElement>(id: string, type: new () => T): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`Expected ${type.name}: #${id}`);
  return node;
}

const text = (id: string) => element(id, HTMLElement);

const controls = {
  zero: element("data-zero", HTMLInputElement),
  one: element("data-one", HTMLInputElement),
  reset: element("reset", HTMLInputElement),
  step: element("step", HTMLButtonElement),
  stepLabel: text("step-label"),
  restart: element("restart", HTMLButtonElement),
};

const signals = {
  d: element("value-d", HTMLOutputElement),
  clk: element("value-clk", HTMLOutputElement),
  q: element("value-q", HTMLOutputElement),
  rst: text("value-rst"),
  chip: text("chip-state"),
};

const playback = {
  button: element("play", HTMLButtonElement),
  label: text("play-label"),
  speed: element("speed", HTMLSelectElement),
  status: text("run-status"),
};

const history = {
  slider: element("history", HTMLInputElement),
  position: element("position", HTMLOutputElement),
  latest: element("latest", HTMLButtonElement),
  status: text("history-status"),
  event: text("event-name"),
  explanation: text("explanation"),
  snapshot: text("snapshot"),
  log: element("event-log", HTMLDetailsElement),
  records: text("records"),
};

const guide = {
  title: text("learn-title"),
  hint: text("lesson-hint"),
  count: text("lesson-count"),
  label: text("lesson-button"),
  button: element("lesson-next", HTMLButtonElement),
  note: text("guide-note"),
  result: text("lesson-result"),
  progress: element("lesson-progress", HTMLProgressElement),
};

// 初始文案以 HTML 为准，退出引导时复用。
const introduction = {
  title: guide.title.textContent,
  hint: guide.hint.textContent,
  button: guide.label.textContent,
  note: guide.note.textContent,
  count: guide.count.textContent,
};

export const canvas = element("scope", HTMLCanvasElement);
const scopeError = element("scope-error", HTMLParagraphElement);

export const showScopeError = (unavailable: boolean) => {
  scopeError.hidden = !unavailable;
};

function chipState(frame: Frame): string {
  if (frame.rst === 1) return "异步复位中";
  if (frame.event === "rise") return "已采样 · 保持中";
  return "保持 · 等待上升沿";
}

function lessonContent(index: number | null) {
  if (index === null) return introduction;

  const step = lesson[index];
  if (step) {
    return {
      ...step,
      count: `第 ${index + 1} / ${lesson.length} 步`,
      note: "手动改变信号或开启自动时钟会退出引导。",
    };
  }

  return {
    title: "现在，试着独立操作。",
    hint: "把 1 存入 Q，再让 D 变为 0。试着只用时钟将 Q 更新为 0，并解释每一步。",
    button: "再做一次",
    count: "已完成",
    note: "六步已完成。你可以继续探索，也可以重新练习。",
  };
}

function renderSignals({ current, running, interval }: State) {
  const { d, clk, q, rst } = current;

  signals.d.value = String(d);
  signals.clk.value = String(clk);
  signals.q.value = String(q);
  signals.rst.textContent = String(rst);
  signals.d.dataset.bit = String(d);
  signals.q.dataset.bit = String(q);
  signals.chip.textContent = chipState(current);

  controls.zero.checked = d === 0;
  controls.one.checked = d === 1;
  controls.reset.checked = rst === 1;
  controls.step.disabled = running;
  controls.stepLabel.textContent = clk === 1 ? "推进至 0 ↓" : "推进至 1 ↑";

  playback.button.dataset.running = String(running);
  playback.label.textContent = running ? "暂停时钟" : "自动时钟";
  playback.status.textContent = running ? "自动运行 · 暂停后可单步" : "手动操作";
  playback.speed.value = String(interval);
}

function renderGuide({ lessonIndex, current }: State) {
  const content = lessonContent(lessonIndex);
  const progress = lessonIndex ?? 0;

  guide.title.textContent = content.title;
  guide.hint.textContent = content.hint;
  guide.label.textContent = content.button;
  guide.count.textContent = content.count;
  guide.note.textContent = content.note;
  guide.progress.max = lesson.length;
  guide.progress.value = progress;
  guide.result.hidden = progress === 0;
  guide.result.textContent = progress > 0 ? `观察结果：${explain(current)}` : "";
}

function renderHistory({ current, past, selected, running }: State) {
  const { step, d, clk, q, rst, event } = selected;
  const latest = step === current.step;
  const values = [`D ${d}`, `CLK ${clk}`, `Q ${q}`, `RST ${rst}`].join("   ");
  const note = latest ? "" : " · 控制区显示最新状态";

  history.slider.min = String(past[0]?.step ?? current.step);
  history.slider.max = String(current.step);
  history.slider.value = String(step);
  history.slider.disabled = past.length === 0;
  history.slider.setAttribute(
    "aria-valuetext",
    `第 ${step} 次操作，${eventNames[event]}，${values}`,
  );
  history.position.value = `#${String(step).padStart(2, "0")}`;
  history.latest.disabled = latest;

  history.status.setAttribute("aria-live", running ? "off" : "polite");
  history.event.textContent = `${latest ? "当前" : "回看"} · ${eventNames[event]}`;
  history.explanation.textContent = explain(selected);
  history.snapshot.textContent = `#${step}   ${values}${note}`;
}

/** 表格仅包含模型生成的数据，并只在展开时更新。 */
export function renderLog({ past, current, selected }: State) {
  if (!history.log.open) return;

  history.records.innerHTML = [...past, current]
    .map(
      ({ step, event, d, clk, q, rst }) => `
      <tr aria-current="${step === selected.step}">
        <th scope="row">${step}</th>
        <td>${eventNames[event]}</td>
        <td>${d}</td>
        <td>${clk}</td>
        <td>${q}</td>
        <td>${rst}</td>
      </tr>
    `,
    )
    .join("");
}

export function render(state: State) {
  renderSignals(state);
  renderGuide(state);
  renderHistory(state);
  renderLog(state);
}

/** 控件只发出意图，所有行为由状态变换决定。 */
export function bindControls(send: (intent: Intent) => void, signal: AbortSignal) {
  const on = (target: EventTarget, event: string, intent: () => Intent) => {
    target.addEventListener(event, () => send(intent()), { signal });
  };

  on(controls.zero, "change", () => ({ type: "data", value: 0 }));
  on(controls.one, "change", () => ({ type: "data", value: 1 }));
  on(controls.step, "click", () => ({ type: "clock" }));
  on(controls.reset, "change", () => ({
    type: "reset",
    value: controls.reset.checked ? 1 : 0,
  }));
  on(controls.restart, "click", () => ({ type: "restart" }));
  on(guide.button, "click", () => ({ type: "lesson" }));
  on(playback.button, "click", () => ({ type: "toggle-clock" }));
  on(playback.speed, "change", () => ({ type: "speed", interval: Number(playback.speed.value) }));
  on(history.slider, "input", () => ({ type: "inspect", step: history.slider.valueAsNumber }));
  on(history.latest, "click", () => ({ type: "latest" }));
}

export function onLogToggle(callback: () => void, signal: AbortSignal) {
  history.log.addEventListener("toggle", callback, { signal });
}
