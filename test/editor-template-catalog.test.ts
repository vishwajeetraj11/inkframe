import { describe, expect, it } from "vitest";
import {
  getTemplateDefinition,
  TEMPLATE_DEFINITIONS,
  TEMPLATE_DEFINITION_MAP,
} from "@/lib/editor/templates";

describe("editor template catalog", () => {
  it("keeps the known template ids stable", () => {
    expect(TEMPLATE_DEFINITIONS.map((template) => template.id)).toContain("grid-kinetic");
    expect(TEMPLATE_DEFINITIONS.map((template) => template.id)).toContain("news-clipping");
    expect(TEMPLATE_DEFINITION_MAP["classic"].stylePreset).toBe("classic");
  });

  it("returns null for unknown templates", () => {
    expect(getTemplateDefinition(null)).toBeNull();
    expect(getTemplateDefinition("missing-template")).toBeNull();
  });

  it("resolves the grid kinetic template", () => {
    expect(getTemplateDefinition("grid-kinetic")).toMatchObject({
      id: "grid-kinetic",
      stylePreset: "grid-kinetic",
      name: "Grid Kinetic",
    });
  });
});
