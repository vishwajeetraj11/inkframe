import { TEXT_MOTION_ANIMATIONS } from "@/lib/text-motion/constants";
import type {
  TextMotionAnimation,
  TextMotionFontFamily,
  TextMotionFontStyle,
  TextMotionProject,
} from "@/lib/text-motion/types";
import { clampDuration } from "@/lib/text-motion/utils";

export const TEXT_MOTION_ANIMATION_OPTIONS: TextMotionAnimation[] = [
  ...TEXT_MOTION_ANIMATIONS,
];
export const TEXT_MOTION_FONT_FAMILY_OPTIONS: TextMotionFontFamily[] = [
  "sans",
  "serif",
  "mono",
  "display",
  "condensed",
  "slab",
  "modern",
];
export const TEXT_MOTION_FONT_STYLE_OPTIONS: TextMotionFontStyle[] = [
  "normal",
  "italic",
];

export const framesToSeconds = (frames: number): string => (frames / 30).toFixed(1);
export const secondsToFrames = (seconds: number): number => clampDuration(seconds * 30);
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);
export const templateLabel = (template: TextMotionProject["template"]): string =>
  template === "grid-kinetic"
    ? "Grid Kinetic"
    : template === "photo-card"
      ? "Photo Card"
      : "Default";
