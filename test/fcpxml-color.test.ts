import { describe, expect, it } from "vitest";
import {
  applyInkframeColorLook,
  generateCubeLut,
  hasInkframeColorLook,
} from "@/lib/export/fcpxml-color";
import { cloneVideoFilterPreset } from "@/lib/editor/video-filters";

describe("FCPXML color handoff", () => {
  it("detects neutral and non-neutral looks", () => {
    expect(hasInkframeColorLook(cloneVideoFilterPreset("none"))).toBe(false);
    expect(hasInkframeColorLook(cloneVideoFilterPreset("cinematic"))).toBe(true);
  });

  it("samples the shared grade deterministically", () => {
    const filter = {
      ...cloneVideoFilterPreset("none"),
      preset: "custom" as const,
      exposure: 1,
    };
    expect(applyInkframeColorLook([0.25, 0.25, 0.25], filter)).toEqual([
      0.35294117647058826,
      0.35294117647058826,
      0.35294117647058826,
    ]);
  });

  it("writes a valid deterministic 3D cube with red varying fastest", () => {
    const lut = generateCubeLut({
      filter: cloneVideoFilterPreset("warm"),
      title: "Warm\nInterview",
      size: 2,
    });
    const lines = lut.trim().split("\n");
    expect(lines.slice(0, 4)).toEqual([
      'TITLE "Warm Interview"',
      "LUT_3D_SIZE 2",
      "DOMAIN_MIN 0.0 0.0 0.0",
      "DOMAIN_MAX 1.0 1.0 1.0",
    ]);
    expect(lines).toHaveLength(12);
    expect(lines[4]).toMatch(/^0\.\d{6} 0\.\d{6} 0\.\d{6}$/);
    expect(lines[5]).not.toBe(lines[4]);
    expect(generateCubeLut({
      filter: cloneVideoFilterPreset("warm"),
      title: "Warm\nInterview",
      size: 2,
    })).toBe(lut);
  });

  it("rejects unsafe cube sizes", () => {
    expect(() => generateCubeLut({
      filter: cloneVideoFilterPreset("warm"),
      title: "look",
      size: 1,
    })).toThrow("2 through 65");
  });
});
