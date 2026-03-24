import { exportProjectSchema } from "@/lib/editor/schema";
import { REMOTION_SFX_LIBRARY, getRemotionSfxById } from "@/lib/editor/remotion-sfx";
import { describe, expect, it } from "vitest";

describe("Remotion SFX library", () => {
  it("exposes curated built-in sounds with stable URLs", () => {
    expect(REMOTION_SFX_LIBRARY.length).toBeGreaterThan(0);

    for (const effect of REMOTION_SFX_LIBRARY) {
      expect(effect.label.length).toBeGreaterThan(0);
      expect(effect.url.startsWith("https://remotion.media/")).toBe(true);
      expect(effect.defaultDurationInFrames).toBeGreaterThan(0);
      expect(getRemotionSfxById(effect.id)).toEqual(effect);
    }
  });

  it("allows export payload assets backed by external URLs", () => {
    const payload = exportProjectSchema.parse({
      activeVersion: "reel_9_16",
      versions: {
        reel_9_16: {
          aspect: "reel_9_16",
          clips: [],
          textOverlays: [
            {
              id: "overlay-1",
              text: "Test",
              startFrame: 0,
              endFrame: 30,
              x: 50,
              y: 50,
              fontSize: 56,
              color: "#ffffff",
              fontFamily: "sans",
              fontWeight: 700,
              fontStyle: "normal",
              stylePreset: "classic",
              createdaleyTexture: "plain",
            },
          ],
          audioTracks: [
            {
              id: "track-1",
              assetId: "asset-1",
              startFrame: 0,
              endFrame: 30,
              trimStartFrame: 0,
              trimEndFrame: 30,
              volume: 1,
            },
          ],
          transitions: [],
        },
        widescreen_16_9: {
          aspect: "widescreen_16_9",
          clips: [],
          textOverlays: [],
          audioTracks: [],
          transitions: [],
        },
      },
      assets: [
        {
          assetId: "asset-1",
          kind: "audio",
          mimeType: "audio/wav",
          name: "Whoosh",
          size: 0,
          externalUrl: REMOTION_SFX_LIBRARY[0].url,
        },
      ],
    });

    expect(payload.assets[0].externalUrl).toBe(REMOTION_SFX_LIBRARY[0].url);
  });
});
