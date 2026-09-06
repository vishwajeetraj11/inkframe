import { describe, expect, it } from "vitest";
import { fromElahProject, toElahProject } from "@/lib/editor/elah-adapter";
import type { VersionTimeline } from "@/lib/editor/types";

describe("legacy native timing compatibility", () => {
  it("keeps the cut and source ranges when projecting an odd-duration transition", () => {
    const version: VersionTimeline = {
      aspect: "widescreen_16_9",
      clips: [
        { id: "first", assetId: "image", kind: "image", startFrame: 0,
          endFrame: 90, trimStartFrame: 12, trimEndFrame: 102, volume: 1 },
        { id: "second", assetId: "image", kind: "image", startFrame: 90,
          endFrame: 150, trimStartFrame: 0, trimEndFrame: 60, volume: 1 },
      ],
      textOverlays: [],
      audioTracks: [],
      transitions: [{ id: "fade", type: "crossfade", fromClipId: "first",
        toClipId: "second", durationInFrames: 15 }],
    };
    const { project, sidecar } = toElahProject(version, {
      assetSources: { image: "https://example.test/image.png" },
    });
    const clips = Object.values(project.clips).flat();
    expect(clips.find((clip) => clip.id === "first")).toMatchObject({
      startFrame: 0, durationFrames: 90, sourceStartFrame: 12,
    });
    expect(clips.find((clip) => clip.id === "second")).toMatchObject({
      startFrame: 90, durationFrames: 60,
    });
    expect(project.transitions[0]).toMatchObject({ startFrame: 83, durationFrames: 15 });
    expect(Math.max(...clips.map((clip) => clip.startFrame + clip.durationFrames))).toBe(150);
    const restored = fromElahProject(project, sidecar).version;
    expect(restored.clips).toEqual(version.clips);
    expect(restored.transitions).toEqual(version.transitions);
  });
});
