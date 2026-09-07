import { describe, expect, it, vi } from "vitest";
import { proposeShotGradesFromSources, previewColorCorrections } from "@/lib/editor/webmcp/color-workflow";
import { sampleTimelineSourceFrames } from "@/lib/editor/webmcp/source-frame-analysis";
import type { VersionTimeline } from "@/lib/editor/types";

vi.mock("@/lib/editor/webmcp/source-frame-analysis", () => ({ sampleTimelineSourceFrames: vi.fn() }));

const warm = { preset: "warm" as const, brightness: 1.02, contrast: 1.05, saturation: 1.08, sepia: 0.16, grayscale: 0, hueRotate: -5 };
const version = (): VersionTimeline => ({ aspect: "widescreen_16_9", clips: [{ id: "sunrise", assetId: "sunrise-source", kind: "video", startFrame: 0, endFrame: 90, trimStartFrame: 0, trimEndFrame: 90, volume: 0, videoFilter: { ...warm } }], textOverlays: [], audioTracks: [], transitions: [] });
const source = (variation = 0.1) => ({
  clips: [{ clipId: "sunrise", assetId: "sunrise-source", status: "analyzed" as const, warnings: [],
    aggregate: { luminance: 0.14, exposure: -0.4, temperature: 0.18, tint: 0, saturation: 0.4, palette: [], skinToneFraction: 0, lightingVariation: variation, confidence: "medium" as const },
    frames: [0.3, 1.5, 2.7].map((sourceTimeSeconds) => ({ sourceTimeSeconds, statistics: { width: 192, height: 108, sampledPixelCount: 1000, luminance: { low: 0.02, median: 0.14, high: 0.85 }, exposure: -0.4, temperature: 0.18, tint: 0, saturation: 0.4, blackFraction: 0.01, whiteFraction: 0, skinToneFraction: 0, palette: [], usable: true } })),
  }], analyzedClipCount: 1, skippedClipCount: 0, unreadableClipCount: 0, cancelled: false, warnings: [],
});

describe("shot-aware grade starting points", () => {
  it("scales filmic strength, preserves zero, and does not compound", async () => {
    vi.mocked(sampleTimelineSourceFrames).mockResolvedValue(source());
    const timeline = version();
    const get = (strength: number) => proposeShotGradesFromSources({ version: timeline, assets: [], creativeIntent: "filmic", strength });
    expect((await get(0)).changes).toEqual([]);
    const soft = (await get(0.5)).changes[0].after.videoFilter;
    const strong = (await get(2)).changes[0].after.videoFilter;
    expect(strong.contrast).toBeGreaterThan(soft.contrast);
    expect(strong.saturation).toBeLessThan(soft.saturation);
    timeline.clips[0].videoFilter = strong;
    expect((await get(2)).changes).toEqual([]);
  });
  it("preserves sunrise warmth and uses separate shadows/highlights, not median WB", async () => {
    vi.mocked(sampleTimelineSourceFrames).mockResolvedValue(source());
    const result = await proposeShotGradesFromSources({ version: version(), assets: [] });
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].after.videoFilter).toMatchObject({ hueRotate: -5, sepia: 0.16, saturation: 1.08, brightness: 1.02, shadows: 0.3, highlights: -0.45 });
    expect(result.requiresVisualReview).toBe(true);
    expect(result.changes[0].after.videoFilter.temperature).toBeUndefined();
  });
  it("does not compound repeated passes", async () => {
    vi.mocked(sampleTimelineSourceFrames).mockResolvedValue(source());
    const timeline = version();
    const first = await proposeShotGradesFromSources({ version: timeline, assets: [] });
    timeline.clips[0].videoFilter = first.changes[0].after.videoFilter;
    expect((await proposeShotGradesFromSources({ version: timeline, assets: [] })).changes).toEqual([]);
  });
  it("treats persisted neutral zeros like omitted controls", async () => {
    vi.mocked(sampleTimelineSourceFrames).mockResolvedValue(source());
    const timeline = version();
    timeline.clips[0].videoFilter = { ...warm, exposure: 0, temperature: 0, tint: 0, shadows: 0, highlights: 0, toneCurve: "linear" };
    const result = await proposeShotGradesFromSources({ version: timeline, assets: [] });
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].after.videoFilter).toMatchObject({ shadows: 0.3, highlights: -0.45 });
  });
  it("leaves changing light untouched instead of applying one blanket fix", async () => {
    vi.mocked(sampleTimelineSourceFrames).mockResolvedValue(source(1.2));
    expect((await proposeShotGradesFromSources({ version: version(), assets: [] })).changes).toEqual([]);
  });
  it("makes creative shaping explicit and samples three separate moments", async () => {
    vi.mocked(sampleTimelineSourceFrames).mockResolvedValue(source());
    const timeline = version();
    const proposal = await proposeShotGradesFromSources({ version: timeline, assets: [], creativeIntent: "filmic" });
    expect(proposal.changes[0].after.videoFilter.toneCurve).toBe("filmic");
    expect(previewColorCorrections(timeline, proposal).representativeFrames).toEqual([
      { clipId: "sunrise", frame: 10 }, { clipId: "sunrise", frame: 44 }, { clipId: "sunrise", frame: 78 },
    ]);
  });
});
