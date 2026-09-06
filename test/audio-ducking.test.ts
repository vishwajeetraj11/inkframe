import { describe, expect, it } from "vitest";
import { buildDuckingEnvelope, validateDuckingRules } from "@/lib/editor/audio-ducking";
import { evaluateGainEnvelope } from "@/lib/editor/deterministic-runtime.mjs";
import type { VersionTimeline } from "@/lib/editor/types";
const fixture = (): VersionTimeline => ({ aspect: "widescreen_16_9", clips: [], textOverlays: [], transitions: [], audioTracks: [
  { id: "music", assetId: "music", startFrame: 0, endFrame: 100, trimStartFrame: 0, trimEndFrame: 100, volume: 1 },
  { id: "voice", assetId: "voice", startFrame: 20, endFrame: 40, trimStartFrame: 0, trimEndFrame: 20, volume: 1 },
], duckingRules: [{ id: "duck", target: { kind: "audio", id: "music" }, triggers: [{ kind: "audio", id: "voice" }], attenuationDb: -20, attackFrames: 10, releaseFrames: 10 }] });
const gain = (v: VersionTimeline, frame: number) => evaluateGainEnvelope(buildDuckingEnvelope(v, { kind: "audio", id: "music" }), frame);

describe("deterministic ducking envelopes", () => {
  it("evaluates attack, hold, release, and fractional samples", () => {
    const v = fixture();
    expect(validateDuckingRules(v)).toEqual([]);
    for (const [frame, expected] of [[10, 1], [15, .55], [20, .1], [39.9, .1], [40, .1], [45, .55], [50, 1]]) expect(gain(v, frame)).toBeCloseTo(expected);
  });
  it("preserves instantaneous boundaries for zero attack and release", () => {
    const v = fixture(); v.duckingRules![0].attackFrames = 0; v.duckingRules![0].releaseFrames = 0;
    expect(gain(v, 19.999)).toBe(1);
    expect(gain(v, 20)).toBeCloseTo(.1);
    expect(gain(v, 39.999)).toBeCloseTo(.1);
    expect(gain(v, 40)).toBe(1);
  });
  it("merges touching and overlapping narration intervals without volume blips", () => {
    const v = fixture(); v.audioTracks.push({ ...v.audioTracks[1], id: "voice2", startFrame: 35, endFrame: 60 });
    v.duckingRules![0].triggers.push({ kind: "audio", id: "voice2" });
    for (const frame of [35, 39.5, 40, 55, 60]) expect(gain(v, frame)).toBeCloseTo(.1);
  });
  it("uses the strongest ramp at fractional intersections across rules", () => {
    const v = fixture(); v.audioTracks.push({ ...v.audioTracks[1], id: "voice2", startFrame: 49, endFrame: 70 });
    v.duckingRules!.push({ ...v.duckingRules![0], id: "duck2", attenuationDb: -6, triggers: [{ kind: "audio", id: "voice2" }] });
    for (let frame = 40; frame < 50; frame += .13) {
      const first = .1 + .9 * (frame - 40) / 10;
      const floor = 10 ** (-6 / 20);
      const second = frame >= 49 ? floor : 1 - (1 - floor) * (frame - 39) / 10;
      expect(gain(v, frame)).toBeCloseTo(Math.min(first, second), 9);
    }
  });
  it("excludes muted and retimed narration sources and uses target-local frames", () => {
    const v = fixture(); v.audioTracks[1].muted = true;
    expect(gain(v, 25)).toBe(1);
    v.clips.push({ id: "video", assetId: "video", kind: "video", startFrame: 20, endFrame: 40, trimStartFrame: 0, trimEndFrame: 20, volume: 1, timeMapping: { kind: "hold", sourceTimeUs: 0 } });
    v.duckingRules![0].triggers = [{ kind: "video", id: "video" }];
    expect(gain(v, 25)).toBe(1);
    delete v.clips[0].timeMapping;
    v.audioTracks[0].startFrame = 15;
    expect(gain(v, 0)).toBeCloseTo(.55);
    expect(gain(v, 5)).toBeCloseTo(.1);
  });
});
