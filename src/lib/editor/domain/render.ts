import { MAX_DURATION_FRAMES } from "../constants";
import type { Clip, Transition, VersionTimeline } from "../types";
import { clamp, getClipDurationInFrames, toSafeInt } from "./helpers";
import { DEFAULT_VIDEO_TRACK_ID } from "../tracks";

export type TransitionKind = NonNullable<Transition["kind"]>;
export type TransitionDirection = NonNullable<Transition["direction"]>;
export type TransitionEasing = NonNullable<Transition["easing"]>;

export const getTransitionKind = (transition: Transition): TransitionKind =>
  transition.kind ?? (transition.type === "crossfade" ? "fade" : "fade");

export const normalizeTransition = (
  transition: Transition,
  maxDuration: number,
): Transition => {
  const kind = getTransitionKind(transition);
  const direction = transition.direction ?? (kind === "fade" ? undefined : "right");

  return {
    ...transition,
    kind,
    easing: transition.easing ?? "linear",
    ...(direction ? { direction } : {}),
    durationInFrames: clamp(
      toSafeInt(transition.durationInFrames, 1),
      1,
      maxDuration,
    ),
  };
};

export const sanitizeTransitions = (
  clips: Clip[],
  transitions: Transition[],
): Transition[] => {
  const clipIndexById = new Map(clips.map((clip, index) => [clip.id, index]));
  const uniqueByEdge = new Set<string>();
  const sanitized: Transition[] = [];

  for (const transition of transitions) {
    const fromIndex = clipIndexById.get(transition.fromClipId);
    const toIndex = clipIndexById.get(transition.toClipId);

    if (fromIndex === undefined || toIndex === undefined) {
      continue;
    }

    if ((clips[fromIndex].trackId ?? DEFAULT_VIDEO_TRACK_ID) !== (clips[toIndex].trackId ?? DEFAULT_VIDEO_TRACK_ID) || clips[fromIndex].endFrame !== clips[toIndex].startFrame) {
      continue;
    }

    const fromClipDuration = getClipDurationInFrames(clips[fromIndex]);
    const toClipDuration = getClipDurationInFrames(clips[toIndex]);
    const maxDuration = Math.max(0, Math.min(fromClipDuration - 1, toClipDuration - 1));

    if (maxDuration === 0) {
      continue;
    }

    const edgeKey = `${transition.fromClipId}:${transition.toClipId}`;
    if (uniqueByEdge.has(edgeKey)) {
      continue;
    }

    uniqueByEdge.add(edgeKey);
    sanitized.push(normalizeTransition(transition, maxDuration));
  }

  return sanitized;
};

export const getTransitionBetween = (
  transitions: Transition[],
  fromClipId: string,
  toClipId: string,
): Transition | undefined =>
  transitions.find(
    (transition) =>
      transition.fromClipId === fromClipId && transition.toClipId === toClipId,
  );

export const getTimelineDurationInFrames = (version: VersionTimeline): number => {
  return Math.max(0, ...version.clips.map((item) => item.endFrame),
    ...version.textOverlays.map((item) => item.endFrame),
    ...version.audioTracks.map((item) => item.endFrame),
    ...(version.captionCues ?? []).map((item) => item.endFrame));
};

export const isTimelineWithinLimit = (version: VersionTimeline): boolean =>
  getTimelineDurationInFrames(version) <= MAX_DURATION_FRAMES;

export interface RenderTrackEntry {
  clip: Clip;
  startFrame: number;
  durationInFrames: number;
  fadeInFrames: number;
  fadeOutFrames: number;
}

export interface RenderTrack {
  entries: RenderTrackEntry[];
  durationInFrames: number;
}

export const buildRenderTrack = (version: VersionTimeline): RenderTrack => {
  const clips = version.clips;
  const transitions = sanitizeTransitions(clips, version.transitions);

  const fadeInByClipId = new Map<string, number>();
  const fadeOutByClipId = new Map<string, number>();

  for (const transition of transitions) {
    fadeInByClipId.set(transition.toClipId, transition.durationInFrames);
    fadeOutByClipId.set(transition.fromClipId, transition.durationInFrames);
  }

  const entries: RenderTrackEntry[] = [];

  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index];
    const durationInFrames = getClipDurationInFrames(clip);
    const fadeInFrames = Math.max(0, toSafeInt(fadeInByClipId.get(clip.id) ?? 0, 0));
    const fadeOutFrames = Math.max(0, toSafeInt(fadeOutByClipId.get(clip.id) ?? 0, 0));
    const startFrame = clip.startFrame;

    entries.push({
      clip,
      startFrame,
      durationInFrames,
      fadeInFrames,
      fadeOutFrames,
    });
  }

  return {
    entries,
    durationInFrames: Math.max(1, ...clips.map((clip) => clip.endFrame)),
  };
};

export const getVersionRenderDurationInFrames = (
  version: VersionTimeline,
): number => {
  const trackDuration = buildRenderTrack(version).durationInFrames;

  const maxTextEndFrame = version.textOverlays.reduce(
    (maxEndFrame, overlay) =>
      Math.max(maxEndFrame, Math.max(1, toSafeInt(overlay.endFrame, 1))),
    0,
  );

  const maxAudioEndFrame = version.audioTracks.reduce(
    (maxEndFrame, track) =>
      Math.max(maxEndFrame, Math.max(1, toSafeInt(track.endFrame, 1))),
    0,
  );

  return Math.max(1, trackDuration, maxTextEndFrame, maxAudioEndFrame, ...(version.captionCues ?? []).map(cue => cue.endFrame));
};
