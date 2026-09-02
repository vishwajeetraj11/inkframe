import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/pexels/videos/route";

const originalApiKey = process.env.PEXELS_API_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalApiKey === undefined) delete process.env.PEXELS_API_KEY;
  else process.env.PEXELS_API_KEY = originalApiKey;
});

describe("GET /api/pexels/videos", () => {
  it("returns a configuration error without exposing server setup", async () => {
    delete process.env.PEXELS_API_KEY;
    const response = await GET(new Request("https://inkframe.test/api/pexels/videos?query=city"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Pexels video search is not configured." });
  });

  it("rejects invalid params before calling Pexels", async () => {
    process.env.PEXELS_API_KEY = "test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await GET(new Request("https://inkframe.test/api/pexels/videos?query=city&page=0"));
    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("proxies a sanitized result and preserves upstream rate limits", async () => {
    process.env.PEXELS_API_KEY = "test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      page: 1,
      per_page: 1,
      total_results: 1,
      videos: [{
        id: 101,
        width: 1920,
        height: 1080,
        duration: 4,
        image: "https://images.pexels.com/video/101.jpeg",
        url: "https://www.pexels.com/video/101/",
        user: { name: "Director", url: "https://www.pexels.com/@director" },
        video_files: [{ id: 1, link: "https://cdn.pexels.com/video-101.mp4", file_type: "video/mp4", width: 1920, height: 1080 }],
      }],
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const response = await GET(new Request("https://inkframe.test/api/pexels/videos?query=city&orientation=landscape"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-pexels-attribution")).toBe("https://www.pexels.com/");
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("orientation=landscape"), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "test-key" }),
    }));
    expect(await response.json()).toMatchObject({ videos: [{ id: 101, photographer: "Director" }] });
  });

  it("maps Pexels 429s to a retryable API response", async () => {
    process.env.PEXELS_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 429, headers: { "retry-after": "7" } }));
    const response = await GET(new Request("https://inkframe.test/api/pexels/videos?query=rate-limited"));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("7");
  });
});
