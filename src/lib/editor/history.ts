import { createInitialProjectSession } from "./defaults";
import { editorReducer, type EditorAction } from "./reducer";
import type { ProjectSession } from "./types";

const MAX_HISTORY_ENTRIES = 100;

export interface EditorHistoryState {
  past: ProjectSession[];
  present: ProjectSession;
  future: ProjectSession[];
}

export type EditorHistoryAction =
  | EditorAction
  | { type: "history/undo" }
  | { type: "history/redo" }
  | { type: "history/clear" };

export const createInitialEditorHistory = (): EditorHistoryState => ({
  past: [],
  present: createInitialProjectSession(),
  future: [],
});

export const editorHistoryReducer = (
  state: EditorHistoryState,
  action: EditorHistoryAction,
): EditorHistoryState => {
  if (action.type === "history/undo") {
    const previous = state.past.at(-1);
    if (!previous) return state;

    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future].slice(0, MAX_HISTORY_ENTRIES),
    };
  }

  if (action.type === "history/redo") {
    const next = state.future[0];
    if (!next) return state;

    return {
      past: [...state.past, state.present].slice(-MAX_HISTORY_ENTRIES),
      present: next,
      future: state.future.slice(1),
    };
  }

  if (action.type === "history/clear") {
    return state.past.length === 0 && state.future.length === 0
      ? state
      : { past: [], present: state.present, future: [] };
  }

  const next = editorReducer(state.present, action);
  if (next === state.present) return state;

  // Switching canvas format is navigation, not an editable project mutation.
  if (action.type === "switch-aspect") {
    return { ...state, present: next };
  }

  return {
    past: [...state.past, state.present].slice(-MAX_HISTORY_ENTRIES),
    present: next,
    future: [],
  };
};
