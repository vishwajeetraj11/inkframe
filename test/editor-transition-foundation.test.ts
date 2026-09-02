import { describe, expect, it } from "vitest";
import { createInitialProjectSession } from "@/lib/editor/defaults";
import { fromElahProject, toElahProject } from "@/lib/editor/elah-adapter";
import { editorReducer } from "@/lib/editor/reducer";
import { sanitizeVersion } from "@/lib/editor/timeline";
import type { AssetRef, VersionTimeline } from "@/lib/editor/types";

const assets: AssetRef[] = [
  { assetId: "a", kind: "video", mimeType: "video/mp4", name: "a", size: 1, externalUrl: "https://example.com/a.mp4" },
  { assetId: "b", kind: "video", mimeType: "video/mp4", name: "b", size: 1, externalUrl: "https://example.com/b.mp4" },
  { assetId: "music", kind: "audio", mimeType: "audio/mpeg", name: "music", size: 1, externalUrl: "https://example.com/music.mp3" },
];

const version: VersionTimeline = {
  aspect: "reel_9_16",
  clips: [
    { id: "clip-a", assetId: "a", kind: "video", startFrame: 0, endFrame: 60, trimStartFrame: 10, trimEndFrame: 70, volume: 1 },
    { id: "clip-b", assetId: "b", kind: "video", startFrame: 60, endFrame: 120, trimStartFrame: 0, trimEndFrame: 60, volume: 1 },
  ],
  textOverlays: [{
    id: "title", text: "Hello", startFrame: 0, endFrame: 60, x: 50, y: 50,
    fontSize: 56, color: "#fff", fontFamily: "sans", fontWeight: 700,
    fontStyle: "normal", stylePreset: "classic", createdaleyTexture: "plain",
    animation: { in: "fade", out: "fade", durationFrames: 12 },
  }],
  audioTracks: [{
    id: "audio", assetId: "music", startFrame: 0, endFrame: 120,
    trimStartFrame: 0, trimEndFrame: 120, volume: 0.5,
    fadeInFrames: 10, fadeOutFrames: 15, muted: true,
  }],
  transitions: [{
    id: "wipe", kind: "wipe", direction: "left", easing: "ease-out",
    fromClipId: "clip-a", toClipId: "clip-b", durationInFrames: 12,
  }],
};

describe("editor transition foundation", () => {
  it("normalizes legacy crossfades and clamps new transition metadata", () => {
    const normalized = sanitizeVersion({
      ...version,
      transitions: [{
        id: "legacy", type: "crossfade", fromClipId: "clip-a", toClipId: "clip-b", durationInFrames: 12,
      }],
    });
    expect(normalized?.transitions[0]).toMatchObject({ kind: "fade", easing: "linear", type: "crossfade" });
  });

  it("round-trips Elah-native transitions, text animation, and browser audio fades", () => {
    const projected = toElahProject(version, { assets });
    expect(projected.project.transitions[0]).toMatchObject({ kind: "wipe", direction: "left", easing: "ease-out" });
    expect(projected.project.clips["inkframe-audio"].find((clip) => clip.id === "audio")).toMatchObject({ fadeInFrames: 10, fadeOutFrames: 15 });
    expect(Object.values(projected.project.clips).flat().find((clip) => clip.id === "title")?.textAnimation).toEqual({ in: "fade", out: "fade", durationFrames: 12 });
    expect(fromElahProject(projected.project, projected.sidecar).version).toEqual(version);
  });

  it("splits and duplicates clips with supplied deterministic ids", () => {
    const state = { ...createInitialProjectSession(), versions: { ...createInitialProjectSession().versions, reel_9_16: version } };
    const split = editorReducer(state, {
      type: "split-clip", aspect: "reel_9_16", clipId: "clip-a", splitFrame: 30,
      leftClipId: "clip-a-left", rightClipId: "clip-a-right",
    });
    expect(split.versions.reel_9_16.clips.map((clip) => clip.id)).toEqual(["clip-a-left", "clip-a-right", "clip-b"]);
    expect(split.versions.reel_9_16.clips[0]).toMatchObject({ trimStartFrame: 10, trimEndFrame: 40, endFrame: 30 });
    expect(split.versions.reel_9_16.transitions[0]).toMatchObject({ fromClipId: "clip-a-right", toClipId: "clip-b" });
    const duplicate = editorReducer(split, { type: "duplicate-clip", aspect: "reel_9_16", clipId: "clip-a-left", newClipId: "clip-copy" });
    expect(duplicate.versions.reel_9_16.clips.map((clip) => clip.id)).toEqual(["clip-a-left", "clip-copy", "clip-a-right", "clip-b"]);
    expect(duplicate.versions.reel_9_16.transitions.every((transition) => transition.fromClipId !== "clip-a-left")).toBe(true);
  });

  it("starts with three lanes and adds another lane without adding media", () => {
    const state = createInitialProjectSession();
    expect(state.versions.reel_9_16.tracks?.map((track) => track.kind)).toEqual([
      "video",
      "text",
      "audio",
    ]);

    const next = editorReducer(state, {
      type: "add-track",
      aspect: "reel_9_16",
      track: { id: "audio-2", kind: "audio", name: "Audio 2", order: 3 },
    });
    expect(next.versions.reel_9_16.tracks).toHaveLength(4);
    expect(next.versions.reel_9_16.audioTracks).toEqual([]);
  });
});
