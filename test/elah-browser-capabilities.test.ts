import { describe, expect, it, vi } from "vitest";
import { detectElahBrowserCapabilities } from "@/lib/editor/elah-browser-capabilities";

const available = vi.fn();

describe("Elah browser capability detection", () => {
  it("is safe when called without browser globals", () => {
    const support = detectElahBrowserCapabilities({});

    expect(support.ready.timeline).toBe(false);
    expect(support.ready.videoPreview).toBe(false);
    expect(support.ready.videoExport).toBe(false);
    expect(support.missing.timeline).toEqual(["dom"]);
  });

  it("reports complete preview and export support", () => {
    const support = detectElahBrowserCapabilities({
      document: {
        createElement: () => ({
          getContext: (kind) => (kind === "webgl2" ? {} : null),
        }),
      },
      Worker: available,
      OffscreenCanvas: available,
      VideoDecoder: available,
      VideoEncoder: available,
      AudioEncoder: available,
      AudioContext: available,
      OfflineAudioContext: available,
      createImageBitmap: available,
    });

    expect(support.capabilities.webgl2).toBe(true);
    expect(support.ready).toEqual({
      timeline: true,
      imagePreview: true,
      videoPreview: true,
      audioPlayback: true,
      videoExport: true,
      audioExport: true,
    });
  });

  it("accepts Elah's WebGL 1 fallback but still exposes WebGL 2 separately", () => {
    const support = detectElahBrowserCapabilities({
      document: {
        createElement: () => ({
          getContext: (kind) => (kind === "webgl" ? {} : null),
        }),
      },
      VideoDecoder: available,
      createImageBitmap: available,
    });

    expect(support.capabilities.webgl).toBe(true);
    expect(support.capabilities.webgl2).toBe(false);
    expect(support.ready.videoPreview).toBe(true);
  });
});
