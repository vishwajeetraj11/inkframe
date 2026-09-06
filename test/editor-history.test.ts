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

describe("deterministic command history", () => {
  const aspect = "reel_9_16" as const;
  const add = { type: "add-text-overlay" as const, aspect, overlay: createDefaultTextOverlay("caption") };

  it("applies a batch once, replays its receipt, and keeps revision monotonic across undo", () => {
    const command = { type: "history/command" as const, operationId: "batch-1", expectedRevision: 0, actions: [add, { type: "update-text-overlay" as const, aspect, overlayId: "caption", patch: { text: "Final caption" } }] };
    let state = editorHistoryReducer(createInitialEditorHistory(), command);
    expect(state.revision).toBe(1);
    expect(state.past).toHaveLength(1);
    const present = state.present;
    state = editorHistoryReducer(state, command);
    expect(state.present).toBe(present);
    expect(state.lastCommandReceipt).toMatchObject({ ok: true, revision: 1 });
    state = editorHistoryReducer(state, { type: "history/undo" });
    expect(state.revision).toBe(2);
    expect(state.present.versions[aspect].textOverlays).toHaveLength(0);
    state = editorHistoryReducer(state, command);
    expect(state.lastCommandReceipt).toMatchObject({ ok: true, revision: 1 });
    expect(state.revision).toBe(2);
    expect(state.present.versions[aspect].textOverlays).toHaveLength(0);
    state = editorHistoryReducer(state, { type: "history/redo" });
    expect(state.revision).toBe(3);
    expect(state.present.versions[aspect].textOverlays[0].text).toBe("Final caption");
  });

  it("rejects stale revisions and operation ID reuse without changing project/history", () => {
    const command = { type: "history/command" as const, operationId: "op", expectedRevision: 0, actions: [add] };
    const applied = editorHistoryReducer(createInitialEditorHistory(), command);
    const stale = editorHistoryReducer(applied, { ...command, operationId: "stale" });
    expect(stale.lastCommandReceipt?.code).toBe("REVISION_CONFLICT");
    expect(stale.present).toBe(applied.present);
    expect(stale.past).toBe(applied.past);
    const reused = editorHistoryReducer(applied, { ...command, expectedRevision: 1, actions: [{ ...add, overlay: createDefaultTextOverlay("different") }] });
    expect(reused.lastCommandReceipt?.code).toBe("OPERATION_ID_CONFLICT");
    expect(reused.present).toBe(applied.present);
  });

  it("rejects an entire batch when a later action is invalid", () => {
    const initial = createInitialEditorHistory();
    const state = editorHistoryReducer(initial, { type: "history/command", operationId: "atomic", expectedRevision: 0, actions: [add, { type: "place-clip", aspect, clipId: "missing", trackId: "inkframe-video", startFrame: 0 }] });
    expect(state.lastCommandReceipt?.code).toBe("NOT_FOUND");
    expect(state.present).toBe(initial.present);
    expect(state.past).toBe(initial.past);
    expect(state.revision).toBe(0);
  });
});
