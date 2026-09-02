import { describe, expect, it, vi } from "vitest";
import {
  sanitizeFreesoundResponse,
  sanitizeJamendoResponse,
  searchFreesoundEffects,
  searchJamendoMusic,
} from "@/lib/stock-audio";

describe("licensed stock audio", () => {
  it("keeps downloadable Jamendo tracks with remix-safe Creative Commons licenses", () => {
    const result = sanitizeJamendoResponse({ results: [{
      id: "12",
      name: "Forward Motion",
      artist_id: "7",
      artist_name: "Studio Artist",
      duration: 84.25,
      shareurl: "https://www.jamendo.com/track/12",
      audiodownload: "https://cdn.jamendo.com/download/track-12.mp3",
      audiodownload_allowed: true,
      license_ccurl: "https://creativecommons.org/licenses/by/4.0/",
    }] }, "cinematic");

    expect(result.results[0]).toMatchObject({
      id: "12",
      provider: "jamendo",
      licenseName: "CC BY",
      attributionRequired: true,
    });
  });

  it("rejects noncommercial/derivative-restricted music", () => {
    const result = sanitizeJamendoResponse({ results: [{
      id: "13",
      name: "Restricted",
      duration: 60,
      shareurl: "https://www.jamendo.com/track/13",
      audio: "https://cdn.jamendo.com/13.mp3",
      license_ccurl: "https://creativecommons.org/licenses/by-nc-nd/4.0/",
    }] }, "restricted");
    expect(result.results).toEqual([]);
  });

  it("sanitizes Freesound previews with their license and creator", () => {
    const result = sanitizeFreesoundResponse({ results: [{
      id: 98,
      name: "Fast cinematic whoosh.wav",
      username: "Sound Maker",
      duration: 1.2,
      url: "https://freesound.org/s/98/",
      license: "https://creativecommons.org/publicdomain/zero/1.0/",
      previews: { "preview-hq-mp3": "https://cdn.freesound.org/98.mp3" },
      tags: ["whoosh", "transition"],
    }] }, "whoosh");
    expect(result.results[0]).toMatchObject({
      id: "98",
      provider: "freesound",
      licenseName: "CC0",
      attributionRequired: false,
    });
  });

  it("keeps provider credentials server-side", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ results: [] }), { status: 200 }));
    await searchJamendoMusic("focus", { clientId: "client-secret", fetcher });
    expect(fetcher.mock.calls[0]?.[0]).toContain("client_id=client-secret");

    await searchFreesoundEffects("whoosh", { apiKey: "sound-secret", fetcher });
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      headers: { Authorization: "Token sound-secret" },
    });
  });
});
