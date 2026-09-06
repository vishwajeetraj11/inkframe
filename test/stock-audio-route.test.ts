import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getMusic } from "@/app/api/stock-audio/music/route";
import { GET as getSfx } from "@/app/api/stock-audio/sfx/route";

const originalFreesound = process.env.FREESOUND_API_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalFreesound === undefined) delete process.env.FREESOUND_API_KEY;
  else process.env.FREESOUND_API_KEY = originalFreesound;
});

describe("licensed stock audio routes", () => {
  it("reports missing optional provider configuration", async () => {
    delete process.env.FREESOUND_API_KEY;
    expect((await getMusic(new Request("https://inkframe.test/api/stock-audio/music?query=focus"))).status).toBe(503);
    expect((await getSfx(new Request("https://inkframe.test/api/stock-audio/sfx?query=whoosh"))).status).toBe(503);
  });

  it.each([
    ["music", getMusic], ["sfx", getSfx],
  ] as const)("proxies %s through Freesound without returning the API key", async (kind, handler) => {
    process.env.FREESOUND_API_KEY = "private-sound-key";
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );
    const response = await handler(new Request(`https://inkframe.test/api/stock-audio/${kind}?query=focus`));
    expect(response.status).toBe(200);
    expect(new URL(String(fetcher.mock.calls[0]?.[0])).hostname).toBe("freesound.org");
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ headers: { Authorization: "Token private-sound-key" } });
    const result = await response.json();
    expect(result.provider).toBe("freesound");
    expect(JSON.stringify(result)).not.toContain("private-sound-key");
  });
});
