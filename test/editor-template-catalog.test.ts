import { describe, expect, it } from "vitest";
import {
  getTemplateDefinition,
  TEMPLATE_DEFINITIONS,
  TEMPLATE_DEFINITION_MAP,
} from "@/lib/editor/templates";

describe("editor template catalog", () => {
  it("keeps the public template ids stable", () => {
    expect(TEMPLATE_DEFINITIONS.map((template) => template.id)).toContain("vox-explainer");
    expect(TEMPLATE_DEFINITIONS.map((template) => template.id)).toContain("vox-timeline");
    expect(TEMPLATE_DEFINITIONS.map((template) => template.id)).toContain("vox-timeline-ribbon");
    expect(TEMPLATE_DEFINITIONS.map((template) => template.id)).toContain("vox-timeline-ledger");
    expect(TEMPLATE_DEFINITIONS.map((template) => template.id)).toContain("regional-map-focus");
    expect(TEMPLATE_DEFINITIONS.map((template) => template.id)).toContain("editorial-seat-arc");
    expect(TEMPLATE_DEFINITIONS.map((template) => template.id)).toContain("news-clipping");
    expect(TEMPLATE_DEFINITION_MAP["vox-explainer"].stylePreset).toBe("vox-explainer");
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

  it("resolves the vox explainer template", () => {
    expect(getTemplateDefinition("vox-explainer")).toMatchObject({
      id: "vox-explainer",
      stylePreset: "vox-explainer",
      name: "Vox Explainer",
    });
  });

  it("resolves the vox timeline template", () => {
    expect(getTemplateDefinition("vox-timeline")).toMatchObject({
      id: "vox-timeline",
      stylePreset: "vox-timeline",
      name: "Vox Timeline",
    });
  });

  it("resolves the additional timeline variations", () => {
    expect(getTemplateDefinition("vox-timeline-ribbon")).toMatchObject({
      id: "vox-timeline-ribbon",
      stylePreset: "vox-timeline-ribbon",
      name: "Timeline Ribbon",
    });
    expect(getTemplateDefinition("vox-timeline-ledger")).toMatchObject({
      id: "vox-timeline-ledger",
      stylePreset: "vox-timeline-ledger",
      name: "Timeline Ledger",
    });
  });

  it("resolves the editorial seat arc template", () => {
    expect(getTemplateDefinition("editorial-seat-arc")).toMatchObject({
      id: "editorial-seat-arc",
      stylePreset: "editorial-seat-arc",
      name: "Editorial Seat Arc",
    });
  });

  it("resolves the regional map focus template", () => {
    expect(getTemplateDefinition("regional-map-focus")).toMatchObject({
      id: "regional-map-focus",
      stylePreset: "regional-map-focus",
      name: "Regional Map Focus",
    });
  });
});
