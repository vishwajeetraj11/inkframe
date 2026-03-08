import type { AssetRef, AspectPreset, VersionTimeline } from "@/lib/editor/types";
import { FPS, MAX_AUDIO_FILE_BYTES, MAX_DURATION_FRAMES, MAX_IMAGE_FILE_BYTES, MAX_VIDEO_FILE_BYTES } from "@/lib/editor/constants";

export const MIN_SCENE_DURATION_FRAMES = FPS;
export const MAX_SCENE_DURATION_FRAMES = FPS * 20;
export const ALL_ASPECTS: AspectPreset[] = ["reel_9_16", "widescreen_16_9"];

export const STYLE_PRESET_SEQUENCE: VersionTimeline["textOverlays"][number]["stylePreset"][] = [
  "impact-grid",
  "grid-kinetic",
  "hero-slam",
  "sticker-cutout",
  "editorial-mono",
  "vox-explainer",
  "vox-typography",
  "world-map-focus",
  "editorial-bar-chart",
  "editorial-stat-ring",
  "chart-card",
  "news-clipping",
  "createdaley-opener",
  "classic",
];

export const OVERLAY_DEFAULTS_BY_PRESET: Record<
  VersionTimeline["textOverlays"][number]["stylePreset"],
  {
    x: number;
    y: number;
    fontSize: number;
    color: string;
    fontFamily: VersionTimeline["textOverlays"][number]["fontFamily"];
    fontWeight: number;
    fontStyle: VersionTimeline["textOverlays"][number]["fontStyle"];
  }
> = {
  classic: { x: 50, y: 70, fontSize: 74, color: "#f8fafc", fontFamily: "serif", fontWeight: 700, fontStyle: "normal" },
  "impact-grid": { x: 50, y: 49, fontSize: 126, color: "#f5f5f5", fontFamily: "sans", fontWeight: 900, fontStyle: "normal" },
  "grid-kinetic": { x: 50, y: 49, fontSize: 132, color: "#f5f7f5", fontFamily: "sans", fontWeight: 900, fontStyle: "normal" },
  "hero-slam": { x: 50, y: 54, fontSize: 112, color: "#f8fafc", fontFamily: "sans", fontWeight: 900, fontStyle: "normal" },
  "sticker-cutout": { x: 50, y: 58, fontSize: 92, color: "#111827", fontFamily: "sans", fontWeight: 900, fontStyle: "normal" },
  "editorial-mono": { x: 50, y: 50, fontSize: 78, color: "#0f172a", fontFamily: "mono", fontWeight: 800, fontStyle: "normal" },
  "vox-explainer": { x: 46, y: 43, fontSize: 84, color: "#111827", fontFamily: "sans", fontWeight: 900, fontStyle: "normal" },
  "vox-typography": { x: 50, y: 46, fontSize: 92, color: "#f4ece6", fontFamily: "serif", fontWeight: 800, fontStyle: "italic" },
  "world-map-focus": { x: 50, y: 48, fontSize: 84, color: "#f4f7fb", fontFamily: "serif", fontWeight: 700, fontStyle: "normal" },
  "editorial-bar-chart": { x: 50, y: 42, fontSize: 78, color: "#111827", fontFamily: "serif", fontWeight: 700, fontStyle: "normal" },
  "editorial-stat-ring": { x: 50, y: 40, fontSize: 92, color: "#151515", fontFamily: "serif", fontWeight: 700, fontStyle: "normal" },
  "chart-card": { x: 50, y: 38, fontSize: 68, color: "#121212", fontFamily: "serif", fontWeight: 700, fontStyle: "normal" },
  "news-clipping": { x: 50, y: 34, fontSize: 96, color: "#121212", fontFamily: "serif", fontWeight: 800, fontStyle: "normal" },
  "createdaley-opener": { x: 50, y: 46, fontSize: 96, color: "#202124", fontFamily: "serif", fontWeight: 600, fontStyle: "normal" },
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const bytesToLabel = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const sanitizeUploadFilename = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_");

export const secondsToFrames = (seconds: number): number =>
  Math.max(1, Math.round(seconds * FPS));

export const normalizeFontWeight = (value: number | undefined): number => {
  const raw = value ?? 700;
  const roundedToHundreds = Math.round(raw / 100) * 100;
  return clamp(roundedToHundreds, 100, 900);
};

export const getPresetPositionFallback = (
  preset: VersionTimeline["textOverlays"][number]["stylePreset"],
  index: number,
): { x: number; y: number } => {
  if (preset === "impact-grid") {
    return { x: index % 2 === 0 ? 46 : 54, y: index % 3 === 0 ? 46 : 50 };
  }

  if (preset === "grid-kinetic") {
    return { x: index % 2 === 0 ? 48 : 52, y: index % 2 === 0 ? 48 : 51 };
  }

  if (preset === "hero-slam") {
    return { x: 50, y: index % 2 === 0 ? 54 : 57 };
  }

  if (preset === "sticker-cutout") {
    return { x: index % 2 === 0 ? 48 : 52, y: index % 3 === 0 ? 57 : 60 };
  }

  if (preset === "editorial-mono") {
    return { x: index % 3 === 0 ? 44 : index % 3 === 1 ? 56 : 50, y: index % 2 === 0 ? 49 : 53 };
  }

  if (preset === "vox-explainer") {
    return { x: index % 2 === 0 ? 45 : 47, y: index % 2 === 0 ? 42 : 46 };
  }

  if (preset === "vox-typography") {
    return { x: 50, y: index % 2 === 0 ? 46 : 48 };
  }

  if (preset === "world-map-focus") {
    return { x: 50, y: index % 2 === 0 ? 48 : 50 };
  }

  if (preset === "editorial-bar-chart") {
    return { x: 50, y: index % 2 === 0 ? 42 : 44 };
  }

  if (preset === "editorial-stat-ring") {
    return { x: 50, y: index % 2 === 0 ? 40 : 42 };
  }

  if (preset === "chart-card") {
    return { x: 50, y: index % 2 === 0 ? 38 : 40 };
  }

  if (preset === "news-clipping") {
    return { x: 50, y: index % 2 === 0 ? 34 : 36 };
  }

  if (preset === "createdaley-opener") {
    return { x: 50, y: index % 2 === 0 ? 46 : 48 };
  }

  return { x: 50, y: 70 };
};

export const getAdaptiveFontSize = (baseFontSize: number, text: string): number => {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length >= 9) {
    return Math.max(48, Math.round(baseFontSize * 0.62));
  }

  if (words.length >= 6) {
    return Math.max(56, Math.round(baseFontSize * 0.78));
  }

  if (words.length >= 4) {
    return Math.max(64, Math.round(baseFontSize * 0.9));
  }

  return baseFontSize;
};

export const fitSceneFramesToBudget = (requestedFrames: number[]): number[] => {
  const nextFrames = requestedFrames.map((duration) =>
    clamp(Math.round(duration), MIN_SCENE_DURATION_FRAMES, MAX_SCENE_DURATION_FRAMES),
  );

  let total = nextFrames.reduce((sum, duration) => sum + duration, 0);

  if (total > MAX_DURATION_FRAMES) {
    const scale = MAX_DURATION_FRAMES / total;
    for (let index = 0; index < nextFrames.length; index += 1) {
      nextFrames[index] = Math.max(
        MIN_SCENE_DURATION_FRAMES,
        Math.round(nextFrames[index] * scale),
      );
    }

    total = nextFrames.reduce((sum, duration) => sum + duration, 0);
  }

  while (total > MAX_DURATION_FRAMES) {
    let adjusted = false;

    for (let index = nextFrames.length - 1; index >= 0; index -= 1) {
      if (nextFrames[index] > MIN_SCENE_DURATION_FRAMES) {
        nextFrames[index] -= 1;
        total -= 1;
        adjusted = true;

        if (total <= MAX_DURATION_FRAMES) {
          break;
        }
      }
    }

    if (!adjusted) {
      break;
    }
  }

  return nextFrames;
};

export const toAssetRef = (asset: AssetRef & { file?: File; objectUrl?: string }): AssetRef => ({
  assetId: asset.assetId,
  kind: asset.kind,
  mimeType: asset.mimeType,
  name: asset.name,
  size: asset.size,
});

export const getAssetTooLargeMessage = (
  name: string,
  kind: AssetRef["kind"],
  size: number,
): string | null => {
  if (kind === "video" && size > MAX_VIDEO_FILE_BYTES) {
    return `Video ${name} exceeds 100MB.`;
  }

  if (kind === "image" && size > MAX_IMAGE_FILE_BYTES) {
    return `Image ${name} exceeds 10MB.`;
  }

  if (kind === "audio" && size > MAX_AUDIO_FILE_BYTES) {
    return `Audio ${name} exceeds 100MB.`;
  }

  return null;
};
