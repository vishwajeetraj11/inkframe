import { FPS } from "../constants";
import type { Clip, VersionTimeline } from "../types";
import {
  analyzeFrameColorPixels,
  type FrameColorStatistics,
  type WeightedPaletteColor,
} from "../domain/frame-color-statistics";

export interface SourceColorAsset {
  assetId: string;
  kind: "video" | "image" | "audio";
  mimeType: string;
  file?: Blob;
  objectUrl?: string;
  externalUrl?: string;
  mediaMetadata?: { durationUs: number; width?: number; height?: number };
  /** Optional provenance metadata. Browser canvas samples are normalized to sRGB. */
  colorSpace?: "srgb" | "display-p3" | "rec2020" | "unknown";
  dynamicRange?: "sdr" | "hdr" | "unknown";
}

export interface SampledSourceFrame {
  sourceTimeSeconds: number;
  statistics: FrameColorStatistics;
}

export interface ClipSourceColorAggregate {
  luminance: number;
  exposure: number;
  temperature: number;
  tint: number;
  saturation: number;
  palette: WeightedPaletteColor[];
  skinToneFraction: number;
  lightingVariation: number;
  confidence: "high" | "medium" | "low";
}

export interface ClipSourceColorAnalysis {
  clipId: string;
  assetId: string;
  status: "analyzed" | "skipped" | "unreadable" | "cancelled";
  frames: SampledSourceFrame[];
  aggregate?: ClipSourceColorAggregate;
  warnings: string[];
}

export interface SourceFrameAnalysisReport {
  clips: ClipSourceColorAnalysis[];
  analyzedClipCount: number;
  skippedClipCount: number;
  unreadableClipCount: number;
  cancelled: boolean;
  warnings: string[];
}

export interface SourceFrameAnalysisProgress {
  completedClipCount: number;
  totalClipCount: number;
  currentClipId?: string;
  status?: ClipSourceColorAnalysis["status"];
  warnings: string[];
}

export interface SampleTimelineSourceFramesInput {
  version: VersionTimeline;
  assets: readonly SourceColorAsset[];
  signal?: AbortSignal;
  /** Defaults to three and is bounded to 1..5. */
  samplesPerClip?: number;
  /** Long edge of the analysis canvas. Defaults to 192 and is bounded to 64..384. */
  maximumDimension?: number;
  onProgress?: (progress: SourceFrameAnalysisProgress) => void;
}

type Drawable = HTMLImageElement | HTMLVideoElement;
type AnalysisContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

class SourceFrameError extends Error {
  constructor(
    readonly code: "cancelled" | "timeout" | "unreadable" | "unsupported",
    message: string,
  ) {
    super(message);
    this.name = "SourceFrameError";
  }
}

const round = (value: number, places = 4): number =>
  Number(value.toFixed(places));

const median = (values: readonly number[], fallback = 0): number => {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? fallback) + (sorted[middle] ?? fallback)) / 2
    : (sorted[middle] ?? fallback);
};

const abortError = (): SourceFrameError =>
  new SourceFrameError("cancelled", "Color analysis was cancelled.");

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw abortError();
};

const waitForMediaEvent = (
  target: HTMLMediaElement | HTMLImageElement,
  successEvent: string,
  signal?: AbortSignal,
  timeoutMs = 10_000,
): Promise<void> => new Promise((resolve, reject) => {
  throwIfAborted(signal);
  const cleanup = () => {
    target.removeEventListener(successEvent, onSuccess);
    target.removeEventListener("error", onError);
    signal?.removeEventListener("abort", onAbort);
    clearTimeout(timer);
  };
  const onSuccess = () => {
    cleanup();
    resolve();
  };
  const onError = () => {
    cleanup();
    reject(new SourceFrameError("unreadable", "The browser could not decode this media source."));
  };
  const onAbort = () => {
    cleanup();
    reject(abortError());
  };
  target.addEventListener(successEvent, onSuccess, { once: true });
  target.addEventListener("error", onError, { once: true });
  signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => {
    cleanup();
    reject(new SourceFrameError("timeout", "Timed out while decoding the media source."));
  }, timeoutMs);
});

const resolveSource = (
  asset: SourceColorAsset,
): { url: string; release: () => void } | null => {
  if (asset.objectUrl) return { url: asset.objectUrl, release: () => undefined };
  if (asset.file && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    const url = URL.createObjectURL(asset.file);
    return { url, release: () => URL.revokeObjectURL(url) };
  }
  if (asset.externalUrl) return { url: asset.externalUrl, release: () => undefined };
  return null;
};

const shouldRequestCors = (url: string): boolean => /^https?:/i.test(url);

const createAnalysisContext = (
  width: number,
  height: number,
): { context: AnalysisContext; width: number; height: number } => {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) return { context, width, height };
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) return { context, width, height };
  }
  throw new SourceFrameError("unsupported", "Canvas frame analysis is unavailable in this browser context.");
};

const sampleDrawable = (
  drawable: Drawable,
  sourceWidth: number,
  sourceHeight: number,
  maximumDimension: number,
): FrameColorStatistics => {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new SourceFrameError("unreadable", "The decoded media has no usable dimensions.");
  }
  const scale = Math.min(1, maximumDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const { context } = createAnalysisContext(width, height);
  try {
    context.drawImage(drawable, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    return analyzeFrameColorPixels({ pixels, width, height });
  } catch (error) {
    const message = error instanceof DOMException && error.name === "SecurityError"
      ? "The source blocks browser pixel access. Import it locally or use a CORS-enabled media URL."
      : "The browser could not read decoded source pixels.";
    throw new SourceFrameError("unreadable", message);
  }
};

const representativeFractions = (count: number): number[] => {
  if (count === 1) return [0.5];
  return Array.from({ length: count }, (_, index) =>
    0.12 + (0.76 * index) / (count - 1));
};

const sourceTimesForClip = (
  clip: Clip,
  count: number,
  mediaDuration: number,
): number[] => {
  if (clip.kind === "image") return [0];
  const trimStart = Math.max(0, clip.trimStartFrame / FPS);
  const trimEnd = Math.max(trimStart, clip.trimEndFrame / FPS);
  const boundedEnd = Number.isFinite(mediaDuration)
    ? Math.min(trimEnd, Math.max(0, mediaDuration - 0.001))
    : trimEnd;
  const duration = Math.max(0, boundedEnd - trimStart);
  return [...new Set(representativeFractions(count).map((fraction) =>
    round(Math.min(boundedEnd, trimStart + duration * fraction), 3),
  ))];
};

const paletteAggregate = (
  frames: readonly FrameColorStatistics[],
): WeightedPaletteColor[] => {
  const colors = new Map<string, number>();
  for (const frame of frames) {
    for (const color of frame.palette) {
      colors.set(color.hex, (colors.get(color.hex) ?? 0) + color.weight / frames.length);
    }
  }
  return [...colors]
    .map(([hex, weight]) => ({ hex, weight: round(weight) }))
    .sort((left, right) => right.weight - left.weight || left.hex.localeCompare(right.hex))
    .slice(0, 6);
};

const aggregateFrames = (
  frames: readonly FrameColorStatistics[],
  metadataKnown: boolean,
): ClipSourceColorAggregate | undefined => {
  const usable = frames.filter((frame) => frame.usable);
  if (usable.length === 0) return undefined;
  const exposures = usable.map((frame) => frame.exposure);
  const lightingVariation = Math.max(...exposures) - Math.min(...exposures);
  const confidence = usable.length >= 3 && metadataKnown && lightingVariation < 0.65
    ? "high"
    : usable.length >= 2 && lightingVariation < 1
      ? "medium"
      : "low";
  return {
    luminance: round(median(usable.map((frame) => frame.luminance.median))),
    exposure: round(median(exposures)),
    temperature: round(median(usable.map((frame) => frame.temperature))),
    tint: round(median(usable.map((frame) => frame.tint))),
    saturation: round(median(usable.map((frame) => frame.saturation))),
    palette: paletteAggregate(usable),
    skinToneFraction: round(median(usable.map((frame) => frame.skinToneFraction))),
    lightingVariation: round(lightingVariation),
    confidence,
  };
};

const sampleImage = async (
  url: string,
  maximumDimension: number,
  signal?: AbortSignal,
): Promise<SampledSourceFrame[]> => {
  if (typeof Image === "undefined") {
    throw new SourceFrameError("unsupported", "Browser image decoding is unavailable.");
  }
  const image = new Image();
  if (shouldRequestCors(url)) image.crossOrigin = "anonymous";
  const loaded = waitForMediaEvent(image, "load", signal);
  image.src = url;
  await loaded;
  throwIfAborted(signal);
  return [{
    sourceTimeSeconds: 0,
    statistics: sampleDrawable(
      image,
      image.naturalWidth,
      image.naturalHeight,
      maximumDimension,
    ),
  }];
};

const sampleVideo = async (
  clip: Clip,
  url: string,
  sampleCount: number,
  maximumDimension: number,
  signal?: AbortSignal,
): Promise<SampledSourceFrame[]> => {
  if (typeof document === "undefined") {
    throw new SourceFrameError("unsupported", "Browser video decoding is unavailable.");
  }
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.playsInline = true;
  if (shouldRequestCors(url)) video.crossOrigin = "anonymous";
  try {
    const metadataLoaded = waitForMediaEvent(video, "loadedmetadata", signal);
    video.src = url;
    video.load();
    await metadataLoaded;
    const times = sourceTimesForClip(clip, sampleCount, video.duration);
    const samples: SampledSourceFrame[] = [];
    for (const time of times) {
      throwIfAborted(signal);
      if (Math.abs(video.currentTime - time) > 0.001 || video.readyState < 2) {
        const frameLoaded = waitForMediaEvent(video, "seeked", signal);
        video.currentTime = time;
        await frameLoaded;
      }
      samples.push({
        sourceTimeSeconds: time,
        statistics: sampleDrawable(
          video,
          video.videoWidth,
          video.videoHeight,
          maximumDimension,
        ),
      });
    }
    return samples;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
};

const analyzeClip = async ({
  clip,
  asset,
  sampleCount,
  maximumDimension,
  signal,
}: {
  clip: Clip;
  asset: SourceColorAsset | undefined;
  sampleCount: number;
  maximumDimension: number;
  signal?: AbortSignal;
}): Promise<ClipSourceColorAnalysis> => {
  if (!asset || asset.kind === "audio") {
    return {
      clipId: clip.id,
      assetId: clip.assetId,
      status: "skipped",
      frames: [],
      warnings: ["No compatible visual asset was available for this clip."],
    };
  }
  if (asset.dynamicRange === "hdr" || asset.colorSpace === "rec2020") {
    return {
      clipId: clip.id,
      assetId: clip.assetId,
      status: "skipped",
      frames: [],
      warnings: ["HDR/Rec.2020 source analysis is not supported safely in v1."],
    };
  }
  const source = resolveSource(asset);
  if (!source) {
    return {
      clipId: clip.id,
      assetId: clip.assetId,
      status: "skipped",
      frames: [],
      warnings: ["This asset has no browser-readable source URL or Blob."],
    };
  }

  const warnings: string[] = [];
  const metadataKnown = asset.dynamicRange === "sdr" && asset.colorSpace === "srgb";
  if (!metadataKnown) {
    warnings.push("Color-space or dynamic-range metadata is unknown; confidence is reduced after browser canvas conversion.");
  }
  try {
    const frames = clip.kind === "image"
      ? await sampleImage(source.url, maximumDimension, signal)
      : await sampleVideo(clip, source.url, sampleCount, maximumDimension, signal);
    for (const frame of frames) {
      if (!frame.statistics.usable) {
        warnings.push(`Ignored ${frame.statistics.rejectionReason ?? "unusable"} frame at ${frame.sourceTimeSeconds.toFixed(2)}s.`);
      }
    }
    const aggregate = aggregateFrames(frames.map((frame) => frame.statistics), metadataKnown);
    if (!aggregate) {
      warnings.push("No representative frame contained trustworthy image content.");
      return {
        clipId: clip.id,
        assetId: clip.assetId,
        status: "unreadable",
        frames,
        warnings,
      };
    }
    if (aggregate.lightingVariation >= 0.75) {
      warnings.push("Lighting changes substantially within this clip; one correction may not fit the whole shot.");
    }
    return {
      clipId: clip.id,
      assetId: clip.assetId,
      status: "analyzed",
      frames,
      aggregate,
      warnings,
    };
  } catch (error) {
    const sourceError = error instanceof SourceFrameError
      ? error
      : new SourceFrameError("unreadable", "Unexpected media decoding failure.");
    return {
      clipId: clip.id,
      assetId: clip.assetId,
      status: sourceError.code === "cancelled" ? "cancelled" : "unreadable",
      frames: [],
      warnings: [...warnings, sourceError.message],
    };
  } finally {
    source.release();
  }
};

export const sampleTimelineSourceFrames = async ({
  version,
  assets,
  signal,
  samplesPerClip = 3,
  maximumDimension = 192,
  onProgress,
}: SampleTimelineSourceFramesInput): Promise<SourceFrameAnalysisReport> => {
  const sampleCount = Math.max(1, Math.min(5, Math.round(samplesPerClip)));
  const boundedDimension = Math.max(64, Math.min(384, Math.round(maximumDimension)));
  const assetsById = new Map(assets.map((asset) => [asset.assetId, asset]));
  const clips: ClipSourceColorAnalysis[] = [];

  onProgress?.({
    completedClipCount: 0,
    totalClipCount: version.clips.length,
    currentClipId: version.clips[0]?.id,
    warnings: [],
  });

  for (const [index, clip] of version.clips.entries()) {
    if (signal?.aborted) {
      const cancelled: ClipSourceColorAnalysis = {
        clipId: clip.id,
        assetId: clip.assetId,
        status: "cancelled",
        frames: [],
        warnings: ["Color analysis was cancelled before this clip was sampled."],
      };
      clips.push(cancelled);
      onProgress?.({
        completedClipCount: index + 1,
        totalClipCount: version.clips.length,
        currentClipId: clip.id,
        status: cancelled.status,
        warnings: cancelled.warnings,
      });
      continue;
    }
    const result = await analyzeClip({
      clip,
      asset: assetsById.get(clip.assetId),
      sampleCount,
      maximumDimension: boundedDimension,
      signal,
    });
    clips.push(result);
    onProgress?.({
      completedClipCount: index + 1,
      totalClipCount: version.clips.length,
      currentClipId: clip.id,
      status: result.status,
      warnings: result.warnings,
    });
  }

  const cancelled = clips.some((clip) => clip.status === "cancelled");
  return {
    clips,
    analyzedClipCount: clips.filter((clip) => clip.status === "analyzed").length,
    skippedClipCount: clips.filter((clip) => clip.status === "skipped").length,
    unreadableClipCount: clips.filter((clip) => clip.status === "unreadable").length,
    cancelled,
    warnings: [
      ...(cancelled ? ["Source-frame analysis was cancelled; partial results are retained."] : []),
      ...clips.flatMap((clip) => clip.warnings.map((warning) => `${clip.clipId}: ${warning}`)),
    ],
  };
};
