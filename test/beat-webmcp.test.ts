import { describe, expect, it, vi } from "vitest";
import { createInitialEditorHistory, editorHistoryReducer } from "@/lib/editor/history";
import { createEditorWebMcpTools } from "@/lib/editor/webmcp/tools";
import type { AssetRef } from "@/lib/editor/types";

function setup() {
  let state = createInitialEditorHistory();
  const assets: AssetRef[] = [
    { assetId: "v1", kind: "video", name: "First", size: 10, mimeType: "video/mp4", mediaMetadata: { durationUs: 10e6 } },
    { assetId: "v2", kind: "video", name: "Second", size: 10, mimeType: "video/mp4", mediaMetadata: { durationUs: 8e6 } },
    { assetId: "music", kind: "audio", name: "Music", size: 10, mimeType: "audio/wav", mediaMetadata: { durationUs: 20e6 } },
  ];
  const analyzeMusic = vi.fn(async () => ({ beatTimesSeconds: Array.from({ length: 20 }, (_, i) => i * 0.5), durationSeconds: 6, bpm: 120, confidence: 0.9, warnings: [] as string[] }));
  const tools = createEditorWebMcpTools({ getState: () => state, getAssets: () => assets, analyzeMusic,
    dispatchCommand: (action) => { state = editorHistoryReducer(state, action); },
  });
  const call = async (name: string, input: unknown) => JSON.parse(await tools.find((tool) => tool.name === name)!.execute(input));
  const input = { aspect: "reel_9_16", videos: [{ assetId: "v1", preferredStartSeconds: 2 }, { assetId: "v2" }], audioAssetId: "music", durationSeconds: 6, musicStartSeconds: 1 };
  return { call, input, assets, analyzeMusic, state: () => state, undo: () => { state = editorHistoryReducer(state, { type: "history/undo" }); } };
}

describe("beat montage WebMCP workflow", () => {
  it("plans without mutations and applies audio/source trims in one undoable retry-safe command", async () => {
    const s = setup();
    const before = s.state().present;
    const plan = await s.call("editor_plan_beat_montage", s.input);
    expect(s.state().present).toBe(before);
    expect(s.analyzeMusic).toHaveBeenCalledWith("music", { startSeconds: 1, durationSeconds: 6 }, expect.any(AbortSignal));
    const request = { aspect: "reel_9_16", planId: plan.planId, expectedRevision: plan.revision, operationId: "apply-1", confirmed: true };
    const applied = await s.call("editor_apply_beat_montage", request);
    expect(applied.ok).toBe(true);
    const timeline = s.state().present.versions.reel_9_16;
    expect(timeline.clips[0].trimStartFrame).toBe(60);
    expect(timeline.clips.every((clip) => clip.volume === 0)).toBe(true);
    expect(timeline.audioTracks[0]).toMatchObject({ assetId: "music", trimStartFrame: 30, trimEndFrame: 210, endFrame: 180 });
    expect(s.state().past).toHaveLength(1);
    expect((await s.call("editor_apply_beat_montage", request)).ok).toBe(true);
    expect(s.state().past).toHaveLength(1);
    s.undo();
    expect(s.state().present).toEqual(before);
  });

  it("rejects missing/wrong media and insufficient music before decoding", async () => {
    const s = setup();
    await expect(s.call("editor_plan_beat_montage", { ...s.input, audioAssetId: "v1" })).rejects.toThrow("audio");
    await expect(s.call("editor_plan_beat_montage", { ...s.input, musicStartSeconds: 18 })).rejects.toThrow("too short");
    expect(s.analyzeMusic).not.toHaveBeenCalled();
  });

  it("rejects decoded music shorter than its metadata", async () => {
    const s = setup();
    s.analyzeMusic.mockResolvedValueOnce({ beatTimesSeconds: [0.5, 1], durationSeconds: 2, bpm: 120, confidence: 0.9, warnings: [] });
    await expect(s.call("editor_plan_beat_montage", s.input)).rejects.toThrow("Decoded music is too short");
    expect(s.state().past).toHaveLength(0);
  });

  it("preserves custom text lane ordering and clips text at the new duration", async () => {
    const s = setup();
    const timeline = s.state().present.versions.reel_9_16;
    timeline.tracks = [{ id: "titles", kind: "text", name: "Titles", order: 0 }];
    timeline.textOverlays = [{ id: "title", trackId: "titles", text: "Opening", startFrame: 0, endFrame: 240, x: 50, y: 50, fontSize: 40, color: "#ffffff", fontFamily: "sans", fontWeight: 700, fontStyle: "normal", stylePreset: "classic" }];
    const plan = await s.call("editor_plan_beat_montage", s.input);
    const applied = await s.call("editor_apply_beat_montage", { aspect: "reel_9_16", planId: plan.planId, expectedRevision: plan.revision, operationId: "text", confirmed: true });
    expect(applied.ok).toBe(true);
    expect(s.state().present.versions.reel_9_16.textOverlays[0]).toMatchObject({ trackId: "titles", endFrame: 180 });
    const tracks = s.state().present.versions.reel_9_16.tracks!;
    expect(tracks).toContainEqual(expect.objectContaining({ id: "titles", kind: "text", name: "Titles" }));
    expect(tracks.findIndex((track) => track.id === "titles")).toBeLessThan(tracks.findIndex((track) => track.id === "inkframe-elements"));
  });

  it("rejects asset changes and cross-aspect application", async () => {
    const s = setup();
    const plan = await s.call("editor_plan_beat_montage", s.input);
    const request = { aspect: "widescreen_16_9", planId: plan.planId, expectedRevision: plan.revision, operationId: "wrong-aspect", confirmed: true };
    expect((await s.call("editor_apply_beat_montage", request)).ok).toBe(false);
    s.assets[0].mediaMetadata!.durationUs = 1e6;
    expect((await s.call("editor_apply_beat_montage", { ...request, aspect: "reel_9_16", operationId: "changed-media" })).ok).toBe(false);
    expect(s.state().past).toHaveLength(0);
  });

  it("rejects stale revisions and changed payloads reusing an operation id", async () => {
    const s = setup();
    const plan = await s.call("editor_plan_beat_montage", s.input);
    const request = { aspect: "reel_9_16", planId: plan.planId, expectedRevision: plan.revision, operationId: "once", confirmed: true };
    expect((await s.call("editor_apply_beat_montage", request)).ok).toBe(true);
    expect((await s.call("editor_apply_beat_montage", { ...request, operationId: "stale" })).ok).toBe(false);
    expect((await s.call("editor_apply_beat_montage", { ...request, planId: "other" })).ok).toBe(false);
    expect(s.state().past).toHaveLength(1);
  });

  it("propagates cancellation without storing or applying a plan", async () => {
    const s = setup();
    s.analyzeMusic.mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));
    await expect(s.call("editor_plan_beat_montage", s.input)).rejects.toThrow("Aborted");
    expect(s.state().past).toHaveLength(0);
  });
});
