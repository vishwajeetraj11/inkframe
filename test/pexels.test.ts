import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chooseMp4Rendition,
  importVideoFromUrl,
  parsePexelsSearchParams,
  sanitizePexelsPhotoSearchResponse,
  sanitizePexelsSearchResponse,
} from "@/lib/pexels";

describe("Pexels search proxy domain", () => {
  it("normalizes and validates search parameters", () => {
    expect(parsePexelsSearchParams({
      query: "  city night  ",
      orientation: "portrait",
      page: "2",
      per_page: "12",
    })).toEqual({ query: "city night", orientation: "portrait", page: 2, perPage: 12 });
    expect(() => parsePexelsSearchParams({ query: "", orientation: "landscape" })).toThrow();
    expect(() => parsePexelsSearchParams({ query: "city", orientation: "vertical" })).toThrow();
    expect(() => parsePexelsSearchParams({ query: "city", page: "101" })).toThrow();
  });

  it("returns only safe metadata and mp4 renditions", () => {
    const result = sanitizePexelsSearchResponse({
      page: 1,
      per_page: 2,
      total_results: 1,
      next_page: "javascript:alert(1)",
      videos: [{
        id: 42,
        width: 1920,
        height: 1080,
        duration: 8.2,
        image: "https://images.pexels.com/video/42.jpeg",
        url: "https://www.pexels.com/video/42/",
        user: { name: "A Creator", url: "https://www.pexels.com/@creator" },
        video_files: [
          { id: 1, link: "https://cdn.pexels.com/42.mp4", file_type: "video/mp4", width: 1920, height: 1080 },
          { id: 2, link: "https://cdn.pexels.com/42.webm", file_type: "video/webm", width: 1920, height: 1080 },
        ],
        private_note: "must not escape",
      }],
    });

    expect(result.nextPage).toBeNull();
    expect(result.videos[0]).toMatchObject({ id: 42, photographer: "A Creator" });
    expect(result.videos[0]?.renditions).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("private_note");
  });

  it("sanitizes photo search metadata and chooses an export-sized source", () => {
    const result = sanitizePexelsPhotoSearchResponse({
      page: 1,
      per_page: 1,
      total_results: 1,
      photos: [
        {
          id: 77,
          width: 1600,
          height: 2400,
          url: "https://www.pexels.com/photo/77/",
          photographer: "Photo Maker",
          photographer_url: "https://www.pexels.com/@photo-maker",
          alt: "Editorial portrait",
          src: {
            medium: "https://images.pexels.com/photos/77-medium.jpeg",
            large2x: "https://images.pexels.com/photos/77-large.jpeg",
            evil: "javascript:alert(1)",
          },
          private_note: "must not escape",
        },
      ],
    });

    expect(result.photos[0]).toMatchObject({
      id: 77,
      photographer: "Photo Maker",
      imageUrl: "https://images.pexels.com/photos/77-large.jpeg",
    });
    expect(JSON.stringify(result)).not.toContain("private_note");
    expect(JSON.stringify(result)).not.toContain("javascript:");
  });
});

describe("Pexels rendition and browser import helpers", () => {
  afterEach(() => vi.restoreAllMocks());

  it("chooses the closest mp4 rendition for the target canvas", () => {
    const rendition = chooseMp4Rendition([
      { id: 1, url: "https://cdn.example/720.mp4", fileType: "mp4", width: 720, height: 1280 },
      { id: 2, url: "https://cdn.example/1080.mp4", fileType: "mp4", width: 1080, height: 1920 },
      { id: 3, url: "https://cdn.example/4k.webm", fileType: "mp4", width: 2160, height: 3840 },
    ], { width: 1080, height: 1920 });
    expect(rendition?.id).toBe(2);
  });

  it("downloads a rendition with progress and a browser File", async () => {
    const progress: number[] = [];
    const fetcher = vi.fn(async () => new Response("video-bytes", {
      status: 200,
      headers: { "content-length": "11", "content-type": "video/mp4" },
    }));
    const imported = await importVideoFromUrl("https://cdn.example/clip.mp4", {
      fetcher,
      fileName: "night-cut.mp4",
      onProgress: (value) => progress.push(value),
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(imported.file.name).toBe("night-cut.mp4");
    expect(imported.file.type).toBe("video/mp4");
    expect(await imported.blob.text()).toBe("video-bytes");
    expect(progress.at(-1)).toBe(1);
  });

  it("does not allow insecure import URLs", async () => {
    await expect(importVideoFromUrl("http://cdn.example/clip.mp4")).rejects.toThrow(/HTTPS/);
  });
});
