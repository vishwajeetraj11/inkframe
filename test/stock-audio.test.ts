import { describe, expect, it, vi } from "vitest";
import {
  sanitizeFreesoundResponse,
  searchFreesoundEffects,
  searchFreesoundMusic,
} from "@/lib/stock-audio";

const sound = {
  id: 98,
  name: "Summer instrumental.wav",
  username: "Sound Maker",
  duration: 84.25,
  url: "https://freesound.org/s/98/",
  license: "https://creativecommons.org/licenses/by/4.0/",
  previews: { "preview-hq-mp3": "https://cdn.freesound.org/98.mp3" },
  tags: ["music", "summer"],
};

describe("licensed stock audio", () => {
  it("preserves music previews with their creator and attribution license", () => {
    const result = sanitizeFreesoundResponse({ results: [sound] }, "summer");
    expect(result.results[0]).toMatchObject({
      id: "98", provider: "freesound", durationSeconds: 84.25,
      licenseName: "CC BY", attributionRequired: true,
      creatorName: "Sound Maker", tags: ["music", "summer"],
    });
  });

  it("rejects noncommercial and derivative-restricted audio", () => {
    const results = ["by-nc", "by-nd", "by-nc-nd"].map((license) => ({
      ...sound, license: `https://creativecommons.org/licenses/${license}/4.0/`,
    }));
    expect(sanitizeFreesoundResponse({ results }, "restricted").results).toEqual([]);
  });

  it("sanitizes public-domain previews", () => {
    const result = sanitizeFreesoundResponse({ results: [{
      ...sound, license: "https://creativecommons.org/publicdomain/zero/1.0/",
    }] }, "whoosh");
    expect(result.results[0]).toMatchObject({ licenseName: "CC0", attributionRequired: false });
  });

  it("searches longer music and short effects with credentials in headers only", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ results: [sound] }), { status: 200 }));
    const music = await searchFreesoundMusic("summer", { apiKey: "sound-secret", fetcher });
    const effects = await searchFreesoundEffects("whoosh", { apiKey: "sound-secret", fetcher });
    const musicUrl = new URL(String(fetcher.mock.calls[0]?.[0]));
    const effectsUrl = new URL(String(fetcher.mock.calls[1]?.[0]));
    expect(musicUrl.hostname).toBe("freesound.org");
    expect(musicUrl.searchParams.get("query")).toBe("summer");
    expect(musicUrl.searchParams.get("filter")).toContain("tag:music duration:[1 TO 600]");
    expect(effectsUrl.searchParams.get("filter")).toContain("duration:[0.1 TO 30]");
    for (const [url, init] of fetcher.mock.calls) {
      expect(String(url)).not.toContain("sound-secret");
      expect(init).toMatchObject({ headers: { Authorization: "Token sound-secret" } });
    }
    expect(music.provider).toBe("freesound");
    expect(effects.provider).toBe("freesound");
    expect(JSON.stringify(music)).not.toContain("sound-secret");
  });
});
