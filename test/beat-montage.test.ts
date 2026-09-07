import { describe, expect, it } from "vitest";
import { planBeatMontage, type BeatMontageInput } from "@/lib/editor/beat-montage";

const input = (overrides: Partial<BeatMontageInput> = {}): BeatMontageInput => ({
  videos: [{ assetId: "a", durationSeconds: 10 }, { assetId: "b", durationSeconds: 10 }],
  durationSeconds: 8, beatTimesSeconds: [2, 4, 6], minShotSeconds: 2, maxShotSeconds: 3,
  ...overrides,
});

describe("planBeatMontage", () => {
  it("uses ordered sources, cycles, and aligns cuts to beats", () => {
    const result = planBeatMontage(input());
    expect(result.shots.map((shot) => shot.assetId)).toEqual(["a", "b", "a", "b"]);
    expect(result.shots.map((shot) => shot.endFrame)).toEqual([60, 120, 180, 240]);
    expect(result.durationFrames).toBe(240);
    expect(result.warnings).toContain("Source videos repeat to fill the requested duration.");
  });

  it("looks ahead to avoid an impossible remainder despite an available beat", () => {
    const result = planBeatMontage(input({ durationSeconds: 6, minShotSeconds: 2, maxShotSeconds: 3, beatTimesSeconds: [2.5],
      videos: [{ assetId: "a", durationSeconds: 3 }, { assetId: "b", durationSeconds: 2 }] }));
    expect(result.shots.map((shot) => shot.endFrame)).toEqual([60, 120, 180]);
    expect(result.shots.every((shot) => shot.endFrame - shot.startFrame >= 60)).toBe(true);
  });

  it("clamps preferred moments and respects source availability", () => {
    const result = planBeatMontage(input({ videos: [{ assetId: "a", durationSeconds: 2.5, preferredStartSeconds: 2 }], durationSeconds: 5 }));
    expect(result.shots).toHaveLength(2);
    for (const shot of result.shots) {
      expect(shot.trimStartFrame).toBe(0);
      expect(shot.trimEndFrame).toBe(75);
    }
    expect(result.warnings.some((warning) => warning.includes("moved earlier"))).toBe(true);
  });

  it("handles unsorted duplicate and out-of-montage beats deterministically without mutation", () => {
    const data = input({ beatTimesSeconds: [6, 4, 2, 2, 100, 0] });
    const before = structuredClone(data);
    expect(planBeatMontage(data)).toEqual(planBeatMontage(input()));
    expect(data).toEqual(before);
  });

  it("rounds requested time to frames and reports non-beat cuts", () => {
    const result = planBeatMontage(input({ durationSeconds: 5.01, beatTimesSeconds: [] }));
    expect(result.durationFrames).toBe(150);
    expect(result.warnings.some((warning) => warning.includes("rounded"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("could not align"))).toBe(true);
  });

  it("rejects an impossible exact duration or unusable next source", () => {
    expect(() => planBeatMontage(input({ durationSeconds: 5, minShotSeconds: 3, maxShotSeconds: 3 }))).toThrow(/Cannot fill/);
    expect(() => planBeatMontage(input({ videos: [{ assetId: "a", durationSeconds: 3 }, { assetId: "b", durationSeconds: 1 }] }))).toThrow(/Lower the minimum/);
  });

  it.each([
    { durationSeconds: NaN }, { durationSeconds: Infinity }, { durationSeconds: 61 }, { durationSeconds: 0 },
    { videos: [] }, { videos: [{ assetId: "", durationSeconds: 5 }] },
    { videos: [{ assetId: "a", durationSeconds: 0.001 }] },
    { videos: [{ assetId: "a", durationSeconds: 5, preferredStartSeconds: -1 }] },
    { videos: Array.from({ length: 101 }, () => ({ assetId: "a", durationSeconds: 5 })) },
    { minShotSeconds: 4, maxShotSeconds: 2 }, { maxShotSeconds: Infinity },
    { beatTimesSeconds: [-1] }, { beatTimesSeconds: [NaN] }, { beatTimesSeconds: Array(10001).fill(1) },
  ])("rejects invalid or oversized input %j", (overrides) => {
    expect(() => planBeatMontage(input(overrides))).toThrow();
  });

  it("maintains contiguous coverage and source bounds across varied durations", () => {
    for (let frames = 1; frames <= 1800; frames += 31) {
      const data = input({ durationSeconds: frames / 30, minShotSeconds: 1 / 30, maxShotSeconds: 0.3,
        videos: [{ assetId: "a", durationSeconds: 0.2, preferredStartSeconds: 0.1 }, { assetId: "b", durationSeconds: 0.3 }] });
      const result = planBeatMontage(data);
      let cursor = 0;
      result.shots.forEach((shot, index) => {
        expect(shot.startFrame).toBe(cursor);
        expect(shot.endFrame).toBeGreaterThan(cursor);
        expect(shot.endFrame - cursor).toBeLessThanOrEqual(9);
        expect(shot.trimStartFrame).toBeGreaterThanOrEqual(0);
        expect(shot.trimEndFrame).toBeLessThanOrEqual(Math.floor(data.videos[index % 2].durationSeconds * 30));
        expect(shot.trimEndFrame - shot.trimStartFrame).toBe(shot.endFrame - cursor);
        cursor = shot.endFrame;
      });
      expect(cursor).toBe(frames);
    }
  });
});
