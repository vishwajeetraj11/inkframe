import { describe, expect, it } from "vitest";
import {
  fromElahProject,
  toElahProject,
} from "@/lib/editor/elah-adapter";
import type { AssetRef, VersionTimeline } from "@/lib/editor/types";

const version: VersionTimeline = {
  aspect: "widescreen_16_9",
  clips: [
    {
      id: "clip-video",
      assetId: "asset-video",
      kind: "video",
      startFrame: 0,
      endFrame: 90,
      trimStartFrame: 12,
      trimEndFrame: 102,
      volume: 0.8,
    },
    {
      id: "clip-image",
      assetId: "asset-image",
      kind: "image",
      startFrame: 90,
      endFrame: 150,
      trimStartFrame: 0,
      trimEndFrame: 60,
      volume: 1,
    },
  ],
  textOverlays: [
    {
      id: "text-classic",
      text: "A clear headline",
      startFrame: 5,
      endFrame: 65,
      x: 50,
      y: 25,
      fontSize: 64,
      color: "#f8fafc",
      fontFamily: "sans",
      fontWeight: 650,
      fontStyle: "italic",
      stylePreset: "classic",
      createdaleyTexture: "plain",
      syncMediaToTimelineEvents: false,
    },
    {
      id: "text-preset",
      text: "42% growth",
      startFrame: 70,
      endFrame: 140,
      x: 25,
      y: 50,
      fontSize: 72,
      color: "#fb7185",
      fontFamily: "serif",
      fontWeight: 800,
      fontStyle: "normal",
      stylePreset: "editorial-stat-ring",
      createdaleyTexture: "newsprint-grain",
      syncMediaToTimelineEvents: true,
    },
  ],
  audioTracks: [
    {
      id: "audio-main",
      assetId: "asset-audio",
      startFrame: 0,
      endFrame: 150,
      trimStartFrame: 30,
      trimEndFrame: 180,
      volume: 0.55,
    },
  ],
  transitions: [
    {
      id: "transition-fade",
      type: "crossfade",
      fromClipId: "clip-video",
      toClipId: "clip-image",
      durationInFrames: 15,
    },
  ],
};

const assets: AssetRef[] = [
  {
    assetId: "asset-video",
    kind: "video",
    mimeType: "video/mp4",
    name: "Interview.mp4",
    size: 10,
    externalUrl: "https://cdn.example.com/interview.mp4",
  },
  {
    assetId: "asset-image",
    kind: "image",
    mimeType: "image/jpeg",
    name: "Cover.jpg",
    size: 10,
    externalUrl: "https://cdn.example.com/cover.jpg",
  },
  {
    assetId: "asset-audio",
    kind: "audio",
    mimeType: "audio/mpeg",
    name: "Voiceover.mp3",
    size: 10,
    externalUrl: "https://cdn.example.com/voiceover.mp3",
  },
];

describe("Inkframe ↔ Elah timeline adapter", () => {
  it("projects supported media, text, audio, and crossfades into Elah", () => {
    const projected = toElahProject(version, { assets });
    const nativeClips = Object.values(projected.project.clips).flat();

    expect(projected.project).toMatchObject({
      fps: 30,
      stage: { width: 1920, height: 1080 },
      version: 1,
    });
    expect(nativeClips.map((clip) => clip.type)).toEqual([
      "video",
      "image",
      "text",
      "text",
      "audio",
    ]);
    expect(projected.project.transitions).toEqual([
      expect.objectContaining({
        id: "transition-fade",
        kind: "fade",
        durationFrames: 15,
      }),
    ]);
    expect(projected.sidecar.canonicalVersion).toEqual(version);
    expect(projected.diagnostics).toEqual([
      expect.objectContaining({
        code: "preset-projected-as-text",
        entityId: "text-preset",
      }),
    ]);
  });

  it("round-trips without losing Inkframe-only preset metadata", () => {
    const projected = toElahProject(version, { assets });
    const restored = fromElahProject(projected.project, projected.sidecar);

    expect(restored.version).toEqual(version);
    expect(restored.diagnostics).toEqual([]);
  });

  it("accepts Elah text edits while retaining the canonical preset", () => {
    const projected = toElahProject(version, { assets });
    const textClip = Object.values(projected.project.clips)
      .flat()
      .find((clip) => clip.id === "text-preset");
    if (!textClip) throw new Error("Expected projected preset text");

    textClip.content = "48% growth";
    textClip.startFrame = 75;
    textClip.durationFrames = 80;
    if (textClip.transform) textClip.transform.x = 0.4;

    const restored = fromElahProject(projected.project, projected.sidecar);
    const overlay = restored.version.textOverlays.find(
      (item) => item.id === "text-preset",
    );

    expect(overlay).toMatchObject({
      text: "48% growth",
      startFrame: 75,
      endFrame: 155,
      x: 40,
      stylePreset: "editorial-stat-ring",
      createdaleyTexture: "newsprint-grain",
      syncMediaToTimelineEvents: true,
    });
  });

  it("translates Elah visual drag order into Inkframe render order", () => {
    const projected = toElahProject(version, { assets });
    const videoTrack = projected.project.clips["inkframe-video"];
    const videoClip = videoTrack.find((clip) => clip.id === "clip-video");
    const imageClip = videoTrack.find((clip) => clip.id === "clip-image");
    if (!videoClip || !imageClip) throw new Error("Expected projected visual clips");

    videoClip.startFrame = 150;
    imageClip.startFrame = 90;

    const restored = fromElahProject(projected.project, projected.sidecar);

    expect(restored.version.clips.map((clip) => clip.id)).toEqual([
      "clip-image",
      "clip-video",
    ]);
  });

  it("keeps media without a browser source solely in canonical sidecar state", () => {
    const projected = toElahProject(version, {
      assets: assets.filter((asset) => asset.assetId !== "asset-image"),
    });
    const restored = fromElahProject(projected.project, projected.sidecar);

    expect(projected.sidecar.mapped.clipIds).toEqual(["clip-video"]);
    expect(projected.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing-asset-source",
        entityId: "clip-image",
      }),
    );
    expect(restored.version.clips).toEqual(version.clips);
    expect(restored.version.transitions).toEqual(version.transitions);
  });
});
