import type { AspectPreset } from "./types";

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
