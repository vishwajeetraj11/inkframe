import { FPS } from "../constants";
import type {
  Clip,
  CreatedaleyOpenerTexture,
  TextOverlayFontFamily,
  TextOverlayFontStyle,
  TextOverlayStylePreset,
} from "../types";
import {
  TEXT_OVERLAY_FONT_FAMILIES,
  TEXT_OVERLAY_FONT_STYLES,
  TEXT_OVERLAY_STYLE_PRESETS,
  CREATEDALEY_OPENER_TEXTURES,
} from "../types";

export const NEWS_CLIPPING_ANIMATION_FRAMES = FPS * 5;
export const NEWS_CLIPPING_READ_HOLD_FRAMES = FPS * 3;
export const NEWS_CLIPPING_MIN_DURATION_FRAMES =
  NEWS_CLIPPING_ANIMATION_FRAMES + NEWS_CLIPPING_READ_HOLD_FRAMES;
export const CREATEDALEY_OPENER_MIN_DURATION_FRAMES = Math.round(FPS * 4.5);
export const EDITORIAL_STAT_RING_MIN_DURATION_FRAMES = Math.round(FPS * 5.35);
export const VOX_TIMELINE_MIN_DURATION_FRAMES = FPS * 7;
export const REGIONAL_MAP_FOCUS_MIN_DURATION_FRAMES = FPS * 7;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);

/** Generic enum validator factory: validates unknown value against a set of valid values */
export const createEnumValidator =
  <T extends readonly unknown[]>(validValues: T, defaultValue: T[number]) =>
  (value: unknown): T[number] => {
    if (validValues.includes(value as T[number])) {
      return value as T[number];
    }
    return defaultValue;
  };

export const toSafeInt = (value: number, fallback: number): number => {
  const normalized = Number.isFinite(value) ? value : fallback;
  return Math.round(normalized);
};

export const getClipDurationInFrames = (clip: Clip): number =>
  Math.max(1, toSafeInt(clip.endFrame - clip.startFrame, 1));

export const normalizeTextOverlayFontFamily = createEnumValidator(
  TEXT_OVERLAY_FONT_FAMILIES,
  "sans",
);

export const normalizeTextOverlayFontStyle = createEnumValidator(
  TEXT_OVERLAY_FONT_STYLES,
  "normal",
);

export const normalizeTextOverlayFontWeight = (value: unknown): number => {
  const numeric = typeof value === "number" ? value : 700;
  const roundedTo100 = Math.round(numeric / 100) * 100;
  return clamp(roundedTo100, 100, 900);
};

export const normalizeCreatedaleyTexture = createEnumValidator(
  CREATEDALEY_OPENER_TEXTURES,
  "plain",
);

export const normalizeTextOverlayStylePreset = createEnumValidator(
  TEXT_OVERLAY_STYLE_PRESETS,
  "classic",
);
