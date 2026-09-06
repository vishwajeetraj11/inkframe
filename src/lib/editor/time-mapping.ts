export interface SpeedPoint {
  frame: number;
  speed: number;
  interpolation: "linear" | "hold";
}
export type TimeMapping =
  | { kind: "normal" }
  | { kind: "hold"; sourceTimeUs: number }
  | { kind: "speed"; points: SpeedPoint[]; sourceStartTimeUs?: number };

import { evaluateTimeMap } from "./deterministic-runtime.mjs";
export const sourceTimeAtFrame = evaluateTimeMap;

export const validateTimeMapping = (
  mapping: TimeMapping | undefined,
  duration: number,
  trimStartFrame: number,
  sourceDurationUs?: number,
  fps = 30,
): string[] => {
  const issues: string[] = [];
  if (!Number.isInteger(duration) || duration <= 0 || !Number.isFinite(fps) || fps <= 0 || !Number.isInteger(trimStartFrame) || trimStartFrame < 0) issues.push("Invalid timeline/source timing.");
  if (mapping?.kind === "hold") {
    if (!Number.isFinite(mapping.sourceTimeUs) || mapping.sourceTimeUs < 0) issues.push("Invalid held source timestamp.");
  } else if (mapping?.kind === "speed") {
    if (!mapping.points.length) issues.push("A speed map requires control points.");
    if (mapping.sourceStartTimeUs !== undefined && (!Number.isFinite(mapping.sourceStartTimeUs) || mapping.sourceStartTimeUs < 0)) issues.push("Invalid source-time offset.");
    let previous = -1;
    for (const point of mapping.points) {
      if (!Number.isInteger(point.frame) || point.frame < 0 || point.frame > duration || point.frame <= previous) issues.push("Speed points must have unique increasing integer frames within the clip boundary.");
      if (!Number.isFinite(point.speed) || point.speed <= 0) issues.push("Speed must be finite and positive.");
      if (point.interpolation !== "linear" && point.interpolation !== "hold") issues.push("Invalid speed interpolation.");
      previous = point.frame;
    }
  } else if (mapping && mapping.kind !== "normal") issues.push("Unsupported time mapping.");
  if (sourceDurationUs !== undefined) {
    if (!Number.isFinite(sourceDurationUs) || sourceDurationUs <= 0) issues.push("Invalid source duration metadata.");
    else if (!issues.length) {
      const start = sourceTimeAtFrame(mapping, 0, trimStartFrame, fps);
      const end = sourceTimeAtFrame(mapping, duration, trimStartFrame, fps);
      if (start >= sourceDurationUs || end > sourceDurationUs + 1e-6) issues.push("Time mapping exceeds source duration.");
    }
  }
  return issues;
};

export const splitTimeMapping = (
  mapping: TimeMapping | undefined,
  splitFrame: number,
  duration: number,
  trimStartFrame: number,
  fps = 30,
): [TimeMapping, TimeMapping] => {
  if (!Number.isInteger(splitFrame) || splitFrame <= 0 || splitFrame >= duration || validateTimeMapping(mapping, duration, trimStartFrame, undefined, fps).length) throw new Error("Invalid time-map split.");
  if (mapping?.kind === "hold") return [{...mapping}, {...mapping}];
  const points: SpeedPoint[] = mapping?.kind === "speed" ? mapping.points : [{frame: 0, speed: 1, interpolation: "linear"}];
  let active = points[0];
  let speed = active.speed;
  for (let i = 0; i < points.length; i += 1) {
    if (points[i].frame <= splitFrame) active = points[i];
    const next = points[i + 1];
    if (splitFrame >= points[i].frame && (!next || splitFrame < next.frame)) {
      speed = next && active.interpolation === "linear" ? active.speed + (next.speed - active.speed) * (splitFrame - active.frame) / (next.frame - active.frame) : active.speed;
      break;
    }
  }
  const left: TimeMapping = {kind: "speed", sourceStartTimeUs: sourceTimeAtFrame(mapping, 0, trimStartFrame, fps), points: [...points.filter(point => point.frame < splitFrame).map(point => ({...point})), {...active, frame: splitFrame, speed}]};
  const right: TimeMapping = {kind: "speed", sourceStartTimeUs: sourceTimeAtFrame(mapping, splitFrame, trimStartFrame, fps), points: [{...active, frame: 0, speed}, ...points.filter(point => point.frame > splitFrame).map(point => ({...point, frame: point.frame - splitFrame}))]};
  return [left, right];
};
