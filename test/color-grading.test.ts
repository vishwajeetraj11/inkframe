import { describe, expect, it } from "vitest";
import { applyColorGradeToPixels, filmicToneCurve, hasColorGrade, linearToSrgb, normalizeColorGrade, srgbToLinear } from "../src/lib/editor/color-grading";
import { cloneVideoFilterPreset, videoFilterToCss } from "../src/lib/editor/video-filters";
import { videoFilterSchema } from "../src/lib/editor/schema";
import type { VideoFilter } from "../src/lib/editor/types";

const neutral = (): VideoFilter => cloneVideoFilterPreset("none");
const pixel = (rgb: number[], change: Partial<VideoFilter> = {}) => {
  const data = new Uint8ClampedArray([...rgb, 137]);
  applyColorGradeToPixels(data, { ...neutral(), ...change });
  return Array.from(data);
};

describe("shared native/capture color grading", () => {
  it("preserves every neutral byte including alpha and hidden RGB", () => {
    const bytes = Uint8ClampedArray.from({ length: 1024 }, (_, i) => i % 256);
    const original = bytes.slice();
    applyColorGradeToPixels(bytes, neutral());
    expect(bytes).toEqual(original);
    expect(hasColorGrade(neutral())).toBe(false);
  });
  it("round trips the sRGB transfer function", () => {
    for (let n = 0; n <= 255; n++) expect(linearToSrgb(srgbToLinear(n / 255))).toBeCloseTo(n / 255, 12);
  });
  it("exposes in linear light and applies controls even with preset none", () => {
    const expected = Math.round(linearToSrgb(srgbToLinear(100 / 255) * 2) * 255);
    expect(pixel([100, 100, 100], { exposure: 1 })).toEqual([expected, expected, expected, 137]);
    expect(expected).not.toBe(200);
    expect(pixel([100, 100, 100], { exposure: -1 })[0]).toBeLessThan(100);
  });
  it("uses white-balance channel gains rather than hue rotation", () => {
    const warm = pixel([128, 128, 128], { temperature: 1 });
    expect(warm[0]).toBeGreaterThan(warm[1]);
    expect(warm[1]).toBeGreaterThan(warm[2]);
    const cool = pixel([128, 128, 128], { temperature: -1 });
    expect(cool[0]).toBe(warm[2]);
    expect(cool[2]).toBe(warm[0]);
    const tint = pixel([128, 128, 128], { tint: 1 });
    expect(tint[0]).toBe(tint[2]);
    expect(tint[0]).toBeGreaterThan(tint[1]);
  });
  it("targets shadows and highlights independently and preserves black", () => {
    expect(pixel([40, 40, 40], { shadows: 1 })[0]).toBeGreaterThan(40);
    expect(pixel([240, 240, 240], { shadows: 1 })[0]).toBe(240);
    expect(pixel([40, 40, 40], { highlights: -1 })[0]).toBe(40);
    expect(pixel([240, 240, 240], { highlights: -1 })[0]).toBeLessThan(240);
    expect(pixel([0, 0, 0], { exposure: 2, shadows: 1 })).toEqual([0, 0, 0, 137]);
  });
  it("has a gentle monotonic filmic curve with fixed endpoints", () => {
    expect(filmicToneCurve(0)).toBe(0);
    expect(filmicToneCurve(1)).toBe(1);
    expect(filmicToneCurve(0.2)).toBeLessThan(0.2);
    expect(filmicToneCurve(0.8)).toBeGreaterThan(0.8);
    for (let i = 1; i <= 1000; i++) {
      expect(filmicToneCurve(i / 1000)).toBeGreaterThan(filmicToneCurve((i - 1) / 1000));
      expect(Math.abs(filmicToneCurve(i / 1000) - i / 1000)).toBeLessThan(0.025);
    }
  });
  it("leaves legacy controls to the caller's first CSS pass", () => {
    for (const change of [{ brightness: 1.2 }, { contrast: 1.2 }, { saturation: 0.3 }, { sepia: 0.7 }, { grayscale: 1 }, { hueRotate: 30 }]) {
      const result = pixel([60, 120, 190], change);
      expect(result.slice(0, 3)).toEqual([60, 120, 190]);
      expect(result[3]).toBe(137);
      expect(videoFilterToCss({ ...neutral(), ...change })).not.toBe("none");
    }
    expect(videoFilterToCss({ ...neutral(), brightness: 1.2, contrast: 1.1, saturation: 0.7, sepia: 0.2, grayscale: 0.1, hueRotate: 20 })).toBe("brightness(1.2) contrast(1.1) saturate(0.7) sepia(0.2) grayscale(0.1) hue-rotate(20deg)");
  });
  it("does not mutate controls and cannot contaminate the next neutral clip", () => {
    const filter = Object.freeze({ ...neutral(), exposure: 1 });
    applyColorGradeToPixels(new Uint8ClampedArray([40, 60, 80, 0]), filter);
    expect(pixel([40, 60, 80])).toEqual([40, 60, 80, 137]);
    expect(videoFilterToCss(filter)).toBe("none");
  });
  it("sanitizes nonfinite runtime inputs and rejects malformed pixel buffers", () => {
    expect(normalizeColorGrade({ exposure: Infinity, tint: NaN, temperature: 9 })).toMatchObject({ exposure: 0, tint: 0, temperature: 1 });
    expect(() => applyColorGradeToPixels(new Uint8ClampedArray(3), neutral())).toThrow(RangeError);
  });
  it("keeps old projects valid and rejects invalid new persisted controls", () => {
    const old = { preset: "custom", brightness: 1, contrast: 1, saturation: 1, sepia: 0, grayscale: 0, hueRotate: 0 };
    expect(videoFilterSchema.parse(old)).toEqual(old);
    expect(videoFilterSchema.parse({ ...old, exposure: 2, temperature: -1, tint: 1, shadows: -1, highlights: 1, toneCurve: "filmic" })).toMatchObject({ exposure: 2, toneCurve: "filmic" });
    for (const invalid of [{ exposure: 2.01 }, { temperature: -1.01 }, { tint: 1.01 }, { shadows: -1.01 }, { highlights: 1.01 }, { toneCurve: "log" }, { exposure: NaN }]) {
      expect(videoFilterSchema.safeParse({ ...old, ...invalid }).success).toBe(false);
    }
  });
});
