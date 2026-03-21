import { describe, expect, it } from "vitest";
import { createDefaultEditorCompositionProps } from "@/remotion/default-editor-composition-props";

describe("default editor composition props", () => {
  it("creates the empty reel renderer payload in render mode", () => {
    expect(createDefaultEditorCompositionProps("reel_9_16")).toMatchObject({
      renderMode: "render",
      assetSources: {},
      version: {
        aspect: "reel_9_16",
        clips: [],
        textOverlays: [],
        audioTracks: [],
        transitions: [],
      },
    });
  });

  it("creates the empty widescreen renderer payload in render mode", () => {
    expect(createDefaultEditorCompositionProps("widescreen_16_9")).toMatchObject({
      renderMode: "render",
      assetSources: {},
      version: {
        aspect: "widescreen_16_9",
        clips: [],
        textOverlays: [],
        audioTracks: [],
        transitions: [],
      },
    });
  });
});
