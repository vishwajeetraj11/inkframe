import type { VersionTimeline } from "../types";
import { normalizeAudioTracks, normalizeClips, normalizeTextOverlays } from "./normalization";
import { isTimelineWithinLimit, sanitizeTransitions } from "./render";
import {
  DEFAULT_AUDIO_TRACK_ID,
  DEFAULT_TEXT_TRACK_ID,
  DEFAULT_VIDEO_TRACK_ID,
  ensureEditorTracks,
} from "../tracks";

export const sanitizeVersion = (
  version: VersionTimeline,
): VersionTimeline | null => {
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
