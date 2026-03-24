import type { AspectPreset, TextOverlayStylePreset } from "./types";

export const FPS = 30;
export const MAX_DURATION_SECONDS = 60;
export const MAX_DURATION_FRAMES = FPS * MAX_DURATION_SECONDS;

export const DEFAULT_CLIP_DURATION_SECONDS = 3;
export const DEFAULT_CLIP_DURATION_FRAMES = DEFAULT_CLIP_DURATION_SECONDS * FPS;
export const DEFAULT_TRANSITION_FRAMES = Math.round(FPS * 0.5);

export const MAX_VIDEO_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_FILE_BYTES = 100 * 1024 * 1024;

export const ASPECT_PRESETS: Record<
  AspectPreset,
  {
    label: string;
    width: number;
    height: number;
    fps: number;
    maxDurationFrames: number;
    maxDurationSeconds: number;
  }
> = {
  reel_9_16: {
    label: "Reel 9:16",
    width: 1080,
    height: 1920,
    fps: FPS,
    maxDurationFrames: MAX_DURATION_FRAMES,
    maxDurationSeconds: MAX_DURATION_SECONDS,
  },
  widescreen_16_9: {
    label: "Widescreen 16:9",
    width: 1920,
    height: 1080,
    fps: FPS,
    maxDurationFrames: MAX_DURATION_FRAMES,
    maxDurationSeconds: MAX_DURATION_SECONDS,
  },
};

// Preset-specific duration constraints (imported from helpers)
// These are re-exported here for cleaner circular dependency handling
export const PRESET_MIN_DURATIONS_FRAMES: Record<TextOverlayStylePreset, number> = {
  "classic": 1,
  "impact-grid": 1,
  "grid-kinetic": 1,
  "hero-slam": 1,
  "sticker-cutout": 1,
  "editorial-mono": 1,
  "vox-explainer": 1,
  "vox-typography": 1,
  "world-map-focus": 1,
  "film-frame-gallery": 1,
  "editorial-bar-chart": 1,
  "createdaley-opener": Math.round(FPS * 4.5),
  "news-clipping": FPS * 5 + FPS * 3, // animation + hold
  "editorial-stat-ring": Math.round(FPS * 5.35),
  "vox-timeline": FPS * 7,
  "vox-timeline-ribbon": FPS * 7,
  "vox-timeline-ledger": FPS * 7,
  "regional-map-focus": FPS * 7,
  "chart-card": 1,
  "editorial-seat-arc": 1,
};
