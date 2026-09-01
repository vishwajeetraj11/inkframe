import type {
  AspectPreset,
  AudioTrack,
  Clip,
  ProjectSession,
  TextOverlay,
  Transition,
  VersionTimeline,
} from "./types";
import { sanitizeVersion } from "./timeline";

export type EditorAction =
  | { type: "switch-aspect"; aspect: AspectPreset }
  | { type: "replace-version"; aspect: AspectPreset; version: VersionTimeline }
  | { type: "add-clip"; aspect: AspectPreset; clip: Clip }
  | {
      type: "update-clip";
      aspect: AspectPreset;
      clipId: string;
      patch: Partial<Omit<Clip, "id" | "assetId" | "kind">>;
    }
  | { type: "remove-clip"; aspect: AspectPreset; clipId: string }
  | { type: "move-clip"; aspect: AspectPreset; clipId: string; offset: -1 | 1 }
  | {
      type: "set-transition";
      aspect: AspectPreset;
      transition: Transition;
    }
  | {
      type: "remove-transition";
      aspect: AspectPreset;
      fromClipId: string;
      toClipId: string;
    }
  | { type: "add-text-overlay"; aspect: AspectPreset; overlay: TextOverlay }
  | {
      type: "update-text-overlay";
      aspect: AspectPreset;
      overlayId: string;
      patch: Partial<Omit<TextOverlay, "id">>;
    }
  | { type: "remove-text-overlay"; aspect: AspectPreset; overlayId: string }
  | { type: "add-audio-track"; aspect: AspectPreset; track: AudioTrack }
  | {
      type: "update-audio-track";
      aspect: AspectPreset;
      trackId: string;
      patch: Partial<Omit<AudioTrack, "id" | "assetId">>;
    }
  | { type: "remove-audio-track"; aspect: AspectPreset; trackId: string };

const withUpdatedVersion = (
  state: ProjectSession,
  aspect: AspectPreset,
  mutate: (version: VersionTimeline) => VersionTimeline,
): ProjectSession => {
  const currentVersion = state.versions[aspect];
  const mutated = mutate(currentVersion);
  const sanitized = sanitizeVersion(mutated);

  if (!sanitized) {
    return state;
  }

  return {
    ...state,
    versions: {
      ...state.versions,
      [aspect]: sanitized,
    },
  };
};

const hasTimelineContent = (version: VersionTimeline): boolean =>
  version.clips.length > 0 ||
  version.textOverlays.length > 0 ||
  version.audioTracks.length > 0 ||
  version.transitions.length > 0;

const copyTimelineToAspect = (
  version: VersionTimeline,
  aspect: AspectPreset,
): VersionTimeline => ({
  aspect,
  clips: version.clips.map((clip) => ({ ...clip })),
  textOverlays: version.textOverlays.map((overlay) => ({ ...overlay })),
  audioTracks: version.audioTracks.map((track) => ({ ...track })),
  transitions: version.transitions.map((transition) => ({ ...transition })),
});

export const editorReducer = (
  state: ProjectSession,
  action: EditorAction,
): ProjectSession => {
  switch (action.type) {
    case "switch-aspect": {
      if (action.aspect === state.activeVersion) {
        return state;
      }

      const targetVersion = state.versions[action.aspect];
      const shouldInitializeTarget = !hasTimelineContent(targetVersion);

      return {
        ...state,
        activeVersion: action.aspect,
        versions: shouldInitializeTarget
          ? {
              ...state.versions,
              [action.aspect]: copyTimelineToAspect(
                state.versions[state.activeVersion],
                action.aspect,
              ),
            }
          : state.versions,
      };
    }
    case "replace-version": {
      return withUpdatedVersion(state, action.aspect, () => action.version);
    }
    case "add-clip": {
      return withUpdatedVersion(state, action.aspect, (version) => ({
        ...version,
        clips: [...version.clips, action.clip],
      }));
    }
    case "update-clip": {
      return withUpdatedVersion(state, action.aspect, (version) => ({
        ...version,
        clips: version.clips.map((clip) =>
          clip.id === action.clipId ? { ...clip, ...action.patch } : clip,
        ),
      }));
    }
    case "remove-clip": {
      return withUpdatedVersion(state, action.aspect, (version) => {
        const clips = version.clips.filter((clip) => clip.id !== action.clipId);
        const transitions = version.transitions.filter(
          (transition) =>
            transition.fromClipId !== action.clipId &&
            transition.toClipId !== action.clipId,
        );

        return {
          ...version,
          clips,
          transitions,
        };
      });
    }
    case "move-clip": {
      return withUpdatedVersion(state, action.aspect, (version) => {
        const currentIndex = version.clips.findIndex(
          (clip) => clip.id === action.clipId,
        );

        if (currentIndex === -1) {
          return version;
        }

        const nextIndex = currentIndex + action.offset;
        if (nextIndex < 0 || nextIndex >= version.clips.length) {
          return version;
        }

        const clips = [...version.clips];
        const [target] = clips.splice(currentIndex, 1);
        clips.splice(nextIndex, 0, target);

        return {
          ...version,
          clips,
        };
      });
    }
    case "set-transition": {
      return withUpdatedVersion(state, action.aspect, (version) => {
        const transitionsWithoutEdge = version.transitions.filter(
          (transition) =>
            !(
              transition.fromClipId === action.transition.fromClipId &&
              transition.toClipId === action.transition.toClipId
            ),
        );

        return {
          ...version,
          transitions: [...transitionsWithoutEdge, action.transition],
        };
      });
    }
    case "remove-transition": {
      return withUpdatedVersion(state, action.aspect, (version) => ({
        ...version,
        transitions: version.transitions.filter(
          (transition) =>
            !(
              transition.fromClipId === action.fromClipId &&
              transition.toClipId === action.toClipId
            ),
        ),
      }));
    }
    case "add-text-overlay": {
      return withUpdatedVersion(state, action.aspect, (version) => ({
        ...version,
        textOverlays: [...version.textOverlays, action.overlay],
      }));
    }
    case "update-text-overlay": {
      return withUpdatedVersion(state, action.aspect, (version) => ({
        ...version,
        textOverlays: version.textOverlays.map((overlay) =>
          overlay.id === action.overlayId
            ? {
                ...overlay,
                ...action.patch,
              }
            : overlay,
        ),
      }));
    }
    case "remove-text-overlay": {
      return withUpdatedVersion(state, action.aspect, (version) => ({
        ...version,
        textOverlays: version.textOverlays.filter(
          (overlay) => overlay.id !== action.overlayId,
        ),
      }));
    }
    case "add-audio-track": {
      return withUpdatedVersion(state, action.aspect, (version) => ({
        ...version,
        audioTracks: [...version.audioTracks, action.track],
      }));
    }
    case "update-audio-track": {
      return withUpdatedVersion(state, action.aspect, (version) => ({
        ...version,
        audioTracks: version.audioTracks.map((track) =>
          track.id === action.trackId ? { ...track, ...action.patch } : track,
        ),
      }));
    }
    case "remove-audio-track": {
      return withUpdatedVersion(state, action.aspect, (version) => ({
        ...version,
        audioTracks: version.audioTracks.filter(
          (track) => track.id !== action.trackId,
        ),
      }));
    }
    default: {
      return state;
    }
  }
};
