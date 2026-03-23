import { FPS } from "@/lib/editor/constants";
import type { Clip } from "@/lib/editor/types";

export const MIN_BLOCK_WIDTH_PERCENT = 4;

export const framesToSeconds = (frames: number): number => {
  return Number((frames / FPS).toFixed(2));
};

export const secondsToFrames = (seconds: number): number => {
  return Math.max(1, Math.round(seconds * FPS));
};

export const parseNumber = (value: string, fallback: number): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const formatSeconds = (frames: number): string => {
  const seconds = frames / FPS;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
};

export const truncateLabel = (value: string, limit = 42): string => {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 1)}…`;
};

export const getTimelineBlockStyle = (
  startFrame: number,
  endFrame: number,
  totalFrames: number,
): React.CSSProperties => {
  const safeTotalFrames = Math.max(1, totalFrames);
  const safeStartFrame = Math.max(0, startFrame);
  const safeEndFrame = Math.max(safeStartFrame + 1, endFrame);
  const leftPercent = (safeStartFrame / safeTotalFrames) * 100;
  const naturalWidthPercent = ((safeEndFrame - safeStartFrame) / safeTotalFrames) * 100;
  const widthPercent = Math.max(
    Math.min(100 - leftPercent, naturalWidthPercent),
    Math.min(MIN_BLOCK_WIDTH_PERCENT, 100 - leftPercent),
  );

  return {
    left: `${leftPercent}%`,
    width: `${widthPercent}%`,
  };
};

export const getTickStepInSeconds = (totalFrames: number): number => {
  const totalSeconds = totalFrames / FPS;

  if (totalSeconds <= 12) {
    return 1;
  }

  if (totalSeconds <= 24) {
    return 2;
  }

  if (totalSeconds <= 45) {
    return 5;
  }

  return 10;
};

export const buildTicks = (totalFrames: number): number[] => {
  const stepFrames = getTickStepInSeconds(totalFrames) * FPS;
  const ticks: number[] = [];

  for (let frame = 0; frame <= totalFrames; frame += stepFrames) {
    ticks.push(frame);
  }

  if (ticks[ticks.length - 1] !== totalFrames) {
    ticks.push(totalFrames);
  }

  return ticks;
};

export const packLaneRows = <T,>(
  items: readonly T[],
  getStartFrame: (item: T) => number,
  getEndFrame: (item: T) => number,
): T[][] => {
  const rows: T[][] = [];
  const rowEndFrames: number[] = [];
  const sortedItems = [...items].sort((left, right) => {
    return getStartFrame(left) - getStartFrame(right);
  });

  for (const item of sortedItems) {
    const startFrame = Math.max(0, getStartFrame(item));
    const endFrame = Math.max(startFrame + 1, getEndFrame(item));
    let targetRow = rowEndFrames.findIndex((rowEndFrame) => startFrame >= rowEndFrame);

    if (targetRow === -1) {
      targetRow = rows.length;
      rows.push([]);
    }

    rows[targetRow].push(item);
  }

  return rows;
};

export const activateOnEnterOrSpace = (
  event: React.KeyboardEvent<HTMLElement>,
  callback: () => void,
): void => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    callback();
  }
};

export const getClipBlockClassName = (kind: Clip["kind"], selected: boolean): string => {
  const baseClassName =
    kind === "video"
      ? "border-sky-400/45 bg-sky-400/18 text-sky-50"
      : "border-amber-400/45 bg-amber-400/18 text-amber-50";

  return [
    "group absolute top-1/2 h-14 -translate-y-1/2 overflow-hidden rounded-xl border px-3 text-left transition",
    baseClassName,
    selected ? "ring-2 ring-cyan-300/80" : "hover:border-neutral-400",
  ].join(" ");
};

export const getTextBlockClassName = (selected: boolean): string => {
  return [
    "group absolute top-1/2 h-11 -translate-y-1/2 overflow-hidden rounded-lg border border-fuchsia-300/35 bg-fuchsia-300/14 px-3 text-left text-fuchsia-50 transition",
    selected ? "ring-2 ring-cyan-300/80" : "hover:border-fuchsia-200/55",
  ].join(" ");
};

export const getAudioBlockClassName = (selected: boolean): string => {
  return [
    "group absolute top-1/2 h-11 -translate-y-1/2 overflow-hidden rounded-lg border border-emerald-300/35 bg-emerald-300/14 px-3 text-left text-emerald-50 transition",
    selected ? "ring-2 ring-cyan-300/80" : "hover:border-emerald-200/55",
  ].join(" ");
};
