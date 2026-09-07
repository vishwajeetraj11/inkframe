export interface VideoMoment {
  timeSeconds: number;
  /** Mean Rec. 709 luma on decoded sRGB pixels, normalized to 0..1. */
  brightness: number;
  /** Mean neighboring-pixel luma difference, normalized to 0..1. Not a semantic score. */
  sharpness: number;
}

const checkAbort = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw signal.reason ?? new DOMException("Video sampling cancelled", "AbortError");
};

/** Attach listeners before starting a load or seek, and release them on every exit. */
const waitForVideo = (
  video: HTMLVideoElement,
  event: "loadeddata" | "seeked",
  start: () => void,
  signal?: AbortSignal,
): Promise<void> => new Promise((resolve, reject) => {
  checkAbort(signal);
  const cleanup = () => {
    clearTimeout(timer);
    video.removeEventListener(event, success);
    video.removeEventListener("error", failure);
    signal?.removeEventListener("abort", abort);
  };
  const success = () => { cleanup(); resolve(); };
  const failure = () => {
    cleanup();
    reject(new Error("The browser could not decode the video for moment previews."));
  };
  const abort = () => {
    cleanup();
    reject(signal?.reason ?? new DOMException("Video sampling cancelled", "AbortError"));
  };
  const timer = setTimeout(() => {
    cleanup();
    reject(new Error(`Timed out waiting for video ${event === "loadeddata" ? "loading" : "seeking"}.`));
  }, 10_000);
  video.addEventListener(event, success, { once: true });
  video.addEventListener("error", failure, { once: true });
  signal?.addEventListener("abort", abort, { once: true });
  try { start(); } catch (error) { cleanup(); reject(error); }
});

const measurePixels = (pixels: ImageData): Pick<VideoMoment, "brightness" | "sharpness"> => {
  const { width, height, data } = pixels;
  const luma = new Float32Array(width * height);
  let sum = 0;
  for (let index = 0; index < luma.length; index++) {
    const offset = index * 4;
    const value = (0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2]) / 255;
    luma[index] = value;
    sum += value;
  }
  let differences = 0;
  let edges = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (x + 1 < width) { differences += Math.abs(luma[index] - luma[index + 1]); edges++; }
      if (y + 1 < height) { differences += Math.abs(luma[index] - luma[index + width]); edges++; }
    }
  }
  return {
    brightness: Number((sum / luma.length).toFixed(5)),
    sharpness: Number((edges ? differences / edges : 0).toFixed(5)),
  };
};

/** Six source-frame previews for visual selection; measurements do not identify content. */
export async function sampleVideoMoments(
  url: string,
  options: { durationSeconds: number; signal?: AbortSignal },
): Promise<{ imageDataUrl: string; moments: VideoMoment[] }> {
  const { durationSeconds, signal } = options;
  checkAbort(signal);
  if (!url.trim()) throw new Error("A video URL is required.");
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("Video sampling requires a positive finite durationSeconds.");
  }
  if (typeof document === "undefined") throw new Error("Video moment sampling requires a browser.");

  const video = document.createElement("video");
  const sheet = document.createElement("canvas");
  const sample = document.createElement("canvas");
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  try {
    await waitForVideo(video, "loadeddata", () => { video.src = url; video.load(); }, signal);
    checkAbort(signal);
    if (video.videoWidth <= 0 || video.videoHeight <= 0) throw new Error("Video has no decodable picture dimensions.");
    const duration = Number.isFinite(video.duration)
      ? Math.min(durationSeconds, video.duration)
      : durationSeconds;
    if (duration <= 0) throw new Error("Video has no sampleable duration.");

    const tileWidth = 320;
    const tileHeight = 200;
    const labelHeight = 24;
    sheet.width = tileWidth * 3;
    sheet.height = (tileHeight + labelHeight) * 2;
    const sheetContext = sheet.getContext("2d");
    const sampleContext = sample.getContext("2d", { willReadFrequently: true });
    if (!sheetContext || !sampleContext) throw new Error("Canvas previews are unavailable in this browser.");
    const scale = Math.min(tileWidth / video.videoWidth, tileHeight / video.videoHeight);
    sample.width = Math.max(1, Math.round(video.videoWidth * scale));
    sample.height = Math.max(1, Math.round(video.videoHeight * scale));
    sheetContext.fillStyle = "#111827";
    sheetContext.fillRect(0, 0, sheet.width, sheet.height);
    sheetContext.font = "14px sans-serif";
    sheetContext.textBaseline = "middle";

    const moments: VideoMoment[] = [];
    for (let index = 0; index < 6; index++) {
      checkAbort(signal);
      // Interior points avoid unreliable exact-end seeks, including very short sources.
      const timeSeconds = duration * (index + 0.5) / 6;
      if (video.currentTime !== timeSeconds) {
        await waitForVideo(video, "seeked", () => { video.currentTime = timeSeconds; }, signal);
      }
      checkAbort(signal);
      sampleContext.drawImage(video, 0, 0, sample.width, sample.height);
      let statistics: Pick<VideoMoment, "brightness" | "sharpness">;
      try {
        statistics = measurePixels(sampleContext.getImageData(0, 0, sample.width, sample.height));
      } catch (error) {
        if (error instanceof DOMException && error.name === "SecurityError") {
          throw new Error("Video source blocks pixel access. Use a local asset or a CORS-enabled URL.");
        }
        throw error;
      }
      const x = (index % 3) * tileWidth;
      const y = Math.floor(index / 3) * (tileHeight + labelHeight);
      sheetContext.drawImage(sample, x + (tileWidth - sample.width) / 2, y + (tileHeight - sample.height) / 2);
      sheetContext.fillStyle = "#ffffff";
      sheetContext.fillText(`${index + 1} · ${timeSeconds.toFixed(3)} s`, x + 8, y + tileHeight + labelHeight / 2);
      moments.push({ timeSeconds, ...statistics });
    }
    checkAbort(signal);
    return { imageDataUrl: sheet.toDataURL("image/jpeg", 0.8), moments };
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
    sheet.width = sheet.height = sample.width = sample.height = 0;
    // The URL belongs to the caller: no object URLs are created or revoked here.
  }
}
