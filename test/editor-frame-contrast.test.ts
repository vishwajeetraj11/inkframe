import { describe, expect, it } from "vitest";
import { createDefaultTextOverlay } from "@/lib/editor/defaults";
import { analyzeFrameContrast } from "@/lib/editor/webmcp/contrast";
import type { VersionTimeline } from "@/lib/editor/types";

const version = (color: string): VersionTimeline => ({
  aspect: "reel_9_16",
  clips: [],
  textOverlays: [{
    ...createDefaultTextOverlay("headline"),
    text: "Contrast",
    color,
    startFrame: 0,
    endFrame: 60,
  }],
  audioTracks: [],
  transitions: [],
});

const pixels = (red: number, green: number, blue: number) => {
  const data = new Uint8ClampedArray(100 * 100 * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = red;
    data[offset + 1] = green;
    data[offset + 2] = blue;
    data[offset + 3] = 255;
  }
  return data;
};

describe("pixel frame contrast", () => {
  it("passes light text on a dark rendered frame", () => {
    const checks = analyzeFrameContrast({
      pixels: pixels(12, 18, 28),
      width: 100,
      height: 100,
      version: version("#ffffff"),
      frame: 10,
    });

    expect(checks[0]).toMatchObject({ overlayId: "headline", passes: true });
    expect(checks[0]?.contrastRatio).toBeGreaterThan(10);
  });

  it("flags unreadable dark text and recommends white", () => {
    const checks = analyzeFrameContrast({
      pixels: pixels(20, 24, 30),
      width: 100,
      height: 100,
      version: version("#111111"),
      frame: 10,
    });

    expect(checks[0]).toMatchObject({ passes: false, recommendedColor: "#ffffff" });
  });
});
