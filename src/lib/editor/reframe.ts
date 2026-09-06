import type { ClipTransform } from "./types";

/** A normalized point in the source media. */
export interface ReframeFocusPoint {
  x: number;
  y: number;
}

export interface ReframeRequest {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  /** The source point that should appear at the center of the finished frame. */
  focus?: ReframeFocusPoint;
}

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Produces an Elah-compatible transform which covers the target frame and
 * centers a chosen source point. It is deliberately static: the browser does
 * not promise face tracking, so editors retain precise control of the frame.
 */
export const buildReframeTransform = ({
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
  focus = { x: 0.5, y: 0.5 },
}: ReframeRequest): ClipTransform | undefined => {
  if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every(
    (dimension) => Number.isFinite(dimension) && dimension > 0,
  )) return undefined;

  return {
    x: 0.5,
    y: 0.5,
    // Elah scales media from native source pixels. The larger ratio guarantees
    // that no empty edge is exposed in either preview or export.
    scale: Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight),
    rotation: 0,
    anchor: { x: clampUnit(focus.x), y: clampUnit(focus.y) },
  };
};

export const REFRAME_FOCUS_PRESETS = {
  left: { x: 0.25, y: 0.5 },
  center: { x: 0.5, y: 0.5 },
  right: { x: 0.75, y: 0.5 },
  top: { x: 0.5, y: 0.28 },
  bottom: { x: 0.5, y: 0.72 },
} as const satisfies Record<string, ReframeFocusPoint>;
