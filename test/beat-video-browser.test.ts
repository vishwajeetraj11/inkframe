import { afterEach, describe, expect, it, vi } from "vitest";
import { sampleVideoMoments } from "@/lib/editor/webmcp/beat-video-browser";

function mockBrowser(mode: "success" | "error" | "pending" = "success", duration = 4) {
  const video = document.createElement("video");
  const sheet = document.createElement("canvas");
  const sample = document.createElement("canvas");
  const seeks: number[] = [];
  let currentTime = 0;
  Object.defineProperties(video, {
    duration: { value: duration },
    videoWidth: { value: 640 },
    videoHeight: { value: 360 },
    currentTime: {
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value;
        seeks.push(value);
        queueMicrotask(() => video.dispatchEvent(new Event("seeked")));
      },
    },
  });
  const load = vi.spyOn(video, "load").mockImplementation(() => {
    if (!video.getAttribute("src")) return;
    if (mode !== "pending") queueMicrotask(() => video.dispatchEvent(new Event(mode === "error" ? "error" : "loadeddata")));
  });
  const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined);
  const remove = vi.spyOn(video, "remove");
  const removeListener = vi.spyOn(video, "removeEventListener");
  const labels = vi.fn();
  const context = {
    fillStyle: "", font: "", textBaseline: "",
    fillRect: vi.fn(), drawImage: vi.fn(), fillText: labels,
    getImageData: vi.fn(() => ({ width: 2, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]) })),
  };
  vi.spyOn(sheet, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(sample, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(sheet, "toDataURL").mockReturnValue("data:image/jpeg;base64,preview");
  const originalCreate = document.createElement.bind(document);
  let canvasCount = 0;
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag === "video") return video;
    if (tag === "canvas") return canvasCount++ === 0 ? sheet : sample;
    return originalCreate(tag);
  }) as typeof document.createElement);
  return { video, sheet, sample, seeks, load, pause, remove, removeListener, labels };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("video moment browser sampling", () => {
  it.each([
    { requested: 10, actual: 4, bounded: 4 },
    { requested: 2, actual: 4, bounded: 2 },
  ])("bounds six evenly spaced previews to $bounded seconds", async ({ requested, actual, bounded }) => {
    const browser = mockBrowser("success", actual);
    const result = await sampleVideoMoments("blob:source", { durationSeconds: requested });
    expect(result.imageDataUrl).toBe("data:image/jpeg;base64,preview");
    expect(result.moments).toHaveLength(6);
    result.moments.forEach((moment, index) => {
      expect(moment.timeSeconds).toBeCloseTo(bounded * (index + 0.5) / 6);
      expect(moment.timeSeconds).toBeLessThan(bounded);
      expect(moment.brightness).toBe(0.5);
      expect(moment.sharpness).toBe(1);
      expect(browser.labels.mock.calls[index][0]).toContain(`${moment.timeSeconds.toFixed(3)} s`);
    });
    expect(browser.seeks).toEqual(result.moments.map((moment) => moment.timeSeconds));
    expect(browser.pause).toHaveBeenCalledOnce();
    expect(browser.load).toHaveBeenCalledTimes(2);
    expect(browser.video.hasAttribute("src")).toBe(false);
    expect(browser.sheet.width).toBe(0);
    expect(browser.sample.height).toBe(0);
    expect(browser.remove).toHaveBeenCalledOnce();
  });

  it("rejects a pre-aborted request without starting a video load", async () => {
    const browser = mockBrowser();
    const controller = new AbortController();
    controller.abort();
    await expect(sampleVideoMoments("blob:source", { durationSeconds: 4, signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(browser.load).not.toHaveBeenCalled();
  });

  it("cancels a pending load and removes its listeners and resources", async () => {
    const browser = mockBrowser("pending");
    const controller = new AbortController();
    const sampling = sampleVideoMoments("blob:source", { durationSeconds: 4, signal: controller.signal });
    controller.abort();
    await expect(sampling).rejects.toMatchObject({ name: "AbortError" });
    expect(browser.removeListener).toHaveBeenCalledWith("loadeddata", expect.any(Function));
    expect(browser.removeListener).toHaveBeenCalledWith("error", expect.any(Function));
    expect(browser.video.hasAttribute("src")).toBe(false);
    expect(browser.pause).toHaveBeenCalledOnce();
    expect(browser.load).toHaveBeenCalledTimes(2);
  });

  it("releases the video after a decoder load error", async () => {
    const browser = mockBrowser("error");
    await expect(sampleVideoMoments("blob:source", { durationSeconds: 4 })).rejects.toThrow("could not decode");
    expect(browser.video.hasAttribute("src")).toBe(false);
    expect(browser.pause).toHaveBeenCalledOnce();
    expect(browser.remove).toHaveBeenCalledOnce();
    expect(browser.removeListener).toHaveBeenCalledWith("loadeddata", expect.any(Function));
  });

  it("times out a stalled load after ten seconds and clears resources", async () => {
    vi.useFakeTimers();
    const browser = mockBrowser("pending");
    const rejection = expect(sampleVideoMoments("blob:source", { durationSeconds: 4 })).rejects.toThrow("Timed out waiting for video loading");
    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;
    expect(browser.video.hasAttribute("src")).toBe(false);
    expect(browser.pause).toHaveBeenCalledOnce();
    expect(browser.remove).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
