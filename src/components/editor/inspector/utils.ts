import { FPS } from "@/lib/editor/constants";

export const framesToSeconds = (frames: number): number => Number((frames / FPS).toFixed(2));
export const secondsToFrames = (seconds: number): number => Math.max(1, Math.round(seconds * FPS));
export const parseNumber = (value: string, fallback: number): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
