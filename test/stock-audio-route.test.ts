import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getMusic } from "@/app/api/stock-audio/music/route";
import { GET as getSfx } from "@/app/api/stock-audio/sfx/route";

const originalJamendo = process.env.JAMENDO_CLIENT_ID;
const originalFreesound = process.env.FREESOUND_API_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalJamendo === undefined) delete process.env.JAMENDO_CLIENT_ID;
  else process.env.JAMENDO_CLIENT_ID = originalJamendo;
  if (originalFreesound === undefined) delete process.env.FREESOUND_API_KEY;
  else process.env.FREESOUND_API_KEY = originalFreesound;
});

describe("licensed stock audio routes", () => {
  it("reports missing optional provider configuration", async () => {
    delete process.env.JAMENDO_CLIENT_ID;
    delete process.env.FREESOUND_API_KEY;
    expect((await getMusic(new Request("https://inkframe.test/api/stock-audio/music?query=focus"))).status).toBe(503);
    expect((await getSfx(new Request("https://inkframe.test/api/stock-audio/sfx?query=whoosh"))).status).toBe(503);
  });

  it("proxies Jamendo without returning the client id", async () => {
    process.env.JAMENDO_CLIENT_ID = "private-client-id";
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );
    const response = await getMusic(new Request("https://inkframe.test/api/stock-audio/music?query=focus"));
    expect(response.status).toBe(200);
    expect(fetcher.mock.calls[0]?.[0]).toContain("client_id=private-client-id");
    expect(JSON.stringify(await response.json())).not.toContain("private-client-id");
  });
});
