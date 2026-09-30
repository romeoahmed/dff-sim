import { lesson } from "./lesson";
import { initialFrame, transition } from "./model";
import type { Action, Frame } from "./model";

const historyLimit = 64;

/** current 为实时状态，past 为此前记录，selected 为正在查看的快照。 */
export type State = Readonly<{
  current: Frame;
  past: readonly Frame[];
  selected: Frame;
  /** null 表示自由探索，数值为已完成的引导步数。 */
  lessonIndex: number | null;
  running: boolean;
  interval: number;
}>;

export type Intent =
  | Action
  | Readonly<
      | { type: "restart" }
      | { type: "lesson" }
      | { type: "toggle-clock" }
      | { type: "pause" }
      | { type: "speed"; interval: number }
      | { type: "inspect"; step: number }
      | { type: "latest" }
    >;

export const initialState: State = {
  current: initialFrame,
  past: [],
  selected: initialFrame,
  lessonIndex: null,
  running: false,
  interval: 1200,
};

function record(state: State, action: Action): State {
  const current = transition(state.current, action);
  if (current === state.current) return state;

  return {
    ...state,
    current,
    past: [...state.past, state.current].slice(-(historyLimit - 1)),
    selected: current,
  };
}

function advanceLesson(state: State): State {
  const index = state.lessonIndex ?? lesson.length;
  const step = lesson[index];
  if (!step) return { ...initialState, interval: state.interval, lessonIndex: 0 };

  return {
    ...record(state, step.action),
    lessonIndex: index + 1,
  };
}

/** 用户操作与时钟沿共用的纯状态变换。 */
export function update(state: State, intent: Intent): State {
  switch (intent.type) {
    case "data":
    case "clock":
    case "reset": {
      const next = record(state, intent);
      return next === state ? state : { ...next, lessonIndex: null };
    }

    case "restart":
      return { ...initialState, interval: state.interval };

    case "lesson":
      return advanceLesson(state);

    case "toggle-clock":
      if (state.running) return { ...state, running: false };
      return { ...state, running: true, lessonIndex: null, selected: state.current };

    case "pause":
      return state.running ? { ...state, running: false } : state;

    case "speed":
      return { ...state, interval: intent.interval };

    case "inspect": {
      const selected = [...state.past, state.current].find((frame) => frame.step === intent.step);
      return selected ? { ...state, selected, running: false } : state;
    }

    case "latest":
      return { ...state, selected: state.current };
  }
}
