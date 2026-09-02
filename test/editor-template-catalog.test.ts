import { describe, expect, it } from "vitest";
import {
  getTemplateDefinition,
  TEMPLATE_DEFINITIONS,
} from "@/lib/editor/templates";

describe("editor template catalog", () => {
  it("publishes only the verified editable templates", () => {
    expect(TEMPLATE_DEFINITIONS.map((template) => template.id)).toEqual([
      "agent-demo-reel",
      "one-number",
    ]);
    expect(TEMPLATE_DEFINITIONS[0]).toMatchObject({
      aspect: "reel_9_16",
      starterAssets: [
        { kind: "video", publicPath: "/starter-assets/agent-demo-reel/projected-portrait.mp4" },
        { kind: "video", publicPath: "/starter-assets/agent-demo-reel/neon-keyboard.mp4" },
        { kind: "video", publicPath: "/starter-assets/agent-demo-reel/purple-ink.mp4" },
        { kind: "audio", publicPath: "/starter-assets/agent-demo-reel/piano-synth-loop.mp3" },
      ],
    });
    expect(TEMPLATE_DEFINITIONS[1]).toMatchObject({
      id: "one-number",
      aspect: "reel_9_16",
      starterAssets: [
        { kind: "video", publicPath: "/starter-assets/one-number/chart-review-graded.mp4" },
        { kind: "video", publicPath: "/starter-assets/one-number/team-payoff-graded.mp4" },
        { kind: "audio", publicPath: "/starter-assets/one-number/neural-patterning.mp3" },
      ],
      blueprint: {
        clips: expect.any(Array),
        audioTracks: expect.any(Array),
        transitions: expect.any(Array),
      },
    });
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

  it("resolves the agent-created demo reel", () => {
    const template = getTemplateDefinition("agent-demo-reel");

    expect(template?.blueprint?.clips).toHaveLength(3);
    expect(template?.blueprint?.textOverlays).toHaveLength(7);
    expect(template?.blueprint?.transitions).toHaveLength(2);
    expect(template?.starterAssets?.map((asset) => asset.attribution?.provider)).toEqual([
      "pexels",
      "pexels",
      "pexels",
      "freesound",
    ]);
    expect(template?.starterAssets?.at(-1)?.attribution).toMatchObject({
      licenseName: "CC0",
      attributionRequired: false,
    });
  });

  it("resolves the editable One Number motion project", () => {
    const template = getTemplateDefinition("one-number");

    expect(template?.blueprint?.textOverlays).toHaveLength(9);
    expect(template?.blueprint?.clips).toHaveLength(2);
    expect(template?.blueprint?.audioTracks).toHaveLength(1);
    expect(template?.blueprint?.transitions).toHaveLength(1);
    expect(template?.starterAssets?.map((asset) => asset.attribution?.provider)).toEqual([
      "pexels",
      "pexels",
      "freesound",
    ]);
    expect(template?.starterAssets?.at(-1)?.attribution).toMatchObject({
      licenseName: "CC0",
      attributionRequired: false,
    });
    expect(
      template?.blueprint?.textOverlays.every((overlay) => overlay.stylePreset === "classic"),
    ).toBe(true);
    expect(template?.blueprint?.textOverlays.at(-1)?.endFrame).toBe(358);
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
