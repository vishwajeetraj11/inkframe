import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createDefaultTextOverlay } from "@/lib/editor/defaults";
import { getBaseTypographyAnimation } from "@/remotion/editor-presets/shared";
import {
  parseHarrisLocationText,
  renderHarrisLocationPreset,
} from "@/remotion/editor-presets/harris-location";
import {
  parseHarrisMarkerText,
  renderHarrisMarkerPreset,
} from "@/remotion/editor-presets/harris-marker";
import {
  parseVoxPullQuoteText,
  renderVoxPullQuotePreset,
} from "@/remotion/editor-presets/vox-pull-quote";
import type { PresetRendererProps } from "@/remotion/editor-presets/types";

const buildProps = (
  text: string,
  frame: number,
  safeDuration = 150,
): PresetRendererProps => ({
  overlay: { ...createDefaultTextOverlay("overlay-1"), text },
  durationInFrames: safeDuration,
  aspect: "widescreen_16_9",
  hasMediaClips: false,
  frame,
  safeDuration,
  animation: getBaseTypographyAnimation(frame, safeDuration),
});

describe("vox pull quote preset", () => {
  it("parses kicker, quote, and attribution", () => {
    const parsed = parseVoxPullQuoteText(
      "THE ARGUMENT\nWe redrew [[who gets to belong]].\n— Dr. Lena Hartmann",
    );

    expect(parsed.kicker).toBe("THE ARGUMENT");
    expect(parsed.quote).toBe("We redrew [[who gets to belong]].");
    expect(parsed.attribution).toBe("Dr. Lena Hartmann");
  });

  it("renders without NaN styles across the animation", () => {
    for (const frame of [0, 15, 60, 149]) {
      const markup = renderToStaticMarkup(
        renderVoxPullQuotePreset(
          buildProps(
            "THE ARGUMENT\nWe redrew [[who gets to belong]].\n— Dr. Lena Hartmann",
            frame,
          ),
        ),
      );
      expect(markup).toContain("redrew");
      expect(markup).not.toContain("NaN");
    }
  });
});

describe("harris marker preset", () => {
  it("parses kicker, lines, and circled words", () => {
    const parsed = parseHarrisMarkerText(
      "WHY MAPS LIE\nEVERY MAP\nIS [[WRONG]]",
    );

    expect(parsed.kicker).toBe("WHY MAPS LIE");
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.hasCircledWord).toBe(true);
    expect(parsed.lines[1].segments.some((segment) => segment.circled)).toBe(true);
  });

  it("renders without NaN styles across the animation", () => {
    for (const frame of [0, 10, 40, 119]) {
      const markup = renderToStaticMarkup(
        renderHarrisMarkerPreset(
          buildProps("WHY MAPS LIE\nEVERY MAP\nIS [[WRONG]]", frame, 120),
        ),
      );
      expect(markup).toContain("EVERY MAP");
      expect(markup).not.toContain("NaN");
    }
  });
});

describe("harris location preset", () => {
  it("parses title, detail, and stamp lines", () => {
    const parsed = parseHarrisLocationText(
      "SVALBARD, NORWAY\n78.2232 N, 15.6267 E\nARCHIVE / 1993",
    );

    expect(parsed.title).toBe("SVALBARD, NORWAY");
    expect(parsed.detail).toBe("78.2232 N, 15.6267 E");
    expect(parsed.stamp).toBe("ARCHIVE / 1993");
  });

  it("types the title progressively and renders without NaN styles", () => {
    const earlyMarkup = renderToStaticMarkup(
      renderHarrisLocationPreset(
        buildProps("SVALBARD, NORWAY\n78.2232 N, 15.6267 E", 10, 90),
      ),
    );
    const lateMarkup = renderToStaticMarkup(
      renderHarrisLocationPreset(
        buildProps("SVALBARD, NORWAY\n78.2232 N, 15.6267 E", 80, 90),
      ),
    );

    expect(earlyMarkup).not.toContain("SVALBARD, NORWAY");
    expect(lateMarkup).toContain("SVALBARD, NORWAY");
    for (const markup of [earlyMarkup, lateMarkup]) {
      expect(markup).not.toContain("NaN");
    }
  });
});
