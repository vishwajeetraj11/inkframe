import { describe, expect, it } from "vitest";
import {
  FLAGSHIP_TEMPLATE_BLUEPRINTS,
  instantiateTemplate,
  instantiateTemplateBlueprint,
} from "@/lib/editor/templates";

describe("Elah-native editor template blueprints", () => {
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

  it("keeps the audio-backed flagship cuts intact", () => {
    expect(FLAGSHIP_TEMPLATE_BLUEPRINTS["editorial-explainer"].audioTracks).toHaveLength(1);
    expect(FLAGSHIP_TEMPLATE_BLUEPRINTS["product-reveal"].audioTracks).toHaveLength(1);
    expect(FLAGSHIP_TEMPLATE_BLUEPRINTS["social-promo"].audioTracks).toHaveLength(1);
  });

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
    expect(timeline?.audioTracks[0].fadeInFrames).toBeGreaterThan(0);
    expect(instantiateTemplate("missing", () => "never")).toBeNull();
  });
});
