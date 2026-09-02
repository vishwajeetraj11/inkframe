import { describe, expect, it } from "vitest";
import {
  getTemplateDefinition,
  TEMPLATE_DEFINITIONS,
} from "@/lib/editor/templates";

describe("editor template catalog", () => {
  it("exposes an empty catalog while the library is being rebuilt", () => {
    expect(TEMPLATE_DEFINITIONS).toEqual([]);
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

});
