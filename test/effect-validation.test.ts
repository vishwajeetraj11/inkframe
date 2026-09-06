import {describe, expect, it} from "vitest";
import {validateVersionPlacement, getTimelineDurationInFrames, getVersionRenderDurationInFrames} from "@/lib/editor/timeline";
import type {VersionTimeline} from "@/lib/editor/types";
const version = (): VersionTimeline => ({aspect: "reel_9_16", tracks: [{id: "captions", name: "Captions", kind: "caption", order: 3}], clips: [{id: "video", assetId: "asset", kind: "video", startFrame: 0, endFrame: 60, trimStartFrame: 0, trimEndFrame: 60, volume: 1}], audioTracks: [], textOverlays: [], transitions: []});

describe("canonical effect validation", () => {
  it("includes caption tails and validates caption lane and IDs", () => {
    const valid = {...version(), captionCues: [{id: "cue", trackId: "captions", startFrame: 60, endFrame: 300, text: "Caption"}]};
    expect(validateVersionPlacement(valid)).toEqual([]);
    expect(getTimelineDurationInFrames(valid)).toBe(300);
    expect(getVersionRenderDurationInFrames(valid)).toBe(300);
    expect(validateVersionPlacement({...valid, captionCues: [{...valid.captionCues[0], id: "video", trackId: "inkframe-video"}]}).map(issue => issue.code)).toEqual(expect.arrayContaining(["DUPLICATE_ID", "INVALID_TRACK"]));
  });
  it("enforces time-map source metadata and normal trim bounds", () => {
    const v = version();
    expect(validateVersionPlacement({...v, clips: [{...v.clips[0], timeMapping: {kind: "speed", points: [{frame: 0, speed: 2, interpolation: "linear"}]}}]}).some(issue => issue.code === "SOURCE_OUT_OF_RANGE")).toBe(true);
    expect(validateVersionPlacement({...v, clips: [{...v.clips[0], sourceDurationUs: 4e6, timeMapping: {kind: "speed", points: [{frame: 0, speed: 2, interpolation: "linear"}]}}]})).toEqual([]);
    expect(validateVersionPlacement({...v, clips: [{...v.clips[0], endFrame: 61, sourceDurationUs: 4e6}]}).some(issue => issue.code === "SOURCE_OUT_OF_RANGE")).toBe(true);
  });
  it("rejects invalid keyframes, image retiming and retimed transitions", () => {
    const v = version();
    expect(validateVersionPlacement({...v, clips: [{...v.clips[0], keyframes: {opacity: [{id: "key", frame: 61, value: 1, interpolation: "linear"}]}}]}).some(issue => issue.code === "INVALID_KEYFRAMES")).toBe(true);
    expect(validateVersionPlacement({...v, clips: [{...v.clips[0], kind: "image", timeMapping: {kind: "hold", sourceTimeUs: 0}}]}).some(issue => issue.code === "SOURCE_OUT_OF_RANGE")).toBe(true);
    expect(validateVersionPlacement({...v, clips: [{...v.clips[0], timeMapping: {kind: "hold", sourceTimeUs: 0}}, {...v.clips[0], id: "next", startFrame: 60, endFrame: 120}], transitions: [{id: "fade", fromClipId: "video", toClipId: "next", durationInFrames: 10}]}).some(issue => issue.code === "UNSUPPORTED_TRANSITION")).toBe(true);
  });
  it("validates ducking references and reserved track kinds", () => {
    const v = version();
    expect(validateVersionPlacement({...v, duckingRules: [{id: "duck", target: {kind: "video", id: "video"}, triggers: [{kind: "audio", id: "missing"}], attenuationDb: -12, attackFrames: 3, releaseFrames: 3}]}).some(issue => issue.code === "INVALID_DUCKING")).toBe(true);
    expect(validateVersionPlacement({...v, tracks: [{id: "inkframe-video", kind: "audio", order: 0, name: "Wrong"}]}).some(issue => issue.code === "INVALID_TRACK")).toBe(true);
    expect(validateVersionPlacement({...v, clips: [{...v.clips[0], transform: undefined}]})).toEqual([]);
  });
});
