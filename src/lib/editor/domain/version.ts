import { FPS } from "../constants";
import { validateCaptionCues } from "../captions";
import { validateClipKeyframes } from "../keyframes";
import { validateTimeMapping } from "../time-mapping";
import { validateDuckingRules } from "../audio-ducking";
import type { VersionTimeline } from "../types";
import { normalizeAudioTracks, normalizeClips, normalizeTextOverlays } from "./normalization";
import { isTimelineWithinLimit, sanitizeTransitions } from "./render";
import {
  DEFAULT_AUDIO_TRACK_ID,
  DEFAULT_TEXT_TRACK_ID,
  DEFAULT_VIDEO_TRACK_ID,
  ensureEditorTracks,
} from "../tracks";

export interface VersionPlacementIssue {
  code: "INVALID_INTERVAL" | "DUPLICATE_ID" | "INVALID_TRACK" | "LANE_COLLISION" | "DURATION_LIMIT" | "INVALID_TRANSFORM" | "INVALID_VALUE" | "INVALID_KEYFRAMES" | "SOURCE_OUT_OF_RANGE" | "INVALID_CAPTION" | "INVALID_DUCKING" | "UNSUPPORTED_TRANSITION";
  entityId?: string;
  message: string;
}

export const validateVersionPlacement = (version: VersionTimeline): VersionPlacementIssue[] => {
  const issues: VersionPlacementIssue[] = [];
  const tracks = ensureEditorTracks(version);
  const trackKinds = new Map(tracks.map((track) => [track.id, track.kind]));
  const ids = new Set<string>();
  const checkId = (id: string) => {
    if (!id || ids.has(id)) issues.push({code: "DUPLICATE_ID", entityId: id, message: "IDs must be nonempty and unique."});
    ids.add(id);
  };
  for (const track of version.tracks ?? []) {
    checkId(track.id);
    if (!["video", "text", "audio", "caption"].includes(track.kind) || !Number.isInteger(track.order) || track.order < 0 || trackKinds.get(track.id) !== track.kind)
      issues.push({code: "INVALID_TRACK", entityId: track.id, message: "Invalid track kind or order."});
  }
  // Implicit legacy default lanes still own their IDs in canonical state.
  for (const track of tracks) ids.add(track.id);
  for (const [kind, items] of [["video", version.clips], ["text", version.textOverlays], ["audio", version.audioTracks]] as const) {
    for (const item of items) {
      checkId(item.id);
      if (!Number.isInteger(item.startFrame) || !Number.isInteger(item.endFrame) || item.startFrame < 0 || item.endFrame <= item.startFrame)
        issues.push({code: "INVALID_INTERVAL", entityId: item.id, message: "Placement must be a positive half-open integer frame interval."});
      if ("trimStartFrame" in item && (!Number.isInteger(item.trimStartFrame) || !Number.isInteger(item.trimEndFrame) || item.trimStartFrame < 0 || item.trimEndFrame <= item.trimStartFrame))
        issues.push({code: "INVALID_INTERVAL", entityId: item.id, message: "Source trim must be a positive integer frame interval."});
      if (item.trackId && trackKinds.get(item.trackId) !== kind)
        issues.push({code: "INVALID_TRACK", entityId: item.id, message: "Item must reference an existing compatible lane."});
    }
  }
  for (const clip of version.clips) {
    if (!Number.isFinite(clip.volume) || clip.volume < 0 || clip.volume > 1)
      issues.push({code: "INVALID_VALUE", entityId: clip.id, message: "Clip volume must be finite and between zero and one."});
    for (const message of validateClipKeyframes(clip.keyframes, clip.endFrame - clip.startFrame))
      issues.push({code: "INVALID_KEYFRAMES", entityId: clip.id, message});
    if (clip.kind === "video") {
      const duration = clip.endFrame - clip.startFrame;
      const sourceBound = clip.sourceDurationUs ?? clip.trimEndFrame / FPS * 1e6;
      for (const message of validateTimeMapping(clip.timeMapping, duration, clip.trimStartFrame, sourceBound, FPS))
        issues.push({code: "SOURCE_OUT_OF_RANGE", entityId: clip.id, message});
      if ((!clip.timeMapping || clip.timeMapping.kind === "normal") && duration > clip.trimEndFrame - clip.trimStartFrame)
        issues.push({code: "SOURCE_OUT_OF_RANGE", entityId: clip.id, message: "Normal playback duration exceeds its source trim range."});
    } else if (clip.timeMapping && clip.timeMapping.kind !== "normal")
      issues.push({code: "SOURCE_OUT_OF_RANGE", entityId: clip.id, message: "Time mapping is supported only for video clips."});
    const transform = clip.transform;
    if ((transform && (![transform.x, transform.y, transform.scale, transform.rotation, transform.anchor?.x, transform.anchor?.y].every(Number.isFinite) || transform.scale <= 0 || transform.anchor.x < 0 || transform.anchor.x > 1 || transform.anchor.y < 0 || transform.anchor.y > 1)) || (clip.opacity !== undefined && (!Number.isFinite(clip.opacity) || clip.opacity < 0 || clip.opacity > 1)))
      issues.push({code: "INVALID_TRANSFORM", entityId: clip.id, message: "Transform values must be finite, scale positive and opacity between zero and one."});
  }
  for (const cue of version.captionCues ?? []) {
    checkId(cue.id);
    if (trackKinds.get(cue.trackId) !== "caption") issues.push({code: "INVALID_TRACK", entityId: cue.id, message: "Caption cue must reference a caption lane."});
  }
  const captions = validateCaptionCues(version.captionCues ?? []);
  if (!captions.ok) for (const issue of captions.issues) issues.push({code: "INVALID_CAPTION", message: issue.message, entityId: issue.cueIndex === undefined ? undefined : version.captionCues?.[issue.cueIndex]?.id});
  for (const rule of version.duckingRules ?? []) checkId(rule.id);
  for (const message of validateDuckingRules(version)) issues.push({code: "INVALID_DUCKING", message});
  for (const transition of version.transitions) {
    checkId(transition.id);
    if (version.clips.some(clip => (clip.id === transition.fromClipId || clip.id === transition.toClipId) && clip.timeMapping && clip.timeMapping.kind !== "normal"))
      issues.push({code: "UNSUPPORTED_TRANSITION", entityId: transition.id, message: "Transitions on retimed clips are not supported."});
  }
  const lanes = new Map<string, VersionTimeline["clips"]>();
  for (const clip of version.clips) {
    const lane = clip.trackId ?? DEFAULT_VIDEO_TRACK_ID;
    lanes.set(lane, [...(lanes.get(lane) ?? []), clip]);
  }
  for (const clips of lanes.values()) {
    clips.sort((a, b) => a.startFrame - b.startFrame);
    let end = -1;
    for (const clip of clips) {
      if (clip.startFrame < end) issues.push({code: "LANE_COLLISION", entityId: clip.id, message: "Media clips may not overlap within a lane."});
      end = Math.max(end, clip.endFrame);
    }
  }
  if (!isTimelineWithinLimit(version)) issues.push({code: "DURATION_LIMIT", message: "Timeline exceeds the duration limit."});
  return issues;
};

export const sanitizeVersion = (
  version: VersionTimeline,
): VersionTimeline | null => {
  if (validateVersionPlacement(version).length > 0) return null;
  const tracks = ensureEditorTracks(version);
  const kindByTrackId = new Map(tracks.map((track) => [track.id, track.kind]));
  const clips = normalizeClips(version.clips).map((clip) => ({
    ...clip,
    trackId:
      clip.trackId && kindByTrackId.get(clip.trackId) === "video"
        ? clip.trackId
        : DEFAULT_VIDEO_TRACK_ID,
  }));
  const transitions = sanitizeTransitions(clips, version.transitions);
  const textOverlays = normalizeTextOverlays(version.textOverlays).map((overlay) => ({
    ...overlay,
    trackId:
      overlay.trackId && kindByTrackId.get(overlay.trackId) === "text"
        ? overlay.trackId
        : DEFAULT_TEXT_TRACK_ID,
  }));
  const audioTracks = normalizeAudioTracks(version.audioTracks).map((audio) => ({
    ...audio,
    trackId:
      audio.trackId && kindByTrackId.get(audio.trackId) === "audio"
        ? audio.trackId
        : DEFAULT_AUDIO_TRACK_ID,
  }));

  const normalized: VersionTimeline = {
    ...version,
    tracks,
    clips,
    transitions,
    textOverlays,
    audioTracks,
  };

  if (!isTimelineWithinLimit(normalized)) {
    return null;
  }

  return normalized;
};
