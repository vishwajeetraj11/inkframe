import { describe, expect, it } from "vitest";
import { cloneVideoFilterPreset, videoFilterToCss } from "@/lib/editor/video-filters";

describe("video filters", () => {
  it("creates independent presets and a deterministic Canvas filter chain", () => {
    const first = cloneVideoFilterPreset("cinematic");
    const second = cloneVideoFilterPreset("cinematic");
    first.contrast = 1;
    expect(second.contrast).toBe(1.18);
    expect(videoFilterToCss(second)).toBe(
      "brightness(0.94) contrast(1.18) saturate(0.88) sepia(0.06) grayscale(0) hue-rotate(-3deg)",
    );
    expect(videoFilterToCss(cloneVideoFilterPreset("none"))).toBe("none");
  });
});
