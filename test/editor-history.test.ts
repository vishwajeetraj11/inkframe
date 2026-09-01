import { describe, expect, it } from "vitest";
import {
  createInitialEditorHistory,
  editorHistoryReducer,
} from "@/lib/editor/history";
import { createDefaultTextOverlay } from "@/lib/editor/defaults";

describe("editor history", () => {
  it("undoes and redoes mutations from outside the Elah timeline", () => {
    const overlay = createDefaultTextOverlay("text-1");
    let state = createInitialEditorHistory();

    state = editorHistoryReducer(state, {
      type: "add-text-overlay",
      aspect: "reel_9_16",
      overlay,
    });
    state = editorHistoryReducer(state, {
      type: "update-text-overlay",
      aspect: "reel_9_16",
      overlayId: overlay.id,
      patch: { text: "Changed in the inspector" },
    });

    expect(state.present.versions.reel_9_16.textOverlays[0]?.text).toBe(
      "Changed in the inspector",
    );

    state = editorHistoryReducer(state, { type: "history/undo" });
    expect(state.present.versions.reel_9_16.textOverlays[0]?.text).toBe("New text");

    state = editorHistoryReducer(state, { type: "history/redo" });
    expect(state.present.versions.reel_9_16.textOverlays[0]?.text).toBe(
      "Changed in the inspector",
    );
  });

  it("carries the timeline into an empty canvas format without adding history", () => {
    let state = createInitialEditorHistory();
    const overlay = createDefaultTextOverlay("text-1");

    state = editorHistoryReducer(state, {
      type: "add-text-overlay",
      aspect: "reel_9_16",
      overlay,
    });
    state = editorHistoryReducer(state, {
      type: "switch-aspect",
      aspect: "widescreen_16_9",
    });

    expect(state.past).toHaveLength(1);
    expect(state.present.activeVersion).toBe("widescreen_16_9");
    expect(state.present.versions.widescreen_16_9).toMatchObject({
      aspect: "widescreen_16_9",
      textOverlays: [overlay],
    });
    expect(state.present.versions.widescreen_16_9.textOverlays).not.toBe(
      state.present.versions.reel_9_16.textOverlays,
    );

    state = editorHistoryReducer(state, { type: "history/clear" });
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
  });

  it("preserves format-specific edits on round-trip switching", () => {
    let state = createInitialEditorHistory();
    const overlay = createDefaultTextOverlay("text-1");

    state = editorHistoryReducer(state, {
      type: "add-text-overlay",
      aspect: "reel_9_16",
      overlay,
    });
    state = editorHistoryReducer(state, {
      type: "switch-aspect",
      aspect: "widescreen_16_9",
    });
    state = editorHistoryReducer(state, {
      type: "update-text-overlay",
      aspect: "widescreen_16_9",
      overlayId: overlay.id,
      patch: { text: "Widescreen layout" },
    });
    state = editorHistoryReducer(state, {
      type: "switch-aspect",
      aspect: "reel_9_16",
    });

    expect(state.present.versions.reel_9_16.textOverlays[0]?.text).toBe("New text");

    state = editorHistoryReducer(state, {
      type: "switch-aspect",
      aspect: "widescreen_16_9",
    });

    expect(state.present.versions.widescreen_16_9.textOverlays[0]?.text).toBe(
      "Widescreen layout",
    );
  });
});
