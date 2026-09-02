import { describe, expect, it } from "vitest";
import {
  fromElahProject,
  toElahProject,
} from "@/lib/editor/elah-adapter";
import type { AssetRef, VersionTimeline } from "@/lib/editor/types";
import { createDefaultEditorTracks } from "@/lib/editor/tracks";

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
      fadeInFrames: 12,
      fadeOutFrames: 24,
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
    expect(projected.project.tracks.slice(0, 3)).toMatchObject([
      { id: "inkframe-video", order: 0 },
      { id: "inkframe-elements", order: 1 },
      { id: "inkframe-audio", order: 2 },
    ]);
    expect(projected.project.tracks.filter((track) => track.height > 0)).toHaveLength(3);
    expect(projected.project.tracks.find((track) => track.id === "inkframe-background"))
      .toMatchObject({ height: 0 });
    expect(
      nativeClips
        .filter((clip) => !clip.id.startsWith("inkframe-background"))
        .map((clip) => clip.type),
    ).toEqual([
      "video",
      "image",
      "text",
      "text",
      "audio",
      "audio",
    ]);
    expect(nativeClips.find((clip) => clip.id === "inkframe-background-base")).toMatchObject({
      type: "shape",
      shapeKind: "rect",
      shapeStrokeWidth: 0,
    });
    expect(projected.project.transitions).toEqual([
      expect.objectContaining({
        id: "transition-fade",
        kind: "fade",
        durationFrames: 15,
      }),
    ]);
    expect(nativeClips.find((clip) => clip.id === "audio-main")).toMatchObject({
      fadeInFrames: 12,
      fadeOutFrames: 24,
    });
    expect(projected.sidecar.canonicalVersion).toEqual(version);
    expect(nativeClips.find((clip) => clip.id === "text-preset")).toMatchObject({
      content: "95%\n42% growth",
      fontSize: 72,
    });
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

  it("keeps every caption in the single visible text track", () => {
    const crowdedVersion: VersionTimeline = {
      ...version,
      textOverlays: [
        { ...version.textOverlays[0], id: "make", startFrame: 10, endFrame: 60 },
        { ...version.textOverlays[0], id: "video", startFrame: 50, endFrame: 100 },
        { ...version.textOverlays[0], id: "search", startFrame: 110, endFrame: 140 },
        { ...version.textOverlays[0], id: "find", startFrame: 135, endFrame: 170 },
      ],
    };

    const projected = toElahProject(crowdedVersion, { assets });
    const textTracks = projected.project.tracks.filter((track) => track.kind === "elements");
    const textClipIds = textTracks.flatMap((track) =>
      projected.project.clips[track.id].map((clip) => clip.id),
    );

    expect(textTracks).toHaveLength(1);
    expect(projected.project.clips[textTracks[0].id].map((clip) => clip.id)).toEqual([
      "make",
      "video",
      "search",
      "find",
    ]);
    expect(textClipIds).toEqual(["make", "video", "search", "find"]);
    expect(fromElahProject(projected.project, projected.sidecar).version).toEqual(crowdedVersion);
  });

  it("keeps added video, text, and audio tracks distinct and editable", () => {
    const multiTrackVersion: VersionTimeline = {
      ...version,
      tracks: [
        ...createDefaultEditorTracks(),
        { id: "video-2", kind: "video", name: "Video 2", order: 3 },
        { id: "text-2", kind: "text", name: "Text 2", order: 4 },
        { id: "audio-2", kind: "audio", name: "Audio 2", order: 5 },
      ],
      clips: version.clips.map((clip) => ({ ...clip, trackId: "video-2" })),
      textOverlays: version.textOverlays.map((overlay) => ({
        ...overlay,
        trackId: "text-2",
      })),
      audioTracks: version.audioTracks.map((audio) => ({
        ...audio,
        trackId: "audio-2",
      })),
    };

    const projected = toElahProject(multiTrackVersion, { assets });
    const visibleTracks = projected.project.tracks.filter((track) => track.height > 0);

    expect(visibleTracks.map((track) => track.name)).toEqual([
      "Video",
      "Text",
      "Audio",
      "Video 2",
      "Text 2",
      "Audio 2",
    ]);
    expect(projected.project.clips["video-2"].map((clip) => clip.id)).toEqual([
      "clip-video",
      "clip-image",
    ]);
    expect(projected.project.clips["text-2"].map((clip) => clip.id)).toEqual([
      "text-classic",
      "text-preset",
    ]);
    expect(projected.project.clips["audio-2"].map((clip) => clip.id)).toEqual([
      "audio-main",
    ]);
    expect(fromElahProject(projected.project, projected.sidecar).version).toEqual(
      multiTrackVersion,
    );
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
