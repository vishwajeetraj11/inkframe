import { describe, expect, it } from "vitest";
import {
  getTemplateDefinition,
  TEMPLATE_DEFINITIONS,
} from "@/lib/editor/templates";

describe("editor template catalog", () => {
  it("only exposes templates with complete Elah-native timelines", () => {
    expect(TEMPLATE_DEFINITIONS.map((template) => template.id)).toEqual([
      "editorial-explainer",
      "product-reveal",
      "social-promo",
      "documentary-cut",
      "data-pulse",
      "quote-reel",
    ]);
    expect(TEMPLATE_DEFINITIONS.every((template) => template.blueprint)).toBe(true);
  });

  it("returns null for unknown templates", () => {
    expect(getTemplateDefinition(null)).toBeNull();
    expect(getTemplateDefinition("missing-template")).toBeNull();
  });

  it("does not resolve removed starter templates", () => {
    expect(getTemplateDefinition("classic")).toBeNull();
    expect(getTemplateDefinition("grid-kinetic")).toBeNull();
    expect(getTemplateDefinition("editorial-mono")).toBeNull();
  });

  it("does not resolve removed vox explainer template", () => {
    expect(getTemplateDefinition("vox-explainer")).toBeNull();
  });

  it("retires Remotion-era preset links instead of opening broken projects", () => {
    expect(getTemplateDefinition("vox-timeline")).toBeNull();
    expect(getTemplateDefinition("editorial-seat-arc")).toBeNull();
    expect(getTemplateDefinition("regional-map-focus")).toBeNull();
    expect(getTemplateDefinition("film-frame-gallery")).toBeNull();
  });

  it("resolves the replacement native templates with starter media", () => {
    expect(getTemplateDefinition("documentary-cut")).toMatchObject({
      name: "Documentary Cut",
      stylePreset: "classic",
    });
    expect(getTemplateDefinition("data-pulse")?.starterAssets).toHaveLength(3);
    expect(getTemplateDefinition("quote-reel")?.starterAssets).toHaveLength(3);
  });
});
