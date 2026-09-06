import { describe, expect, it } from "vitest";
import { editorReducer } from "@/lib/editor/reducer";
import { getTimelineDurationInFrames, sanitizeVersion } from "@/lib/editor/timeline";
import { createDefaultEditorTracks } from "@/lib/editor/tracks";
import type { Clip, ProjectSession, VersionTimeline } from "@/lib/editor/types";

const clip = (id: string, startFrame: number, endFrame: number, trackId = "inkframe-video"): Clip => ({id, startFrame, endFrame, trackId, assetId: "asset", kind: "video", trimStartFrame: 0, trimEndFrame: endFrame - startFrame, volume: 1});
const version = (): VersionTimeline => ({aspect: "reel_9_16", tracks: [...createDefaultEditorTracks(), {id: "upper", kind: "video", name: "Upper", order: 3}], clips: [clip("a", 0, 30), clip("b", 40, 100), clip("c", 0, 300, "upper")], textOverlays: [], audioTracks: [], transitions: []});
const session = (): ProjectSession => ({activeVersion: "reel_9_16", versions: {reel_9_16: version(), widescreen_16_9: {...version(), aspect: "widescreen_16_9"}}});

describe("explicit lane placement", () => {
  it("preserves gaps, cross-lane overlap and idempotent normalization", () => {
    const normalized = sanitizeVersion(version())!;
    expect(normalized.clips).toEqual(version().clips);
    expect(sanitizeVersion(normalized)).toEqual(normalized);
    expect(getTimelineDurationInFrames(normalized)).toBe(300);
  });
  it("rejects collision, fractional placement and duplicate IDs without changing state identity", () => {
    const state = session();
    expect(editorReducer(state, {type: "place-clip", aspect: "reel_9_16", clipId: "b", trackId: "inkframe-video", startFrame: 20})).toBe(state);
    expect(editorReducer(state, {type: "place-clip", aspect: "reel_9_16", clipId: "b", trackId: "upper", startFrame: 300.5})).toBe(state);
    expect(editorReducer(state, {type: "add-clip", aspect: "reel_9_16", clip: clip("a", 300, 330)})).toBe(state);
  });
  it("moves without changing source ranges and deletes without ripple", () => {
    const moved = editorReducer(session(), {type: "place-clip", aspect: "reel_9_16", clipId: "b", trackId: "upper", startFrame: 300});
    expect(moved.versions.reel_9_16.clips[1]).toMatchObject({startFrame: 300, endFrame: 360, trimStartFrame: 0, trimEndFrame: 60});
    const deleted = editorReducer(session(), {type: "remove-clip", aspect: "reel_9_16", clipId: "a"});
    expect(deleted.versions.reel_9_16.clips[0].startFrame).toBe(40);
  });
  it("rejects invalid transform, volume and oversized transitions atomically", () => {
    const state = session();
    for (const patch of [{volume: NaN}, {volume: 2}, {opacity: -0.1}, {transform: {x: 0.5, y: 0.5, scale: 1, rotation: 0, anchor: {x: 2, y: 0.5}}}]) {
      expect(editorReducer(state, {type: "update-clip", aspect: "reel_9_16", clipId: "a", patch})).toBe(state);
    }
    const touching = {...state, versions: {...state.versions, reel_9_16: {...version(), clips: [clip("a", 0, 30), clip("b", 30, 90)]}}};
    expect(editorReducer(touching, {type: "set-transition", aspect: "reel_9_16", transition: {id: "fade", type: "crossfade", fromClipId: "a", toClipId: "b", durationInFrames: 30}})).toBe(touching);
  });
  it("rejects replacement with invalid edges rather than dropping user transitions", () => {
    const state = session();
    const invalid = {...version(), transitions: [{id: "fade", type: "crossfade" as const, fromClipId: "a", toClipId: "b", durationInFrames: 10}]};
    expect(editorReducer(state, {type: "replace-version", aspect: "reel_9_16", version: invalid})).toBe(state);
  });
  it("reorders a lane preserving its gap and duplicates with lane-only ripple", () => {
    const reordered = editorReducer(session(), {type: "move-clip", aspect: "reel_9_16", clipId: "a", offset: 1}).versions.reel_9_16;
    expect(reordered.clips.find(c => c.id === "b")).toMatchObject({startFrame: 0, endFrame: 60});
    expect(reordered.clips.find(c => c.id === "a")).toMatchObject({startFrame: 70, endFrame: 100});
    const duplicated = editorReducer(session(), {type: "duplicate-clip", aspect: "reel_9_16", clipId: "a", newClipId: "d"}).versions.reel_9_16;
    expect(duplicated.clips.find(c => c.id === "b")?.startFrame).toBe(70);
    expect(duplicated.clips.find(c => c.id === "c")?.startFrame).toBe(0);
  });
  it("appends at its lane end and rejects tails past the limit", () => {
    const next = editorReducer(session(), {type: "append-clip", aspect: "reel_9_16", clip: clip("d", 0, 30)});
    expect(next.versions.reel_9_16.clips.at(-1)?.startFrame).toBe(100);
    const invalid = {...version(), audioTracks: [{id: "audio", assetId: "asset", startFrame: 0, endFrame: 1801, trimStartFrame: 0, trimEndFrame: 1801, volume: 1}]};
    expect(sanitizeVersion(invalid)).toBeNull();
  });
});
