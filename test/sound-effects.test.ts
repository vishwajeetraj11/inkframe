import { describe, expect, it } from "vitest";
import {
  getSoundEffectById,
  getSoundEffectDataUrl,
  SOUND_EFFECT_LIBRARY,
} from "@/lib/editor/sound-effects";

describe("browser-native sound effects", () => {
  it("builds local WAV data URLs without a third-party runtime", () => {
    expect(SOUND_EFFECT_LIBRARY.length).toBeGreaterThan(0);

    for (const effect of SOUND_EFFECT_LIBRARY) {
      expect(effect.defaultDurationInFrames).toBeGreaterThan(0);
      expect(getSoundEffectById(effect.id)).toEqual(effect);
      expect(getSoundEffectDataUrl(effect)).toMatch(/^data:audio\/wav;base64,UklGR/);
    }
  });
});
