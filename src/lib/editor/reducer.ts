import type {
  AspectPreset,
  AudioTrack,
  Clip,
  EditorTrack,
  ProjectSession,
  TextOverlay,
  Transition,
  VersionTimeline,
} from "./types";
import { sanitizeVersion } from "./timeline";

export type EditorAction =
  | { type: "switch-aspect"; aspect: AspectPreset }
  | { type: "replace-version"; aspect: AspectPreset; version: VersionTimeline }
  | { type: "add-track"; aspect: AspectPreset; track: EditorTrack }
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
      type: "split-clip";
      aspect: AspectPreset;
      clipId: string;
      splitFrame: number;
      leftClipId: string;
      rightClipId: string;
    }
  | {
      type: "duplicate-clip";
      aspect: AspectPreset;
      clipId: string;
      newClipId: string;
    }
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
  tracks: version.tracks?.map((track) => ({ ...track })),
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
    case "add-track": {
      return withUpdatedVersion(state, action.aspect, (version) => {
        if (version.tracks?.some((track) => track.id === action.track.id)) {
          return version;
        }
        return {
          ...version,
          tracks: [...(version.tracks ?? []), action.track],
        };
      });
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
    case "split-clip": {
      return withUpdatedVersion(state, action.aspect, (version) => {
        const clipIndex = version.clips.findIndex((clip) => clip.id === action.clipId);
        if (
          clipIndex === -1 ||
          !action.leftClipId ||
          !action.rightClipId ||
          action.leftClipId === action.rightClipId ||
          version.clips.some(
            (clip) =>
              clip.id === action.leftClipId || clip.id === action.rightClipId,
          )
        ) {
          return version;
        }

        const clip = version.clips[clipIndex];
        const splitFrame = Math.round(action.splitFrame);
        if (splitFrame <= clip.startFrame || splitFrame >= clip.endFrame) {
          return version;
        }

        const sourceSplitFrame =
          clip.trimStartFrame + (splitFrame - clip.startFrame);
        const leftClip: Clip = {
          ...clip,
          id: action.leftClipId,
          endFrame: splitFrame,
          trimEndFrame: sourceSplitFrame,
        };
        const rightClip: Clip = {
          ...clip,
          id: action.rightClipId,
          startFrame: splitFrame,
          trimStartFrame: sourceSplitFrame,
        };
        const clips = [...version.clips];
        clips.splice(clipIndex, 1, leftClip, rightClip);
        const transitions = version.transitions.map((transition) => ({
          ...transition,
          toClipId:
            transition.toClipId === clip.id
              ? action.leftClipId
              : transition.toClipId,
          fromClipId:
            transition.fromClipId === clip.id
              ? action.rightClipId
              : transition.fromClipId,
        }));

        return { ...version, clips, transitions };
      });
    }
    case "duplicate-clip": {
      return withUpdatedVersion(state, action.aspect, (version) => {
        const clipIndex = version.clips.findIndex((clip) => clip.id === action.clipId);
        if (
          clipIndex === -1 ||
          !action.newClipId ||
          version.clips.some((clip) => clip.id === action.newClipId)
        ) {
          return version;
        }

        const source = version.clips[clipIndex];
        const duration = Math.max(1, source.endFrame - source.startFrame);
        const duplicate: Clip = {
          ...source,
          id: action.newClipId,
          startFrame: source.endFrame,
          endFrame: source.endFrame + duration,
        };
        const clips = [...version.clips];
        clips.splice(clipIndex + 1, 0, duplicate);
        // An outgoing transition belongs to the final copy so it remains
        // connected to the original next clip after insertion.
        const transitions = version.transitions.map((transition) =>
          transition.fromClipId === source.id
            ? { ...transition, fromClipId: action.newClipId }
            : transition,
        );
        return { ...version, clips, transitions };
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
