import { splitClipKeyframes } from "./keyframes";
import { splitTimeMapping } from "./time-mapping";
import { sanitizeTransitions } from "./timeline";
import type { AudioDuckingRule } from "./audio-ducking";
import type { ProjectCutdown, VersionTimeline } from "./types";

const clipToDuration = (clip: VersionTimeline["clips"][number], durationFrames: number) => {
  if (clip.startFrame >= durationFrames) return null;
  if (clip.endFrame <= durationFrames) return structuredClone(clip);
  const nextDuration = durationFrames - clip.startFrame;
  const originalDuration = clip.endFrame - clip.startFrame;
  const mapped = clip.timeMapping && clip.timeMapping.kind !== "normal";
  return {
    ...structuredClone(clip),
    endFrame: durationFrames,
    trimEndFrame: mapped ? clip.trimEndFrame : clip.trimStartFrame + nextDuration,
    keyframes: splitClipKeyframes(clip.keyframes, nextDuration, originalDuration)[0],
    timeMapping: mapped
      ? splitTimeMapping(clip.timeMapping!, nextDuration, originalDuration, clip.trimStartFrame)[0]
      : clip.timeMapping,
  };
};

const clampTimedItem = <T extends { startFrame: number; endFrame: number }>(
  item: T,
  durationFrames: number,
): T | null => item.startFrame >= durationFrames
  ? null
  : { ...structuredClone(item), endFrame: Math.min(item.endFrame, durationFrames) };

const keepValidDucking = (
  rules: AudioDuckingRule[] | undefined,
  timeline: Pick<VersionTimeline, "clips" | "audioTracks">,
) => {
  if (!rules) return undefined;
  const videos = new Set(timeline.clips.filter((clip) => clip.kind === "video").map((clip) => clip.id));
  const audio = new Set(timeline.audioTracks.map((track) => track.id));
  const exists = (ref: AudioDuckingRule["target"]) => ref.kind === "video" ? videos.has(ref.id) : audio.has(ref.id);
  return rules.flatMap((rule) => {
    if (!exists(rule.target)) return [];
    const triggers = rule.triggers.filter(exists);
    return triggers.length ? [{ ...structuredClone(rule), triggers }] : [];
  });
};

/** Create an independent, beginning-anchored edit while retaining source trims and transforms. */
export const createCutdown = (
  source: VersionTimeline,
  input: { id: string; name: string; durationFrames: number },
): ProjectCutdown | null => {
  if (!input.id.trim() || !input.name.trim() || !Number.isInteger(input.durationFrames) || input.durationFrames < 1) return null;
  const clips = source.clips.map((clip) => clipToDuration(clip, input.durationFrames)).filter((clip): clip is NonNullable<typeof clip> => clip !== null);
  const textOverlays = source.textOverlays.map((item) => clampTimedItem(item, input.durationFrames)).filter((item): item is NonNullable<typeof item> => item !== null);
  const audioTracks = source.audioTracks.map((item) => {
    const clamped = clampTimedItem(item, input.durationFrames);
    if (!clamped) return null;
    const duration = clamped.endFrame - clamped.startFrame;
    return {
      ...clamped,
      trimEndFrame: Math.min(clamped.trimEndFrame, clamped.trimStartFrame + duration),
      fadeInFrames: Math.min(clamped.fadeInFrames ?? 0, duration),
      fadeOutFrames: Math.min(clamped.fadeOutFrames ?? 0, duration),
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);
  const captionCues = source.captionCues?.map((item) => clampTimedItem(item, input.durationFrames)).filter((item): item is NonNullable<typeof item> => item !== null);
  const timeline: VersionTimeline = {
    ...structuredClone(source),
    clips,
    textOverlays,
    audioTracks,
    captionCues,
    transitions: sanitizeTransitions(clips, source.transitions),
  };
  timeline.duckingRules = keepValidDucking(source.duckingRules, timeline);
  return {
    id: input.id,
    name: input.name.trim(),
    sourceAspect: source.aspect,
    durationFrames: input.durationFrames,
    timeline,
  };
};

export const getActiveTimeline = (project: { activeVersion: ProjectCutdown["sourceAspect"]; activeCutdownId?: string; versions: Record<ProjectCutdown["sourceAspect"], VersionTimeline>; cutdowns?: ProjectCutdown[] }) =>
  project.cutdowns?.find((item) => item.id === project.activeCutdownId)?.timeline ?? project.versions[project.activeVersion];
