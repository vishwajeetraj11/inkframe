import type { VersionTimeline } from "../types";
import { normalizeAudioTracks, normalizeClips, normalizeTextOverlays } from "./normalization";
import { isTimelineWithinLimit, sanitizeTransitions } from "./render";

export const sanitizeVersion = (
  version: VersionTimeline,
): VersionTimeline | null => {
  const clips = normalizeClips(version.clips);
  const transitions = sanitizeTransitions(clips, version.transitions);
  const textOverlays = normalizeTextOverlays(version.textOverlays);
  const audioTracks = normalizeAudioTracks(version.audioTracks);

  const normalized: VersionTimeline = {
    ...version,
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
