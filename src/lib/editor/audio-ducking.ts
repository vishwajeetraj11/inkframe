import { FPS } from "./constants";
import type { VersionTimeline } from "./types";
export interface AudioItemRef { kind: "audio" | "video"; id: string }
export interface AudioDuckingRule {
  id: string;
  target: AudioItemRef;
  triggers: AudioItemRef[];
  attenuationDb: number;
  attackFrames: number;
  releaseFrames: number;
}
export interface GainPoint { frame: number; value: number }
const itemFor = (version: VersionTimeline, ref: AudioItemRef) => ref.kind === "audio"
  ? version.audioTracks.find(item => item.id === ref.id)
  : version.clips.find(item => item.id === ref.id && item.kind === "video");
export const validateDuckingRules = (version: VersionTimeline): string[] => {
  const issues: string[] = []; const ids = new Set<string>();
  for (const rule of version.duckingRules ?? []) {
    if (!rule.id || ids.has(rule.id)) issues.push("Ducking rule IDs must be unique.");
    ids.add(rule.id);
    if (!itemFor(version, rule.target) || !rule.triggers.length || rule.triggers.some(ref => !itemFor(version, ref))) issues.push("Ducking needs an existing target and narration source.");
    if (rule.triggers.some(ref => ref.id === rule.target.id && ref.kind === rule.target.kind)) issues.push("An audio item cannot duck itself.");
    if (!Number.isFinite(rule.attenuationDb) || rule.attenuationDb < -60 || rule.attenuationDb > 0 || !Number.isInteger(rule.attackFrames) || !Number.isInteger(rule.releaseFrames) || rule.attackFrames < 0 || rule.releaseFrames < 0 || rule.attackFrames > FPS * 60 || rule.releaseFrames > FPS * 60) issues.push("Invalid ducking attenuation or envelope timing.");
  }
  return issues;
};
/** Output-frame control points; renderer interpolates the same values for live and offline audio. */
export const buildDuckingEnvelope = (version: VersionTimeline, target: AudioItemRef): GainPoint[] | undefined => {
  const item = itemFor(version, target); if (!item) return undefined;
  const rules = (version.duckingRules ?? []).filter(rule => rule.target.kind === target.kind && rule.target.id === target.id);
  if (!rules.length) return undefined;
  const envelopes = rules.map(rule => {
    const intervals = rule.triggers.flatMap(ref => {
      const trigger = itemFor(version, ref);
      if (!trigger || trigger.volume === 0 || ("muted" in trigger && trigger.muted) || ("timeMapping" in trigger && trigger.timeMapping && trigger.timeMapping.kind !== "normal")) return [];
      return [{start: trigger.startFrame, end: trigger.endFrame}];
    }).sort((a,b) => a.start-b.start);
    const merged: typeof intervals = [];
    for (const interval of intervals) {
      const prev = merged.at(-1);
      if (prev && interval.start <= prev.end) prev.end = Math.max(prev.end,interval.end);
      else merged.push({...interval});
    }
    return {rule, intervals:merged};
  });
  const duration = item.endFrame - item.startFrame;
  const ramps = envelopes.flatMap(({ rule, intervals }) => intervals.map(interval => ({
    ...interval, attack: rule.attackFrames, release: rule.releaseFrames,
    floor: 10 ** (rule.attenuationDb / 20),
  })));
  const gainAt = (ramp: typeof ramps[number], frame: number, left = false): number => {
    const { start, end, attack, release, floor } = ramp;
    if (frame < start || (left && frame === start)) {
      return attack ? 1 - (1 - floor) * Math.max(0, 1 - (start - frame) / attack) : 1;
    }
    if (frame < end || (left && frame === end)) return floor;
    return release ? floor + (1 - floor) * Math.min(1, (frame - end) / release) : 1;
  };
  const breakpoints = new Set([item.startFrame, item.endFrame]);
  for (const ramp of ramps) {
    for (const frame of [ramp.start - ramp.attack, ramp.start, ramp.end, ramp.end + ramp.release]) {
      if (frame > item.startFrame && frame < item.endFrame) breakpoints.add(frame);
    }
  }
  const boundaries = [...breakpoints].sort((a, b) => a - b);
  // The strongest of linear ramps can change between frame boundaries. Include
  // their intersections so sample-level evaluation does not soften that minimum.
  for (let i = 1; i < boundaries.length; i++) {
    const start = boundaries[i - 1], end = boundaries[i];
    const lines = ramps.map(ramp => ({ start: gainAt(ramp, start), end: gainAt(ramp, end, true) }));
    for (let a = 0; a < lines.length; a++) for (let b = a + 1; b < lines.length; b++) {
      const differenceStart = lines[a].start - lines[b].start;
      const differenceEnd = lines[a].end - lines[b].end;
      if (differenceStart * differenceEnd < 0) {
        breakpoints.add(start + (end - start) * differenceStart / (differenceStart - differenceEnd));
      }
    }
  }
  const points: GainPoint[] = [];
  for (const absolute of [...breakpoints].sort((a, b) => a - b)) {
    const frame = absolute - item.startFrame;
    const left = Math.min(1, ...ramps.map(ramp => gainAt(ramp, absolute, true)));
    const right = Math.min(1, ...ramps.map(ramp => gainAt(ramp, absolute)));
    // Duplicate timestamps describe an exact jump: the evaluator uses the last
    // value at that timestamp and approaches the first value from the left.
    if (frame > 0 && left !== right) points.push({ frame, value: left });
    points.push({ frame, value: right });
  }
  return duration > 0 ? points : undefined;
};
