import { describe, expect, it } from "vitest";
import {
  buildRegionalMapFocusText,
  parseRegionalMapFocusText,
} from "@/lib/editor/regional-map-focus";
import {
  getSharedWorldBorderMesh,
  projectRegionalWorldMap,
} from "@/lib/maps/world";

describe("regional map focus parser", () => {
  it("parses the required fields and optional border mode", () => {
    const parsed = parseRegionalMapFocusText(
      "Why this border mattered\nA regional atlas zoom shows the local strategic context.\nPRIMARY: Iran\nSECONDARY: Iraq\nLABEL: Iran-Iraq boundary\nYEAR: 1975\nFOCUS: border",
    );

    expect(parsed).toMatchObject({
      primaryCountry: "Iran",
      secondaryCountry: "Iraq",
      label: "Iran-Iraq boundary",
      year: "1975",
      focusMode: "border",
    });
  });

  it("fills in defaults when optional fields are omitted", () => {
    const reparsed = parseRegionalMapFocusText(
      buildRegionalMapFocusText({
        headline: "Why the region matters",
        subhead: "A closer map view adds context.",
        primaryCountry: "India",
        secondaryCountry: "",
        label: "",
        year: "",
        focusMode: "country",
      }),
    );

    expect(reparsed.label).toBe("India");
    expect(reparsed.focusMode).toBe("country");
  });
});

describe("regional world map helpers", () => {
  it("derives a shared border for a known neighboring pair", () => {
    expect(getSharedWorldBorderMesh("Iran", "Iraq")).not.toBeNull();

    const projectedMap = projectRegionalWorldMap({
      width: 1380,
      height: 860,
      padding: { x: 176, y: 144 },
      primaryCountryName: "Iran",
      secondaryCountryName: "Iraq",
    });

    expect(projectedMap.sharedBorderPath.length).toBeGreaterThan(0);
    expect(projectedMap.sharedBorderCentroid).not.toBeNull();
  });

  it("returns an empty shared border for non-neighboring countries", () => {
    expect(getSharedWorldBorderMesh("India", "Brazil")).toBeNull();

    const projectedMap = projectRegionalWorldMap({
      width: 1380,
      height: 860,
      padding: { x: 176, y: 144 },
      primaryCountryName: "India",
      secondaryCountryName: "Brazil",
    });

    expect(projectedMap.sharedBorderPath).toBe("");
    expect(projectedMap.sharedBorderCentroid).toBeNull();
  });
});
