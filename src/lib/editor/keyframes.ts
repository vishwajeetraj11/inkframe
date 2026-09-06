/** Clip-local output-frame animation. Interpolation belongs to the outgoing point. */
export type KeyframeProperty = "x" | "y" | "scale" | "rotation" | "opacity";
export interface ScalarKeyframe {
  id: string;
  frame: number;
  value: number;
  interpolation: "linear" | "hold";
}
export type ClipKeyframes = Partial<Record<KeyframeProperty, ScalarKeyframe[]>>;

import { evaluateChannel } from "./deterministic-runtime.mjs";
export const evaluateKeyframeChannel = evaluateChannel;

export const validateClipKeyframes = (channels: ClipKeyframes | undefined, duration: number): string[] => {
  const issues: string[] = [];
  if (!Number.isInteger(duration) || duration <= 0) issues.push("Invalid clip duration.");
  const ids = new Set<string>();
  for (const [property, points] of Object.entries(channels ?? {})) {
    if (!["x", "y", "scale", "rotation", "opacity"].includes(property)) issues.push(`Unsupported keyframe property: ${property}`);
    let previous = -1;
    for (const point of points ?? []) {
      if (!point.id || ids.has(point.id)) issues.push("Keyframe IDs must be nonempty and unique.");
      ids.add(point.id);
      if (!Number.isInteger(point.frame) || point.frame < 0 || point.frame > duration || point.frame <= previous) issues.push("Keyframes must be ordered, unique integer frames within the clip boundary.");
      if (!Number.isFinite(point.value) || (property === "scale" && point.value <= 0) || (property === "opacity" && (point.value < 0 || point.value > 1))) issues.push("Invalid keyframe value.");
      if (point.interpolation !== "linear" && point.interpolation !== "hold") issues.push("Invalid keyframe interpolation.");
      previous = point.frame;
    }
  }
  return issues;
};

/** Boundary controls may lie at duration, outside the rendered half-open interval. */
export const splitClipKeyframes = (channels: ClipKeyframes | undefined, splitFrame: number, duration: number): [ClipKeyframes, ClipKeyframes] => {
  if (!Number.isInteger(splitFrame) || splitFrame <= 0 || splitFrame >= duration || validateClipKeyframes(channels, duration).length) throw new Error("Invalid keyframe split.");
  const left: ClipKeyframes = {};
  const right: ClipKeyframes = {};
  const ids = new Set(Object.values(channels ?? {}).flatMap(points => points.map(point => point.id)));
  const boundaryId = (base: string) => {
    let id = base;
    while (ids.has(id)) id += ":boundary";
    ids.add(id);
    return id;
  };
  for (const [property, points] of Object.entries(channels ?? {}) as [KeyframeProperty, ScalarKeyframe[]][]) {
    if (!points.length) continue;
    const value = evaluateKeyframeChannel(points, splitFrame, 0);
    const active = [...points].reverse().find(point => point.frame <= splitFrame) ?? points[0];
    const boundary = points.find(point => point.frame === splitFrame);
    // Namespace generated IDs by side and split to preserve deterministic unique identities.
    left[property] = [...points.filter(point => point.frame < splitFrame).map(point => ({...point})), {...(boundary ?? active), id: boundaryId(`${active.id}:split:${splitFrame}:left`), frame: splitFrame, value}];
    right[property] = [{...(boundary ?? active), id: boundaryId(`${active.id}:split:${splitFrame}:right`), frame: 0, value}, ...points.filter(point => point.frame > splitFrame).map(point => ({...point, frame: point.frame - splitFrame}))];
  }
  return [left, right];
};
