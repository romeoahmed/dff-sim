import "@fontsource-variable/ibm-plex-sans";
import "./styles/index.css";
import {
  ArrowDownRight,
  ArrowRight,
  ChartNoAxesCombined,
  CircuitBoard,
  CircleHelp,
  Pause,
  Play,
  RotateCcw,
  StepForward,
  X,
  createIcons,
} from "lucide";

import { mountScope } from "./scope";
import { initialState, update } from "./state";
import type { Intent } from "./state";
import { bindControls, canvas, onLogToggle, render, renderLog, showScopeError } from "./view";

createIcons({
  icons: {
    ArrowDownRight,
    ArrowRight,
    ChartNoAxesCombined,
    CircuitBoard,
    CircleHelp,
    Pause,
    Play,
    RotateCcw,
    StepForward,
    X,
  },
  attrs: { "aria-hidden": "true" },
});

const events = new AbortController();
const { signal } = events;
const scope = mountScope(canvas, showScopeError, signal);
let state = initialState;
let timer: number | undefined;

function synchronizeClock() {
  window.clearInterval(timer);
  timer = undefined;
  if (state.running) {
    timer = window.setInterval(() => send({ type: "clock" }), state.interval);
  }
}

function send(intent: Intent) {
  const next = update(state, intent);
  if (next === state) return;

  const clockChanged = next.running !== state.running || next.interval !== state.interval;
  const traceChanged = next.current !== state.current || next.selected !== state.selected;
  state = next;

  if (clockChanged) synchronizeClock();
  if (traceChanged) scope?.draw([...state.past, state.current], state.selected.step);
  render(state);
}

bindControls(send, signal);
onLogToggle(() => renderLog(state), signal);

// 后台暂停；恢复页面后由用户决定何时继续。
document.addEventListener(
  "visibilitychange",
  () => {
    if (document.hidden) send({ type: "pause" });
  },
  { signal },
);
window.addEventListener("pagehide", () => send({ type: "pause" }), { signal });

render(state);
scope?.draw([state.current], state.selected.step);

import.meta.hot?.dispose(() => {
  window.clearInterval(timer);
  events.abort();
});
