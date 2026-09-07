import { FPS } from "../constants";
import type { VersionTimeline, VideoFilter } from "../types";
import type { EditorFrameCapture } from "../export-state";
import { sourceTimeAtFrame } from "../time-mapping";
import { videoFilterToCss } from "../video-filters";
import { applyColorGradeToPixels } from "../color-grading";
import type { SourceColorAsset } from "./source-frame-analysis";

export interface ColorComparisonEvidence {
  clipId: string;
  scope: "source-clip";
  samples: Array<{ frame: number; sourceTimeSeconds: number; before: EditorFrameCapture; after: EditorFrameCapture }>;
  warnings: string[];
}

const waitFor = (target: HTMLMediaElement | HTMLImageElement, event: string, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
    const cleanup = () => {
      clearTimeout(timer);
      target.removeEventListener(event, success);
      target.removeEventListener("error", failure);
      signal?.removeEventListener("abort", abort);
    };
    const success = () => { cleanup(); resolve(); };
    const failure = () => { cleanup(); reject(new Error("Source media could not be decoded for comparison.")); };
    const abort = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("Source comparison timed out.")); }, 10000);
    target.addEventListener(event, success, { once: true });
    target.addEventListener("error", failure, { once: true });
    signal?.addEventListener("abort", abort, { once: true });
  });

/** Grade two copies of each decoded timestamp without modifying source or timeline. */
export const captureColorComparison = async ({ version, assets, clipId, before, after, signal }: {
  version: VersionTimeline; assets: readonly SourceColorAsset[]; clipId: string;
  before: VideoFilter; after: VideoFilter; signal?: AbortSignal;
}): Promise<ColorComparisonEvidence> => {
  const clip = version.clips.find((item) => item.id === clipId);
  const asset = assets.find((item) => item.assetId === clip?.assetId);
  if (!clip || !asset || asset.kind === "audio") throw new Error("Comparison source is unavailable.");
  if (asset.dynamicRange === "hdr" || asset.colorSpace === "rec2020") throw new Error("HDR grading requires a color-managed pipeline; this comparison supports SDR only.");
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  let ownedUrl: string | undefined;
  const url = asset.objectUrl || (asset.file ? (ownedUrl = URL.createObjectURL(asset.file)) : asset.externalUrl);
  if (!url) throw new Error("Import this clip locally or provide a CORS-enabled source to review it.");
  const drawable = clip.kind === "image" ? new Image() : document.createElement("video");
  drawable.crossOrigin = "anonymous";
  const samples: ColorComparisonEvidence["samples"] = [];
  try {
    if (drawable instanceof HTMLVideoElement) {
      drawable.muted = true;
      drawable.preload = "auto";
      drawable.playsInline = true;
      const ready = waitFor(drawable, "loadeddata", signal);
      drawable.src = url;
      drawable.load();
      await ready;
    } else {
      const ready = waitFor(drawable, "load", signal);
      drawable.src = url;
      await ready;
    }
    const sourceWidth = drawable instanceof HTMLVideoElement ? drawable.videoWidth : drawable.naturalWidth;
    const sourceHeight = drawable instanceof HTMLVideoElement ? drawable.videoHeight : drawable.naturalHeight;
    if (!sourceWidth || !sourceHeight) throw new Error("Decoded source has no image dimensions.");
    const scale = Math.min(1, 384 / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Frame comparison canvas is unavailable.");
    const frames = [...new Set([0.12, 0.5, 0.88].map((fraction) =>
      clip.startFrame + Math.floor(Math.max(0, clip.endFrame - clip.startFrame - 1) * fraction)))];
    for (const frame of frames) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const requested = clip.kind === "image" ? 0 : sourceTimeAtFrame(clip.timeMapping, frame - clip.startFrame, clip.trimStartFrame, FPS) / 1e6;
      let sourceTimeSeconds = requested;
      if (drawable instanceof HTMLVideoElement) {
        if (!Number.isFinite(requested) || requested < 0 || requested >= drawable.duration) throw new Error("Comparison timestamp falls outside source media.");
        sourceTimeSeconds = Math.min(requested, Math.max(0, drawable.duration - 0.001));
        if (Math.abs(drawable.currentTime - sourceTimeSeconds) > 0.0001) {
          const ready = waitFor(drawable, "seeked", signal);
          drawable.currentTime = sourceTimeSeconds;
          await ready;
        }
      }
      const render = (filter: VideoFilter): EditorFrameCapture => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.filter = videoFilterToCss(filter);
        context.drawImage(drawable, 0, 0, canvas.width, canvas.height);
        context.filter = "none";
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        applyColorGradeToPixels(pixels.data, filter);
        context.putImageData(pixels, 0, 0);
        return { frame, width: canvas.width, height: canvas.height, mimeType: "image/jpeg", dataUrl: canvas.toDataURL("image/jpeg", 0.78), contrastChecks: [] };
      };
      samples.push({ frame, sourceTimeSeconds, before: render(before), after: render(after) });
    }
    return { clipId, scope: "source-clip", samples, warnings: [
      "Source-clip comparison excludes titles, transforms and transitions; inspect the final composition separately.",
      ...(asset.colorSpace !== "srgb" || asset.dynamicRange !== "sdr" ? ["Source color-space metadata is unknown; browser-decoded SDR/sRGB comparison is assumed."] : []),
    ] };
  } finally {
    if (drawable instanceof HTMLVideoElement) {
      drawable.pause(); drawable.removeAttribute("src"); drawable.load();
    } else drawable.removeAttribute("src");
    if (ownedUrl) URL.revokeObjectURL(ownedUrl);
  }
};
