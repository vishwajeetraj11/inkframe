import { describe, expect, it } from "vitest";
import { sanitizeVersion, buildRenderTrack, getTimelineDurationInFrames } from "@/lib/editor/timeline";
import type { VersionTimeline } from "@/lib/editor/types";

const version: VersionTimeline = {
  aspect: "reel_9_16",
  clips: [
    {
      id: "clip-1",
      assetId: "asset-1",
      kind: "video",
      startFrame: 120,
      endFrame: 180,
      trimStartFrame: 0,
      trimEndFrame: 60,
      volume: 1,
    },
    {
      id: "clip-2",
      assetId: "asset-2",
      kind: "video",
      startFrame: 500,
      endFrame: 620,
      trimStartFrame: 0,
      trimEndFrame: 120,
      volume: 1,
    },
  ],
  textOverlays: [
    {
      id: "overlay-1",
      text: "Headline",
      startFrame: 10,
      endFrame: 20,
      x: 50,
      y: 50,
      fontSize: 80,
      color: "#ffffff",
      fontFamily: "sans",
      fontWeight: 700,
      fontStyle: "normal",
      stylePreset: "news-clipping",
      createdaleyTexture: "plain",
    },
  ],
  audioTracks: [],
  transitions: [
    {
      id: "transition-1",
      type: "crossfade",
      fromClipId: "clip-1",
      toClipId: "clip-2",
      durationInFrames: 15,
    },
    {
      id: "transition-dup",
      type: "crossfade",
      fromClipId: "clip-1",
      toClipId: "clip-2",
      durationInFrames: 200,
    },
  ],
};

describe("editor timeline domain", () => {
  it("sanitizes clip ordering and overlay minimum durations", () => {
    const sanitized = sanitizeVersion(version);

    expect(sanitized).not.toBeNull();
    expect(sanitized?.clips[0]).toMatchObject({ startFrame: 0, endFrame: 60 });
    expect(sanitized?.clips[1]).toMatchObject({ startFrame: 60, endFrame: 180 });
    expect((sanitized?.textOverlays[0].endFrame ?? 0) - (sanitized?.textOverlays[0].startFrame ?? 0)).toBeGreaterThanOrEqual(240);
  });

  it("deduplicates and clamps transitions in the render track", () => {
    const sanitized = sanitizeVersion(version);
    if (!sanitized) {
      throw new Error("Expected sanitized version");
    }

    const track = buildRenderTrack(sanitized);
    expect(track.entries).toHaveLength(2);
    expect(sanitized.transitions).toHaveLength(1);
    expect(track.entries[1]?.startFrame).toBe(45);
    expect(getTimelineDurationInFrames(sanitized)).toBe(165);
  });

  it("preserves newer overlay presets during normalization", () => {
    const sanitized = sanitizeVersion({
      ...version,
      textOverlays: [
        {
          ...version.textOverlays[0],
          stylePreset: "vox-typography",
          fontStyle: "italic",
        },
      ],
      transitions: [],
    });

    expect(sanitized).not.toBeNull();
    expect(sanitized?.textOverlays[0]?.stylePreset).toBe("vox-typography");
  });
});
