import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/pexels/photos/route";

const originalApiKey = process.env.PEXELS_API_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalApiKey === undefined) delete process.env.PEXELS_API_KEY;
  else process.env.PEXELS_API_KEY = originalApiKey;
});

describe("GET /api/pexels/photos", () => {
  it("requires server-side Pexels configuration", async () => {
    delete process.env.PEXELS_API_KEY;
    const response = await GET(new Request("https://inkframe.test/api/pexels/photos?query=city"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Pexels photo search is not configured." });
  });

  it("proxies and sanitizes photo search results", async () => {
    process.env.PEXELS_API_KEY = "test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          page: 1,
          per_page: 1,
          total_results: 1,
          photos: [
            {
              id: 55,
              width: 1600,
              height: 2400,
              url: "https://www.pexels.com/photo/55/",
              photographer: "Still Artist",
              photographer_url: "https://www.pexels.com/@still-artist",
              alt: "A city at night",
              src: {
                medium: "https://images.pexels.com/photos/55-medium.jpeg",
                large2x: "https://images.pexels.com/photos/55-large.jpeg",
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const response = await GET(
      new Request("https://inkframe.test/api/pexels/photos?query=city&orientation=portrait"),
    );
    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("orientation=portrait"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "test-key" }) }),
    );
    expect(await response.json()).toMatchObject({
      photos: [{ id: 55, photographer: "Still Artist" }],
    });
  });
});
