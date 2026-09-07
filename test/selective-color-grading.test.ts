import { describe, expect, it } from "vitest";
import { applyColorGradeToPixels, hasColorGrade, isValidSelectiveColorRegions, selectiveRegionWeight } from "@/lib/editor/color-grading";
import { videoFilterSchema } from "@/lib/editor/schema";
import { cloneVideoFilterPreset } from "@/lib/editor/video-filters";
import { createDefaultClip, createInitialProjectSession } from "@/lib/editor/defaults";
import { editorReducer } from "@/lib/editor/reducer";
import { validateEditorCommandAction } from "@/lib/editor/history";
import { fromElahProject, toElahProject } from "@/lib/editor/elah-adapter";
import { migrateProjectContent } from "@/lib/editor/project-migrations";
import type { SelectiveColorRegion, VideoFilter } from "@/lib/editor/types";

const region: SelectiveColorRegion = { id: "face", shape: "ellipse", x: 0.5, y: 0.5,
  width: 0.5, height: 0.5, feather: 0.5, exposure: 1, temperature: 0, tint: 0, saturation: 1 };
const filter = (regions: SelectiveColorRegion[] = [region]): VideoFilter => ({ ...cloneVideoFilterPreset("none"), selectiveRegions: regions });

describe("selective SDR color grading", () => {
  it("uses center-relative shapes, inward smooth feather and complementary inversion", () => {
    expect(selectiveRegionWeight(region, 0.5, 0.5)).toBe(1);
    expect(selectiveRegionWeight(region, 0.75, 0.5)).toBe(0);
    expect(selectiveRegionWeight(region, 0.6875, 0.5)).toBeCloseTo(0.5);
    const rectangle = { ...region, shape: "rectangle" as const, feather: 0 };
    expect(selectiveRegionWeight(rectangle, 0.72, 0.72)).toBe(1);
    expect(selectiveRegionWeight({ ...region, feather: 0 }, 0.72, 0.72)).toBe(0);
    for (const x of [0, 0.25, 0.5, 0.68, 0.75, 1]) {
      expect(selectiveRegionWeight(region, x, 0.5) + selectiveRegionWeight({ ...region, inverted: true }, x, 0.5)).toBeCloseTo(1);
    }
  });
  it("grades only covered pixels and preserves alpha on a non-square image", () => {
    const pixels = new Uint8ClampedArray(5 * 3 * 4).fill(100);
    applyColorGradeToPixels(pixels, filter(), 5, 3);
    expect(pixels[7 * 4]).toBeGreaterThan(100);
    expect(Array.from(pixels.slice(0, 4))).toEqual([100, 100, 100, 100]);
    for (let i = 3; i < pixels.length; i += 4) expect(pixels[i]).toBe(100);
  });
  it("applies local saturation and white balance without altering outside pixels", () => {
    const pixels = new Uint8ClampedArray([200, 100, 50, 77, 200, 100, 50, 88]);
    applyColorGradeToPixels(pixels, filter([{ ...region, x: 0.25, width: 0.5, height: 1, feather: 0, saturation: 0 }]), 2, 1);
    expect(pixels[0]).toBe(pixels[1]); expect(pixels[1]).toBe(pixels[2]);
    expect(Array.from(pixels.slice(4))).toEqual([200, 100, 50, 88]);
    const warm = new Uint8ClampedArray([100, 100, 100, 255]);
    applyColorGradeToPixels(warm, filter([{ ...region, exposure: 0, temperature: 1, tint: 0.5 }]), 1, 1);
    expect(warm[0]).toBeGreaterThan(warm[1]); expect(warm[0]).toBeGreaterThan(warm[2]);
  });
  it("keeps no-region and neutral-region output identical and requires dimensions for active masks", () => {
    const bytes = new Uint8ClampedArray([45, 123, 210, 0]);
    const copy = bytes.slice();
    applyColorGradeToPixels(bytes, filter([{ ...region, exposure: 0 }]));
    expect(bytes).toEqual(copy);
    expect(hasColorGrade(filter())).toBe(true);
    expect(() => applyColorGradeToPixels(bytes, filter())).toThrow(RangeError);
    expect(() => applyColorGradeToPixels(bytes, filter(), 2, 1)).toThrow(RangeError);
  });
  it.each([null, {}, [region, region], Array.from({ length: 9 }, (_, i) => ({ ...region, id: String(i) })),
    ...[{ width: 0 }, { x: -0.1 }, { y: Infinity }, { exposure: NaN }, { temperature: 2 }, { tint: -2 },
      { saturation: 3 }, { feather: -1 }, { shape: "polygon" }, { inverted: "yes" }, { extra: 1 }].map(patch => [{ ...region, ...patch }])
  ])("rejects malformed masks in persistence and mutation preflight: %j", invalid => {
    const bad = { ...filter(), selectiveRegions: invalid } as VideoFilter;
    expect(isValidSelectiveColorRegions(invalid)).toBe(false);
    expect(videoFilterSchema.safeParse(bad).success).toBe(false);
    const session = createInitialProjectSession();
    session.versions.reel_9_16.clips = [createDefaultClip("shot", "asset", "video")];
    const action = { type: "update-clip" as const, aspect: "reel_9_16" as const, clipId: "shot", patch: { videoFilter: bad } };
    expect(validateEditorCommandAction(session, action)[0]?.code).toBe("INVALID_VALUE");
    expect(editorReducer(session, action)).toBe(session);
  });
  it.each(["video", "image"] as const)("persists and projects %s masks including explicit removal", kind => {
    const session = createInitialProjectSession();
    session.versions.reel_9_16.clips = [{ ...createDefaultClip("shot", "asset", kind), videoFilter: filter() }];
    const migrated = migrateProjectContent(JSON.parse(JSON.stringify(session)));
    expect(migrated.versions.reel_9_16.clips[0].videoFilter).toEqual(filter());
    const projection = toElahProject(migrated.versions.reel_9_16, { assetSources: { asset: "blob:selective" } });
    const native = Object.values(projection.project.clips).flat().find(clip => clip.id === "shot")! as unknown as { videoFilter: VideoFilter };
    expect(native.videoFilter).toEqual(filter());
    const saved = JSON.parse(JSON.stringify(projection));
    expect(fromElahProject(saved.project, saved.sidecar).version.clips[0].videoFilter).toEqual(filter());
    native.videoFilter.selectiveRegions = [];
    expect(fromElahProject(projection.project, projection.sidecar).version.clips[0].videoFilter?.selectiveRegions).toEqual([]);
    expect(projection.sidecar.canonicalVersion.clips[0].videoFilter?.selectiveRegions).toEqual([region]);
  });
});
