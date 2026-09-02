import type { EditorTrack, EditorTrackKind, VersionTimeline } from "./types";

export const DEFAULT_VIDEO_TRACK_ID = "inkframe-video";
export const DEFAULT_TEXT_TRACK_ID = "inkframe-elements";
export const DEFAULT_AUDIO_TRACK_ID = "inkframe-audio";

const DEFAULT_TRACKS: readonly EditorTrack[] = [
  { id: DEFAULT_VIDEO_TRACK_ID, kind: "video", name: "Video", order: 0 },
  { id: DEFAULT_TEXT_TRACK_ID, kind: "text", name: "Text", order: 1 },
  { id: DEFAULT_AUDIO_TRACK_ID, kind: "audio", name: "Audio", order: 2 },
];

export const createDefaultEditorTracks = (): EditorTrack[] =>
  DEFAULT_TRACKS.map((track) => ({ ...track }));

export const defaultTrackIdForKind = (kind: EditorTrackKind): string =>
  kind === "video"
    ? DEFAULT_VIDEO_TRACK_ID
    : kind === "text"
      ? DEFAULT_TEXT_TRACK_ID
      : DEFAULT_AUDIO_TRACK_ID;

export const ensureEditorTracks = (
  version: Pick<VersionTimeline, "tracks">,
): EditorTrack[] => {
  const existing = version.tracks ?? [];
  const byId = new Map(existing.map((track) => [track.id, track]));
  const defaults = DEFAULT_TRACKS.map((fallback) => ({
    ...(byId.get(fallback.id) ?? fallback),
    id: fallback.id,
    kind: fallback.kind,
  }));
  const defaultIds = new Set(DEFAULT_TRACKS.map((track) => track.id));
  const custom = existing
    .filter((track) => !defaultIds.has(track.id))
    .map((track) => ({ ...track }));

  return [...defaults, ...custom]
    .sort((left, right) => left.order - right.order)
    .map((track, order) => ({ ...track, order }));
};

export const createEditorTrack = (
  id: string,
  kind: EditorTrackKind,
  existing: readonly EditorTrack[],
): EditorTrack => {
  const number = existing.filter((track) => track.kind === kind).length + 1;
  const label = kind[0].toUpperCase() + kind.slice(1);
  return {
    id,
    kind,
    name: `${label} ${number}`,
    order: existing.length,
  };
};
