import { createInitialProjectSession } from "./defaults";
import { editorReducer, type EditorAction } from "./reducer";
import { validateVersionPlacement } from "./timeline";
import { sourceTimeAtFrame } from "./time-mapping";
import { FPS } from "./constants";
import { ensureEditorTracks } from "./tracks";
import type { ProjectSession } from "./types";

const MAX_HISTORY_ENTRIES = 100;

export interface EditorHistoryState {
  past: ProjectSession[];
  present: ProjectSession;
  future: ProjectSession[];
  /** Session revision never travels backwards with undo snapshots. */
  revision?: number;
  commandReceipts?: EditorCommandReceipt[];
  lastCommandReceipt?: EditorCommandReceipt;
}

export interface EditorCommandReceipt {
  operationId: string;
  fingerprint: string;
  ok: boolean;
  revision: number;
  code?: string;
  message: string;
}

export interface EditorCommand {
  type: "history/command";
  operationId: string;
  expectedRevision: number;
  actions: EditorAction[];
  /** Stable tool input identity when actions depend on current state. */
  requestFingerprint?: string;
  preflightFailure?: {code: string; message: string};
}

export type EditorHistoryAction =
  | EditorAction
  | EditorCommand
  | { type: "history/undo" }
  | { type: "history/redo" }
  | { type: "history/clear" };

export const createInitialEditorHistory = (): EditorHistoryState => ({
  past: [],
  present: createInitialProjectSession(),
  future: [],
  revision: 0,
});

/** Preflight the requested placement before sanitization can hide an invalid edit. */
export const validateEditorCommandAction = (state: ProjectSession, action: EditorAction) => {
  const version = state.versions[action.aspect];
  let candidate = version;
  const missing = (message: string) => [{ code: "NOT_FOUND", message }];
  switch (action.type) {
    case "place-clip": {
      if (!version.clips.some((clip) => clip.id === action.clipId)) return missing("Clip not found");
      candidate = { ...version, clips: version.clips.map((clip) => clip.id === action.clipId ? { ...clip, trackId: action.trackId, startFrame: action.startFrame, endFrame: action.startFrame + clip.endFrame - clip.startFrame } : clip) };
      break;
    }
    case "update-clip":
      if (!version.clips.some((clip) => clip.id === action.clipId)) return missing("Clip not found");
      candidate = { ...version, clips: version.clips.map((clip) => clip.id === action.clipId ? { ...clip, ...action.patch } : clip) };
      break;
    case "set-clip-keyframes":
      if (!version.clips.some(clip => clip.id === action.clipId)) return missing("Clip not found");
      candidate = {...version, clips: version.clips.map(clip => clip.id === action.clipId ? {...clip, keyframes: action.keyframes} : clip)}; break;
    case "set-clip-time-mapping": {
      const clip = version.clips.find(clip => clip.id === action.clipId);
      if (!clip) return missing("Clip not found");
      let next = {...clip, timeMapping: action.mapping, sourceDurationUs: action.sourceDurationUs ?? clip.sourceDurationUs};
      if (action.mapping.kind === "normal" && clip.timeMapping && clip.timeMapping.kind !== "normal") {
        const sourceFrame = sourceTimeAtFrame(clip.timeMapping, 0, clip.trimStartFrame, FPS) * FPS / 1e6;
        const integralFrame = Math.round(sourceFrame);
        if (Math.abs(sourceFrame - integralFrame) > 1e-7) return [{code:"UNSUPPORTED_SOURCE_OFFSET",message:"Normal playback cannot represent this fractional source frame; use a constant 1× speed map to preserve its exact source time"}];
        next = {...next,trimStartFrame:integralFrame,trimEndFrame:integralFrame+clip.endFrame-clip.startFrame};
      }
      candidate = {...version, clips:version.clips.map(item=>item.id === clip.id ? next : item)}; break;
    }
    case "upsert-caption-cues": {
      const ids = new Set(action.cues.map(cue => cue.id));
      if (ids.size !== action.cues.length) return [{code:"DUPLICATE_ID",message:"Caption IDs must be unique within the batch"}];
      candidate = {...version, captionCues: [...(version.captionCues ?? []).filter(cue => !ids.has(cue.id)), ...action.cues]}; break;
    }
    case "remove-caption-cue":
      if (!(version.captionCues ?? []).some(cue => cue.id === action.cueId)) return missing("Caption cue not found");
      break;
    case "set-ducking-rule":
      candidate = {...version, duckingRules: [...(version.duckingRules ?? []).filter(rule => rule.id !== action.rule.id),action.rule]}; break;
    case "remove-ducking-rule":
      if (!(version.duckingRules ?? []).some(rule => rule.id === action.ruleId)) return missing("Ducking rule not found");
      break;
    case "freeze-clip-range": {
      const clip = version.clips.find(clip => clip.id === action.clipId);
      if (!clip) return missing("Clip not found");
      if (version.transitions.some(edge => edge.fromClipId === clip.id || edge.toClipId === clip.id)) return [{code:"UNSUPPORTED_TRANSITION",message:"Remove adjacent transitions before freezing this clip"}];
      if (action.startFrame < clip.startFrame || action.endFrame > clip.endFrame || action.endFrame <= action.startFrame) return [{code:"INVALID_INTERVAL",message:"Freeze interval must lie inside its clip"}];
      candidate = {...version, clips: version.clips.map(item => item.id === clip.id ? {...item,timeMapping:{kind:"hold" as const,sourceTimeUs:action.sourceTimeUs},sourceDurationUs:action.sourceDurationUs ?? item.sourceDurationUs} : item)}; break;
    }
    case "add-clip": candidate = { ...version, clips: [...version.clips, action.clip] }; break;
    case "replace-version": candidate = action.version; break;
    case "add-track": {
      const tracks = ensureEditorTracks(version);
      if (tracks.some((track) => track.id === action.track.id)) return [{ code: "DUPLICATE_ID", message: "Track ID already exists" }];
      candidate = { ...version, tracks: [...tracks, action.track] }; break;
    }
    case "reorder-tracks": {
      const tracks = ensureEditorTracks(version);
      if (action.trackIds.length !== tracks.length || new Set(action.trackIds).size !== tracks.length || action.trackIds.some((id) => !tracks.some((track) => track.id === id))) return [{ code: "INVALID_TRACK", message: "Include every track ID exactly once" }];
      break;
    }
    default: return [];
  }
  return validateVersionPlacement(candidate);
};

export const editorHistoryReducer = (
  state: EditorHistoryState,
  action: EditorHistoryAction,
): EditorHistoryState => {
  if (action.type === "history/command") {
    const fingerprint = action.requestFingerprint ?? JSON.stringify(action.actions, (_key, value) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
        : value,
    );
    const revision = state.revision ?? 0;
    const previous = state.commandReceipts?.find((entry) => entry.operationId === action.operationId);
    const receipt = (ok: boolean, message: string, code?: string): EditorCommandReceipt => ({
      operationId: action.operationId, fingerprint, ok, message, code, revision,
    });
    if (previous) {
      return { ...state, lastCommandReceipt: previous.fingerprint === fingerprint
        ? previous
        : receipt(false, "Operation ID was already used for different actions", "OPERATION_ID_CONFLICT") };
    }
    const remember = (next: EditorHistoryState, entry: EditorCommandReceipt): EditorHistoryState => ({
      ...next,
      commandReceipts: [...(state.commandReceipts ?? []), entry].slice(-100),
      lastCommandReceipt: entry,
    });
    if (action.expectedRevision !== revision) {
      return remember(state, receipt(false, "Project changed; inspect the current revision and retry with a new operation ID", "REVISION_CONFLICT"));
    }
    if (action.preflightFailure) return remember(state, receipt(false, action.preflightFailure.message, action.preflightFailure.code));
    if (!action.operationId.trim() || action.actions.length === 0) {
      return remember(state, receipt(false, "A command needs an operation ID and at least one action", "INVALID_COMMAND"));
    }
    let present = state.present;
    for (const mutation of action.actions) {
      const issues = validateEditorCommandAction(present, mutation);
      if (issues.length) return remember(state, receipt(false, issues[0].message, issues[0].code));
      const next = editorReducer(present, mutation);
      if (next === present && !["place-clip", "update-clip", "reorder-tracks", "set-clip-keyframes", "set-clip-time-mapping", "set-ducking-rule", "upsert-caption-cues"].includes(mutation.type)) {
        return remember(state, receipt(false, "Editor rejected the requested action or it made no change", "ACTION_REJECTED"));
      }
      present = next;
    }
    if (present === state.present) return remember(state, receipt(true, "Command already satisfied"));
    const next = {
      ...state,
      past: [...state.past, state.present].slice(-MAX_HISTORY_ENTRIES),
      present,
      future: [],
      revision: revision + 1,
    };
    return remember(next, { ...receipt(true, "Command applied"), revision: revision + 1 });
  }

  if (action.type === "history/undo") {
    const previous = state.past.at(-1);
    if (!previous) return state;

    return {
      ...state,
      revision: (state.revision ?? 0) + 1,
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future].slice(0, MAX_HISTORY_ENTRIES),
    };
  }

  if (action.type === "history/redo") {
    const next = state.future[0];
    if (!next) return state;

    return {
      ...state,
      revision: (state.revision ?? 0) + 1,
      past: [...state.past, state.present].slice(-MAX_HISTORY_ENTRIES),
      present: next,
      future: state.future.slice(1),
    };
  }

  if (action.type === "history/clear") {
    return state.past.length === 0 && state.future.length === 0
      ? state
      : { ...state, past: [], present: state.present, future: [] };
  }

  const next = editorReducer(state.present, action);
  if (next === state.present) return state;

  // Switching canvas format is navigation. A blank target may be initialized
  // from the current timeline, but the switch itself should not create an undo step.
  if (action.type === "switch-aspect") {
    return { ...state, present: next, revision: (state.revision ?? 0) + 1 };
  }

  return {
    ...state,
    revision: (state.revision ?? 0) + 1,
    past: [...state.past, state.present].slice(-MAX_HISTORY_ENTRIES),
    present: next,
    future: [],
  };
};
