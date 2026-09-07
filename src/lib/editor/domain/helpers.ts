import type { Clip } from "../types";
import {
  TEXT_OVERLAY_FONT_FAMILIES,
  TEXT_OVERLAY_FONT_STYLES,
} from "../types";

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
