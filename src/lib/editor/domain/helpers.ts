import { FPS } from "../constants";
import type {
  Clip,
  CreatedaleyOpenerTexture,
  TextOverlayFontFamily,
  TextOverlayFontStyle,
  TextOverlayStylePreset,
} from "../types";

export const NEWS_CLIPPING_ANIMATION_FRAMES = FPS * 5;
export const NEWS_CLIPPING_READ_HOLD_FRAMES = FPS * 3;
export const NEWS_CLIPPING_MIN_DURATION_FRAMES =
  NEWS_CLIPPING_ANIMATION_FRAMES + NEWS_CLIPPING_READ_HOLD_FRAMES;
export const CREATEDALEY_OPENER_MIN_DURATION_FRAMES = Math.round(FPS * 4.5);
export const EDITORIAL_STAT_RING_MIN_DURATION_FRAMES = Math.round(FPS * 5.35);
export const VOX_TIMELINE_MIN_DURATION_FRAMES = FPS * 7;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);

export const toSafeInt = (value: number, fallback: number): number => {
  const normalized = Number.isFinite(value) ? value : fallback;
  return Math.round(normalized);
};

export const getClipDurationInFrames = (clip: Clip): number =>
  Math.max(1, toSafeInt(clip.endFrame - clip.startFrame, 1));

export const normalizeTextOverlayFontFamily = (
  value: unknown,
): TextOverlayFontFamily => {
  if (value === "serif" || value === "cursive" || value === "mono") {
    return value;
  }

  return "sans";
};

export const normalizeTextOverlayFontStyle = (
  value: unknown,
): TextOverlayFontStyle => (value === "italic" ? "italic" : "normal");

export const normalizeTextOverlayFontWeight = (value: unknown): number => {
  const numeric = typeof value === "number" ? value : 700;
  const roundedTo100 = Math.round(numeric / 100) * 100;
  return clamp(roundedTo100, 100, 900);
};

export const normalizeCreatedaleyTexture = (
  value: unknown,
): CreatedaleyOpenerTexture => {
  if (
    value === "dots" ||
    value === "grid-dots" ||
    value === "newsprint-grain" ||
    value === "warm-editorial"
  ) {
    return value;
  }

  return "plain";
};

export const normalizeTextOverlayStylePreset = (
  value: unknown,
): TextOverlayStylePreset => {
  if (
    value === "impact-grid" ||
    value === "grid-kinetic" ||
    value === "hero-slam" ||
    value === "sticker-cutout" ||
    value === "editorial-mono" ||
    value === "vox-explainer" ||
    value === "vox-timeline" ||
    value === "vox-timeline-ribbon" ||
    value === "vox-timeline-ledger" ||
    value === "vox-typography" ||
    value === "world-map-focus" ||
    value === "editorial-bar-chart" ||
    value === "editorial-stat-ring" ||
    value === "editorial-seat-arc" ||
    value === "createdaley-opener" ||
    value === "chart-card" ||
    value === "news-clipping"
  ) {
    return value;
  }

  return "classic";
};
