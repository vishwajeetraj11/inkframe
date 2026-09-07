import { describe, it, expect } from "vitest";
import { createInitialEditorHistory, editorHistoryReducer } from "@/lib/editor/history";
import { createDefaultClip } from "@/lib/editor/defaults";
import { createEditorWebMcpTools } from "@/lib/editor/webmcp/tools";

const aspect = "widescreen_16_9" as const;
function fixture(lost = false) {
  let state = createInitialEditorHistory();
  state.present.versions[aspect].clips = [
    { ...createDefaultClip("source", "v", "video"), startFrame: 0, endFrame: 30, trimEndFrame: 30 },
    { ...createDefaultClip("graphic", "g", "image"), startFrame: 0, endFrame: 30, trimEndFrame: 30, trackId: "graphics" },
  ];
  state.present.versions[aspect].tracks = [{ id: "inkframe-video", kind: "video", name: "Video", order: 0 }, { id: "graphics", kind: "video", name: "Graphics", order: 1 }];
  const tools = createEditorWebMcpTools({ getState: () => state, dispatchCommand: (action) => { state = editorHistoryReducer(state, action); }, trackObject: async () => ({ status: lost ? "lost" : "complete", sourceWidth: 1920, sourceHeight: 1080, points: [{ frame: 0, x: .3, y: .4, confidence: 1 }, { frame: 29, x: .5, y: .4, confidence: .9 }] }) });
  return { state: () => state, run: async (name: string, input: unknown) => JSON.parse(await tools.find((tool) => tool.name === name)!.execute(input)), bump: () => { state = { ...state, revision: (state.revision ?? 0) + 1 }; } };
}
describe("tracking and selective grading tools", () => {
  it("tracks without mutation, corrects, applies to graphics and retries exactly once", async () => {
    const f = fixture(); const revision = f.state().revision ?? 0;
    const track = await f.run("editor_track_object", { aspect, clipId: "source", box: { x: .2, y: .2, width: .2, height: .2 } });
    expect(f.state().revision ?? 0).toBe(revision);
    await f.run("editor_correct_object_track", { trackingId: track.trackingId, frame: 29, x: .6, y: .4 });
    const args = { aspect, expectedRevision: revision, operationId: "attach", confirmed: true, trackingId: track.trackingId, targetClipId: "graphic" };
    expect(await f.run("editor_attach_object_track", args)).toMatchObject({ ok: true });
    const after = f.state().present;
    expect(await f.run("editor_attach_object_track", args)).toMatchObject({ ok: true });
    expect(f.state().present).toBe(after);
    expect(after.versions[aspect].clips[1].keyframes?.x?.at(-1)?.value).toBeCloseTo(.6);
  });
  it("blocks lost and stale results", async () => {
    const f = fixture(true);
    const track = await f.run("editor_track_object", { aspect, clipId: "source", box: { x: .2, y: .2, width: .2, height: .2 } });
    expect(await f.run("editor_attach_object_track", { aspect, expectedRevision: f.state().revision ?? 0, operationId: "lost", confirmed: true, trackingId: track.trackingId, targetClipId: "graphic" })).toMatchObject({ ok: false });
    f.bump();
    await expect(f.run("editor_correct_object_track", { trackingId: track.trackingId, frame: 0, x: .2, y: .2 })).rejects.toThrow("STALE_TRACK");
  });
  it("persists selective regions and rejects malformed masks", async () => {
    const f = fixture();
    const region = { id: "sky", shape: "ellipse", x: .5, y: .2, width: .8, height: .4, feather: .3, exposure: -.5, temperature: 0, tint: 0, saturation: 1 };
    const args = { aspect, expectedRevision: f.state().revision ?? 0, operationId: "region", confirmed: true, clipId: "source", regions: [region] };
    expect(await f.run("editor_set_selective_grade", args)).toMatchObject({ ok: true });
    expect(f.state().present.versions[aspect].clips[0].videoFilter?.selectiveRegions).toEqual([region]);
    await expect(f.run("editor_set_selective_grade", { ...args, regions: [{ ...region, feather: 2 }] })).rejects.toThrow();
  });
});
