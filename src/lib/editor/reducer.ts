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
import { FPS } from "./constants";
import { sanitizeVersion, sanitizeTransitions } from "./timeline";

import type { ClipKeyframes } from "./keyframes";
import { splitClipKeyframes } from "./keyframes";
import type { TimeMapping } from "./time-mapping";
import { splitTimeMapping, sourceTimeAtFrame } from "./time-mapping";
import type { CaptionCue } from "./captions";
import type { AudioDuckingRule } from "./audio-ducking";

import { DEFAULT_VIDEO_TRACK_ID, ensureEditorTracks } from "./tracks";
import { createCutdown } from "./cutdowns";
import { isValidSelectiveColorRegions } from "./color-grading";

export type EditorAction =
  | {type:"set-clip-keyframes"; aspect:AspectPreset; clipId:string; keyframes:ClipKeyframes}
  | {type:"set-clip-time-mapping"; aspect:AspectPreset; clipId:string; mapping:TimeMapping; sourceDurationUs?:number}
  | {type:"freeze-clip-range"; aspect:AspectPreset; clipId:string; startFrame:number; endFrame:number; sourceTimeUs:number; segmentIds:string[]; sourceDurationUs?:number}
  | {type:"upsert-caption-cues"; aspect:AspectPreset; cues:CaptionCue[]}
  | {type:"remove-caption-cue"; aspect:AspectPreset; cueId:string}
  | {type:"set-ducking-rule"; aspect:AspectPreset; rule:AudioDuckingRule}
  | {type:"remove-ducking-rule"; aspect:AspectPreset; ruleId:string}
  | { type: "switch-aspect"; aspect: AspectPreset }
  | { type: "create-cutdown"; id: string; name: string; durationFrames: number; sourceAspect: AspectPreset }
  | { type: "switch-cutdown"; id: string }
  | { type: "remove-cutdown"; id: string }
  | { type: "replace-version"; aspect: AspectPreset; version: VersionTimeline }
  | { type: "add-track"; aspect: AspectPreset; track: EditorTrack }
  | { type: "append-clip"; aspect: AspectPreset; clip: Clip }
  | { type: "place-clip"; aspect: AspectPreset; clipId: string; trackId: string; startFrame: number }
  | { type: "reorder-tracks"; aspect: AspectPreset; trackIds: string[] }
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

/** Shared by direct mutations and command preflight; omitted grades stay optional. */
export const validateVideoFilterGrades = (version: VersionTimeline) => {
  const issues: { code: "INVALID_VALUE"; entityId: string; message: string }[] = [];
  for (const clip of version.clips) {
    if (!clip.videoFilter) continue;
    const filter = clip.videoFilter as unknown as Record<string, unknown>;
    if (filter.selectiveRegions !== undefined && !isValidSelectiveColorRegions(filter.selectiveRegions)) {
      issues.push({ code: "INVALID_VALUE", entityId: clip.id, message: "selectiveRegions must contain at most eight uniquely identified, valid bounded region masks." });
    }
    for (const [field, limit] of [
      ["exposure", 2], ["temperature", 1], ["tint", 1],
      ["shadows", 1], ["highlights", 1],
    ] as const) {
      const value = filter[field];
      if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < -limit || value > limit)) {
        issues.push({ code: "INVALID_VALUE", entityId: clip.id, message: `${field} must be finite and between ${-limit} and ${limit}.` });
      }
    }
    if (filter.toneCurve !== undefined && filter.toneCurve !== "linear" && filter.toneCurve !== "filmic") {
      issues.push({ code: "INVALID_VALUE", entityId: clip.id, message: "toneCurve must be linear or filmic." });
    }
  }
  return issues;
};

const withUpdatedVersion = (
  state: ProjectSession,
  aspect: AspectPreset,
  mutate: (version: VersionTimeline) => VersionTimeline,
): ProjectSession => {
  const activeCutdown = aspect === state.activeVersion
    ? state.cutdowns?.find((item) => item.id === state.activeCutdownId)
    : undefined;
  const currentVersion = activeCutdown?.timeline ?? state.versions[aspect];
  const mutated = mutate(currentVersion);
  if (mutated === currentVersion || JSON.stringify(mutated) === JSON.stringify(currentVersion)) return state;
  if (validateVideoFilterGrades(mutated).length > 0) return state;
  const sanitized = sanitizeVersion(mutated);

  if (!sanitized) {
    return state;
  }

  if (activeCutdown) {
    return {
      ...state,
      cutdowns: state.cutdowns?.map((item) => item.id === activeCutdown.id
        ? { ...item, timeline: sanitized }
        : item),
    };
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
  version.transitions.length > 0 || (version.captionCues?.length ?? 0) > 0;

const copyTimelineToAspect = (
  version: VersionTimeline,
  aspect: AspectPreset,
): VersionTimeline => ({
  ...structuredClone(version),
  aspect,
  tracks: version.tracks?.map((track) => ({ ...track })),
  clips: version.clips.map((clip) => ({ ...clip })),
  textOverlays: version.textOverlays.map((overlay) => ({ ...overlay })),
  audioTracks: version.audioTracks.map((track) => ({ ...track })),
  transitions: version.transitions.map((transition) => ({ ...transition })),
});

/** Preserve ducking intent across structural edits without retaining dangling refs. */
const remapDucking = (version: VersionTimeline, kind: "audio" | "video", id: string, replacements: string[]): AudioDuckingRule[] | undefined => {
  if (!version.duckingRules) return undefined;
  const used = new Set(version.duckingRules.map(rule => rule.id));
  return version.duckingRules.flatMap(rule => {
    const triggers = rule.triggers.flatMap(ref => ref.kind === kind && ref.id === id ? replacements.map(next => ({kind, id: next})) : [ref]);
    if (!triggers.length) return [];
    if (rule.target.kind !== kind || rule.target.id !== id) return [{...rule, triggers}];
    return replacements.map((next, index) => {
      let ruleId = index === 0 ? rule.id : `${rule.id}:${next}`;
      if (index > 0) { while (used.has(ruleId)) ruleId += ":copy"; used.add(ruleId); }
      return {...rule, id: ruleId, triggers, target: {kind, id: next}};
    });
  });
};

export const editorReducer = (
  state: ProjectSession,
  action: EditorAction,
): ProjectSession => {
  switch (action.type) {
    case "set-clip-keyframes":
      return withUpdatedVersion(state, action.aspect, version => ({...version, clips:version.clips.map(clip => clip.id === action.clipId ? {...clip,keyframes:structuredClone(action.keyframes)} : clip)}));
    case "set-clip-time-mapping":
      return withUpdatedVersion(state, action.aspect, version => {
        const clip = version.clips.find(item => item.id === action.clipId);
        if (!clip) return version;
        let next = {...clip, timeMapping: structuredClone(action.mapping), sourceDurationUs: action.sourceDurationUs ?? clip.sourceDurationUs};
        if (action.mapping.kind === "normal" && clip.timeMapping && clip.timeMapping.kind !== "normal") {
          const sourceFrame = sourceTimeAtFrame(clip.timeMapping, 0, clip.trimStartFrame, FPS) * FPS / 1e6;
          const integerFrame = Math.round(sourceFrame);
          // Normal playback uses integer trim coordinates. Never silently round an
          // integrated fractional source offset or jump back to the old trim.
          if (!Number.isFinite(sourceFrame) || Math.abs(sourceFrame - integerFrame) > 1e-7) return version;
          next = {...next, trimStartFrame: integerFrame, trimEndFrame: integerFrame + clip.endFrame - clip.startFrame, sourceDurationUs: action.sourceDurationUs ?? clip.sourceDurationUs ?? clip.trimEndFrame / FPS * 1e6};
        }
        return {...version, clips: version.clips.map(item => item.id === clip.id ? next : item)};
      });
    case "upsert-caption-cues":
      return withUpdatedVersion(state, action.aspect, version => {
        if (!action.cues.length) return version;
        if (new Set(action.cues.map(cue => cue.id)).size !== action.cues.length) return version;
        const updates = new Map(action.cues.map(cue => [cue.id, structuredClone(cue)]));
        const existing = version.captionCues ?? [];
        const ids = new Set(existing.map(cue => cue.id));
        return {...version,captionCues:[...existing.map(cue => updates.get(cue.id) ?? cue),...action.cues.filter(cue => !ids.has(cue.id)).map(cue => structuredClone(cue))]};
      });
    case "remove-caption-cue":
      return withUpdatedVersion(state, action.aspect, version => version.captionCues?.some(cue => cue.id === action.cueId) ? ({...version,captionCues:version.captionCues.filter(cue => cue.id!==action.cueId)}) : version);
    case "set-ducking-rule":
      return withUpdatedVersion(state, action.aspect, version => ({...version,duckingRules:version.duckingRules?.some(rule => rule.id===action.rule.id) ? version.duckingRules.map(rule => rule.id===action.rule.id ? structuredClone(action.rule) : rule) : [...(version.duckingRules ?? []),structuredClone(action.rule)]}));
    case "remove-ducking-rule":
      return withUpdatedVersion(state, action.aspect, version => version.duckingRules?.some(rule => rule.id === action.ruleId) ? ({...version,duckingRules:version.duckingRules.filter(rule => rule.id!==action.ruleId)}) : version);
    case "freeze-clip-range":
      return withUpdatedVersion(state, action.aspect, version => {
        const clip=version.clips.find(item => item.id===action.clipId);
        if (!clip || clip.kind!=="video" || !Number.isInteger(action.startFrame) || !Number.isInteger(action.endFrame) || action.startFrame<clip.startFrame || action.endFrame>clip.endFrame || action.endFrame<=action.startFrame || version.transitions.some(tr => tr.fromClipId===clip.id || tr.toClipId===clip.id)) return version;
        const boundaries=[clip.startFrame,...(action.startFrame>clip.startFrame?[action.startFrame]:[]),...(action.endFrame<clip.endFrame?[action.endFrame]:[]),clip.endFrame];
        if (action.segmentIds.length!==boundaries.length-1 || new Set(action.segmentIds).size!==action.segmentIds.length || action.segmentIds.some(id=>!id || version.clips.some(item=>item.id===id))) return version;
        const segments=boundaries.slice(0,-1).map((start,index) => {
          const end=boundaries[index+1]; const offset=start-clip.startFrame; const duration=clip.endFrame-clip.startFrame;
          let channels=clip.keyframes; let mapping=clip.timeMapping;
          const retimed = mapping && mapping.kind !== "normal";
          if(offset>0){channels=splitClipKeyframes(channels,offset,duration)[1];if (retimed) mapping=splitTimeMapping(mapping,offset,duration,clip.trimStartFrame)[1];}
          if(end<clip.endFrame) { channels=splitClipKeyframes(channels,end-start,clip.endFrame-start)[0]; if(mapping && mapping.kind!=="normal") mapping=splitTimeMapping(mapping,end-start,clip.endFrame-start,clip.trimStartFrame)[0]; }
          const held=start===action.startFrame;
          return {...structuredClone(clip),id:action.segmentIds[index],startFrame:start,endFrame:end,keyframes:channels,
            trimStartFrame: retimed ? clip.trimStartFrame : clip.trimStartFrame + offset,
            trimEndFrame: retimed ? clip.trimEndFrame : clip.trimStartFrame + offset + end - start,
            timeMapping:held?{kind:"hold" as const,sourceTimeUs:action.sourceTimeUs}:mapping,
            sourceDurationUs:action.sourceDurationUs ?? clip.sourceDurationUs ?? clip.trimEndFrame / FPS * 1e6};
        });
        return {...version,clips:version.clips.flatMap(item=>item.id===clip.id?segments:[item]), duckingRules: remapDucking(version, "video", clip.id, segments.filter(segment => !segment.timeMapping || segment.timeMapping.kind === "normal").map(segment => segment.id))};
      });
    case "switch-aspect": {
      if (action.aspect === state.activeVersion && !state.activeCutdownId) {
        return state;
      }

      const targetVersion = state.versions[action.aspect];
      const shouldInitializeTarget = !hasTimelineContent(targetVersion);

      return {
        ...state,
        activeVersion: action.aspect,
        activeCutdownId: undefined,
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
    case "create-cutdown": {
      if (state.cutdowns?.some((item) => item.id === action.id)) return state;
      const cutdown = createCutdown(state.versions[action.sourceAspect], action);
      if (!cutdown) return state;
      return {
        ...state,
        activeVersion: action.sourceAspect,
        activeCutdownId: cutdown.id,
        cutdowns: [...(state.cutdowns ?? []), cutdown],
      };
    }
    case "switch-cutdown": {
      const cutdown = state.cutdowns?.find((item) => item.id === action.id);
      if (!cutdown || cutdown.id === state.activeCutdownId) return state;
      return { ...state, activeVersion: cutdown.sourceAspect, activeCutdownId: cutdown.id };
    }
    case "remove-cutdown": {
      if (!state.cutdowns?.some((item) => item.id === action.id)) return state;
      return {
        ...state,
        activeCutdownId: state.activeCutdownId === action.id ? undefined : state.activeCutdownId,
        cutdowns: state.cutdowns.filter((item) => item.id !== action.id),
      };
    }
    case "replace-version": {
      const validTransitions = sanitizeTransitions(action.version.clips, action.version.transitions);
      if (validTransitions.length !== action.version.transitions.length || validTransitions.some((transition, index) => transition.durationInFrames !== action.version.transitions[index].durationInFrames)) return state;
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
    case "reorder-tracks": {
      return withUpdatedVersion(state, action.aspect, (version) => {
        const tracks = ensureEditorTracks(version);
        if (action.trackIds.length !== tracks.length || new Set(action.trackIds).size !== tracks.length || action.trackIds.some((id) => !tracks.some((track) => track.id === id))) return version;
        return { ...version, tracks: action.trackIds.map((id, order) => ({ ...tracks.find((track) => track.id === id)!, order })) };
      });
    }
    case "place-clip": {
      return withUpdatedVersion(state, action.aspect, (version) => ({...version, clips: version.clips.map((clip) => clip.id === action.clipId ? {...clip, trackId: action.trackId, startFrame: action.startFrame, endFrame: action.startFrame + clip.endFrame - clip.startFrame} : clip)}));
    }
    case "append-clip": {
      return withUpdatedVersion(state, action.aspect, (version) => {
        const lane = action.clip.trackId ?? DEFAULT_VIDEO_TRACK_ID;
        const startFrame = Math.max(0, ...version.clips.filter((clip) => (clip.trackId ?? DEFAULT_VIDEO_TRACK_ID) === lane).map((clip) => clip.endFrame));
        return {...version, clips: [...version.clips, {...action.clip, startFrame, endFrame: startFrame + action.clip.endFrame - action.clip.startFrame}]};
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
          clip.id === action.clipId ? (() => {
            const next = { ...clip, ...action.patch };
            if ((action.patch.trimStartFrame !== undefined || action.patch.trimEndFrame !== undefined) && action.patch.endFrame === undefined) {
              next.endFrame = next.startFrame + next.trimEndFrame - next.trimStartFrame;
            }
            return next;
          })() : clip,
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
          duckingRules: remapDucking(version, "video", action.clipId, []),
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
        const splitFrame = action.splitFrame;
        if (!Number.isInteger(splitFrame)) return version;
        if (splitFrame <= clip.startFrame || splitFrame >= clip.endFrame) {
          return version;
        }

        const [leftKeyframes,rightKeyframes]=splitClipKeyframes(clip.keyframes,splitFrame-clip.startFrame,clip.endFrame-clip.startFrame);
        const mapped=clip.timeMapping && clip.timeMapping.kind!=="normal";
        const [leftMapping,rightMapping]=mapped ? splitTimeMapping(clip.timeMapping,splitFrame-clip.startFrame,clip.endFrame-clip.startFrame,clip.trimStartFrame) : [undefined,undefined];
        const sourceSplitFrame =
          clip.trimStartFrame + (splitFrame - clip.startFrame);
        const leftClip: Clip = {
          ...clip,
          id: action.leftClipId,
          endFrame: splitFrame,
          trimEndFrame: mapped ? clip.trimEndFrame : sourceSplitFrame,
          ...(clip.keyframes ? {keyframes:leftKeyframes} : {}),
          ...(mapped ? {timeMapping:leftMapping} : {}),
        };
        const rightClip: Clip = {
          ...clip,
          id: action.rightClipId,
          startFrame: splitFrame,
          trimStartFrame: mapped ? clip.trimStartFrame : sourceSplitFrame,
          ...(clip.keyframes ? {keyframes:rightKeyframes} : {}),
          ...(mapped ? {timeMapping:rightMapping} : {}),
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

        return { ...version, clips, transitions, duckingRules: remapDucking(version, "video", clip.id, [leftClip.id, rightClip.id]) };
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
        const clips = version.clips.map((clip) =>
          (clip.trackId ?? DEFAULT_VIDEO_TRACK_ID) === (source.trackId ?? DEFAULT_VIDEO_TRACK_ID) && clip.startFrame >= source.endFrame
            ? {...clip, startFrame: clip.startFrame + duration, endFrame: clip.endFrame + duration} : clip);
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
        const target = version.clips.find((clip) => clip.id === action.clipId);
        if (!target || ![-1, 1].includes(action.offset)) return version;
        const lane = version.clips.filter((clip) => (clip.trackId ?? DEFAULT_VIDEO_TRACK_ID) === (target.trackId ?? DEFAULT_VIDEO_TRACK_ID)).sort((a, b) => a.startFrame - b.startFrame);
        const neighbor = lane[lane.indexOf(target) + action.offset];
        if (!neighbor) return version;
        const first = action.offset === 1 ? target : neighbor;
        const second = action.offset === 1 ? neighbor : target;
        const gap = second.startFrame - first.endFrame;
        const secondDuration = second.endFrame - second.startFrame;
        const firstDuration = first.endFrame - first.startFrame;
        const clips = version.clips.map((clip) => clip.id === second.id
          ? {...clip, startFrame: first.startFrame, endFrame: first.startFrame + secondDuration}
          : clip.id === first.id ? {...clip, startFrame: first.startFrame + secondDuration + gap, endFrame: first.startFrame + secondDuration + gap + firstDuration} : clip);
        clips.sort((a, b) => a.startFrame - b.startFrame);
        return {...version, clips};
      });
    }
    case "set-transition": {
      return withUpdatedVersion(state, action.aspect, (version) => {
        if (!Number.isInteger(action.transition.durationInFrames) || action.transition.durationInFrames < 1 || sanitizeTransitions(version.clips, [action.transition])[0]?.durationInFrames !== action.transition.durationInFrames) return version;
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
        duckingRules: remapDucking(version, "audio", action.trackId, []),
      }));
    }
    default: {
      return state;
    }
  }
};
