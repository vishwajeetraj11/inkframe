import { describe, expect, it } from "vitest";
import {
  FLAGSHIP_TEMPLATE_BLUEPRINTS,
  NEW_DAY_PLACE_CUT_FRAMES,
  NEW_DAY_PLACE_FILTER_PRESETS,
  instantiateTemplate,
  instantiateTemplateBlueprint,
} from "@/lib/editor/templates";

describe("Elah-native editor template blueprints", () => {
  it("ships the agent-created reel as a fully editable 19-second project", () => {
    const blueprint = FLAGSHIP_TEMPLATE_BLUEPRINTS["agent-demo-reel"];

    expect(blueprint.aspect).toBe("reel_9_16");
    expect(blueprint.clips).toHaveLength(3);
    expect(blueprint.clips[0]).toMatchObject({ kind: "video", startFrame: 0, endFrame: 240 });
    expect(blueprint.clips[2]).toMatchObject({ kind: "video", startFrame: 480, endFrame: 570 });
    expect(blueprint.textOverlays).toHaveLength(7);
    expect(blueprint.transitions).toHaveLength(2);
    expect(blueprint.audioTracks).toHaveLength(1);
    expect(blueprint.audioTracks[0]).toMatchObject({
      startFrame: 0,
      endFrame: 570,
      trimEndFrame: 570,
      volume: 0.32,
      muted: false,
    });
  });

  it("ships One Number as a fully editable twelve-second audiovisual project", () => {
    const blueprint = FLAGSHIP_TEMPLATE_BLUEPRINTS["one-number"];

    expect(blueprint.aspect).toBe("reel_9_16");
    expect(blueprint.clips).toHaveLength(2);
    expect(blueprint.clips[0]).toMatchObject({ kind: "video", startFrame: 0, endFrame: 180 });
    expect(blueprint.clips[1]).toMatchObject({ kind: "video", startFrame: 180, endFrame: 368 });
    expect(blueprint.audioTracks).toHaveLength(1);
    expect(blueprint.audioTracks[0]).toMatchObject({
      startFrame: 0,
      endFrame: 358,
      trimEndFrame: 358,
      volume: 0.24,
      muted: false,
    });
    expect(blueprint.transitions).toHaveLength(1);
    expect(blueprint.textOverlays).toHaveLength(9);
    expect(blueprint.textOverlays.every((overlay) => overlay.stylePreset === "classic")).toBe(
      true,
    );
    expect(blueprint.textOverlays.map((overlay) => overlay.text)).toEqual(
      expect.arrayContaining([
        "73%",
        "THEN\n41%",
        "NOW\n73%",
        "DEMO DATA — REPLACE WITH YOUR SOURCE",
      ]),
    );
  });

  it("ships New Day as a 41.9-second hard-cut place portrait", () => {
    const blueprint = FLAGSHIP_TEMPLATE_BLUEPRINTS["new-day-place"];

    expect(blueprint.aspect).toBe("widescreen_16_9");
    expect(blueprint.clips).toHaveLength(19);
    expect(blueprint.clips.every((clip) => clip.kind === "video")).toBe(true);
    expect(new Set(blueprint.clips.map((clip) => clip.assetId))).toHaveLength(19);
    expect(blueprint.clips.every((clip) => clip.trimStartFrame === 0)).toBe(true);
    expect(blueprint.clips.map((clip) => clip.videoFilter?.preset)).toEqual(
      NEW_DAY_PLACE_FILTER_PRESETS,
    );
    expect(blueprint.clips.every((clip) => clip.videoFilter)).toBe(true);
    expect(blueprint.clips.map((clip) => clip.startFrame)).toEqual(
      NEW_DAY_PLACE_CUT_FRAMES.slice(0, -1),
    );
    expect(blueprint.clips.at(-1)?.endFrame).toBe(1257);
    expect(blueprint.transitions).toEqual([]);
    expect(blueprint.audioTracks).toEqual([
      expect.objectContaining({
        id: "new-day-place-audio-01",
        assetId: "new-day-place-audio-01",
        startFrame: 0,
        endFrame: 1257,
        trimStartFrame: 0,
        trimEndFrame: 1257,
        volume: 1,
        fadeInFrames: 0,
        fadeOutFrames: 0,
        muted: false,
      }),
    ]);
    expect(blueprint.textOverlays.slice(0, 4).map((overlay) => overlay.text)).toEqual([
      "BRAND NEW DAY",
      "INDIA",
      "LICENSED FOOTAGE · PEXELS CREATORS",
      "INDIA IN\n19 SCENES",
    ]);
    expect(blueprint.textOverlays.slice(0, 4).map((overlay) => overlay.fontFamily)).toEqual([
      "modern",
      "modern",
      "modern",
      "modern",
    ]);
    const sourceCredits = blueprint.textOverlays.slice(4);
    expect(sourceCredits).toHaveLength(19);
    expect(sourceCredits.every((credit) => credit.x === 80)).toBe(true);
    expect(sourceCredits.every((credit) => credit.y === 88)).toBe(true);
    expect(sourceCredits.every((credit) => credit.fontSize === 14)).toBe(true);
    expect(sourceCredits.every((credit) => credit.fontFamily === "modern")).toBe(true);
    expect(sourceCredits.every((credit) => credit.textAlign === "right")).toBe(true);
    expect(blueprint.textOverlays.every((overlay) => overlay.contrast === "outline")).toBe(true);
    expect(sourceCredits.every((credit) => credit.text.includes("VIDEO:"))).toBe(true);
    expect(sourceCredits.every((credit) => credit.text.endsWith("/ PEXELS"))).toBe(true);
  });

  it.each([
    "editorial-explainer",
    "product-reveal",
    "social-promo",
    "documentary-cut",
    "data-pulse",
    "quote-reel",
  ] as const)(
    "ships an editable timeline for %s",
    (templateId) => {
      const blueprint = FLAGSHIP_TEMPLATE_BLUEPRINTS[templateId];

      expect(blueprint.aspect).toBe("reel_9_16");
      expect(blueprint.clips.length).toBeGreaterThanOrEqual(3);
      expect(blueprint.textOverlays.length).toBeGreaterThanOrEqual(3);
      expect(blueprint.textOverlays.every((overlay) => overlay.stylePreset === "classic")).toBe(
        true,
      );
      expect(blueprint.transitions.length).toBeGreaterThanOrEqual(2);
      expect(blueprint.transitions.every((transition) => transition.kind)).toBe(true);
      expect(blueprint.clips.every((clip) => clip.kind === "image" || clip.kind === "video")).toBe(
        true,
      );
    },
  );

  it("injects fresh ids and remaps transition endpoints", () => {
    let sequence = 0;
    const timeline = instantiateTemplateBlueprint(
      FLAGSHIP_TEMPLATE_BLUEPRINTS["social-promo"],
      () => `session-id-${++sequence}`,
    );

    const clipIds = new Set(timeline.clips.map((clip) => clip.id));
    expect(timeline.clips.every((clip) => clip.id.startsWith("session-id-"))).toBe(true);
    expect(timeline.textOverlays.every((overlay) => overlay.id.startsWith("session-id-"))).toBe(
      true,
    );
    expect(timeline.audioTracks.every((track) => track.id.startsWith("session-id-"))).toBe(true);
    expect(timeline.transitions.every((transition) => clipIds.has(transition.fromClipId))).toBe(
      true,
    );
    expect(timeline.transitions.every((transition) => clipIds.has(transition.toClipId))).toBe(
      true,
    );
    expect(timeline.clips.some((clip) => clip.id.includes("social-promo"))).toBe(false);
  });

  it("resolves flagship catalog entries and rejects unknown ids", () => {
    let sequence = 0;
    const timeline = instantiateTemplate("editorial-explainer", () => `id-${++sequence}`);

    expect(timeline?.textOverlays[0].stylePreset).toBe("classic");
    expect(timeline?.audioTracks).toEqual([]);
    expect(instantiateTemplate("missing", () => "never")).toBeNull();
  });
});
