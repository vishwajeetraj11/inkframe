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

  it("treats aspect switching as navigation and can clear unsafe history", () => {
    let state = createInitialEditorHistory();

    state = editorHistoryReducer(state, {
      type: "add-text-overlay",
      aspect: "reel_9_16",
      overlay: createDefaultTextOverlay("text-1"),
    });
    state = editorHistoryReducer(state, {
      type: "switch-aspect",
      aspect: "widescreen_16_9",
    });

    expect(state.past).toHaveLength(1);
    expect(state.present.activeVersion).toBe("widescreen_16_9");

    state = editorHistoryReducer(state, { type: "history/clear" });
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
  });
});
