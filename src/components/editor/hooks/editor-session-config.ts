import type { AssetRef, AspectPreset, VersionTimeline } from "@/lib/editor/types";
import { FPS, MAX_AUDIO_FILE_BYTES, MAX_DURATION_FRAMES, MAX_IMAGE_FILE_BYTES, MAX_VIDEO_FILE_BYTES } from "@/lib/editor/constants";

export const MIN_SCENE_DURATION_FRAMES = FPS;
export const MAX_SCENE_DURATION_FRAMES = FPS * 20;
export const ALL_ASPECTS: AspectPreset[] = ["reel_9_16", "widescreen_16_9"];

export const DEFAULT_TEXT_OVERLAY_STYLE: {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: VersionTimeline["textOverlays"][number]["fontFamily"];
  fontWeight: number;
  fontStyle: VersionTimeline["textOverlays"][number]["fontStyle"];
} = {
  x: 50,
  y: 70,
  fontSize: 74,
  color: "#f8fafc",
  fontFamily: "serif",
  fontWeight: 700,
  fontStyle: "normal",
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

export const toAssetRef = (
  asset: AssetRef & { file?: File; objectUrl?: string },
): AssetRef => ({
  assetId: asset.assetId,
  kind: asset.kind,
  mimeType: asset.mimeType,
  name: asset.name,
  size: asset.size,
  externalUrl: asset.externalUrl,
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
