import { describe, expect, it } from "vitest";
import { createCutdown } from "@/lib/editor/cutdowns";
import { buildReframeTransform } from "@/lib/editor/reframe";
import { createDefaultClip, createEmptyVersionTimeline } from "@/lib/editor/defaults";

describe("social format reframing", () => {
  it("cover fits a landscape source into a vertical target and clamps focus", () => {
    expect(buildReframeTransform({
      sourceWidth: 1920,
      sourceHeight: 1080,
      targetWidth: 1080,
      targetHeight: 1920,
      focus: { x: 1.4, y: -0.2 },
    })).toMatchObject({
      x: 0.5,
      y: 0.5,
      scale: expect.closeTo(1920 / 1080, 8),
      anchor: { x: 1, y: 0 },
    });
  });

  it("rejects invalid source or target dimensions", () => {
    expect(buildReframeTransform({ sourceWidth: 0, sourceHeight: 1080, targetWidth: 1080, targetHeight: 1920 })).toBeUndefined();
  });
});

describe("project cutdowns", () => {
  it("keeps the master independent and trims timed items at the cut point", () => {
    const source = createEmptyVersionTimeline("widescreen_16_9");
    source.clips = [{ ...createDefaultClip("clip", "asset", "video"), endFrame: 90, trimEndFrame: 90 }];
    source.textOverlays = [{ ...source.textOverlays[0] ?? {
      id: "title", text: "Title", startFrame: 0, endFrame: 90, x: 50, y: 50,
      fontSize: 48, color: "#fff", fontFamily: "sans", fontWeight: 700,
      fontStyle: "normal", stylePreset: "classic", createdaleyTexture: "plain",
    }}];
    const cutdown = createCutdown(source, { id: "short", name: "Short", durationFrames: 45 });
    expect(cutdown?.timeline.clips[0]).toMatchObject({ startFrame: 0, endFrame: 45, trimEndFrame: 45 });
    expect(cutdown?.timeline.textOverlays[0].endFrame).toBe(45);
    expect(source.clips[0].endFrame).toBe(90);
    expect(cutdown?.sourceAspect).toBe("widescreen_16_9");
  });
});
