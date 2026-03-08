import { FPS, MAX_DURATION_FRAMES } from "../editor/constants";

export const TEXT_MOTION_FPS = FPS;
export const MIN_SCENE_DURATION_FRAMES = FPS;
export const MAX_SCENE_DURATION_FRAMES = FPS * 12;
export const MAX_TEXT_MOTION_DURATION_FRAMES = MAX_DURATION_FRAMES;

export const TEXT_MOTION_ANIMATIONS = [
  "slide-up",
  "slide-left",
  "slide-right",
  "pop",
  "bounce",
  "zoom-spin",
  "glitch",
  "wipe",
  "typewriter",
  "fade",
] as const;
