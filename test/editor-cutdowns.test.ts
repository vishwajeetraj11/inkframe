import { describe, expect, it } from "vitest";
import { createCutdown, getActiveTimeline } from "@/lib/editor/cutdowns";
import { createEmptyVersionTimeline, createInitialProjectSession } from "@/lib/editor/defaults";
import { editorReducer } from "@/lib/editor/reducer";
import { persistedProjectSchema } from "@/lib/editor/schema";

const source = () => ({
  ...createEmptyVersionTimeline("widescreen_16_9"),
  clips: [{
    id: "clip", assetId: "asset", kind: "video" as const,
    startFrame: 0, endFrame: 900, trimStartFrame: 30, trimEndFrame: 930, volume: 1,
    transform: { x: 0.1, y: -0.2, scale: 1.8, rotation: 0, anchor: { x: 0.7, y: 0.3 } },
    keyframes: { x: [{ id: "start", frame: 0, value: 0, interpolation: "linear" as const }, { id: "late", frame: 800, value: 1, interpolation: "linear" as const }] },
  }],
  textOverlays: [{ id: "title", text: "Title", startFrame: 300, endFrame: 700, x: 50, y: 50, fontSize: 64, color: "#fff", fontFamily: "sans" as const, fontWeight: 700, fontStyle: "normal" as const, stylePreset: "classic" as const, createdaleyTexture: "plain" as const }],
});

describe("project cutdowns", () => {
  it("creates an independent bounded timeline while preserving reframing", () => {
    const cutdown = createCutdown(source(), { id: "short", name: "15s cut", durationFrames: 450 });
    expect(cutdown?.timeline.clips[0]).toMatchObject({ endFrame: 450, trimStartFrame: 30, trimEndFrame: 480, transform: { scale: 1.8 } });
    expect(cutdown?.timeline.clips[0].keyframes?.x?.map((point) => point.frame)).toEqual([0, 450]);
    expect(cutdown?.timeline.textOverlays[0]).toMatchObject({ startFrame: 300, endFrame: 450 });
    expect(source().clips[0].endFrame).toBe(900);
  });

  it("retains and switches between the master and derived version", () => {
    const initial = createInitialProjectSession();
    initial.versions.widescreen_16_9 = source();
    const created = editorReducer(initial, { type: "create-cutdown", id: "short", name: "15s cut", durationFrames: 450, sourceAspect: "widescreen_16_9" });
    expect(created.versions.widescreen_16_9.clips[0].endFrame).toBe(900);
    expect(getActiveTimeline(created).clips[0].endFrame).toBe(450);
    const edited = editorReducer(created, { type: "update-clip", aspect: "widescreen_16_9", clipId: "clip", patch: { opacity: 0.5 } });
    expect(edited.cutdowns?.[0].timeline.clips[0].opacity).toBe(0.5);
    expect(edited.versions.widescreen_16_9.clips[0].opacity).toBeUndefined();
    expect(editorReducer(edited, { type: "switch-aspect", aspect: "widescreen_16_9" }).activeCutdownId).toBeUndefined();
  });

  it("persists cutdowns while accepting legacy projects without them", () => {
    const initial = createInitialProjectSession();
    expect(persistedProjectSchema.safeParse(initial).success).toBe(true);
    initial.versions.widescreen_16_9 = source();
    const created = editorReducer(initial, { type: "create-cutdown", id: "short", name: "15s cut", durationFrames: 450, sourceAspect: "widescreen_16_9" });
    expect(persistedProjectSchema.safeParse(created).success).toBe(true);
  });
});
