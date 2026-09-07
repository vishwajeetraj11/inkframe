import { buildDuckingEnvelope } from "./audio-ducking";
import type { CaptionCue } from "./captions";
import type {
  Clip as ElahClip,
  Project as ElahProject,
  Track as ElahTrack,
  Transition as ElahTransition,
  Transform as ElahTransform,
} from "@elah/editor";
import { ASPECT_PRESETS, FPS } from "./constants";
import type {
  AssetRef,
  AudioTrack,
  Clip,
  EditorTrack,
  TextOverlay,
  TextOverlayAnimationKind,
  TextOverlayFontFamily,
  Transition,
  VersionTimeline,
} from "./types";
import {
  DEFAULT_AUDIO_TRACK_ID,
  DEFAULT_TEXT_TRACK_ID,
  DEFAULT_VIDEO_TRACK_ID,
  ensureEditorTracks,
} from "./tracks";

const ELah_SCHEMA_VERSION = 1;
const ELah_TRACK_HEIGHT = 40;
const BACKGROUND_TRACK_ID = "inkframe-background";
const VIDEO_AUDIO_TRACK_PREFIX = "inkframe-video-audio-";

export type ElahAdapterDiagnosticCode =
  | "missing-asset-source"
  | "unsupported-elah-clip"
  | "unsupported-elah-transition"
  | "missing-asset-id"
  | "fps-mismatch"
  | "unsupported-native-timing-edit";

export interface ElahAdapterDiagnostic {
  code: ElahAdapterDiagnosticCode;
  message: string;
  entityId?: string;
}

export interface ElahProjectionSnapshot {
  startFrame: number;
  durationFrames: number;
  sourceStartFrame: number;
  sourceDurationFrames: number;
}

/**
 * Inkframe remains the source of truth for properties Elah does not model, such
 * as italic text, numeric font weights, and canonical editing metadata.
 */
export interface InkframeElahSidecar {
  schemaVersion: 1;
  canonicalVersion: VersionTimeline;
  mapped: {
    clipIds: string[];
    audioTrackIds: string[];
    textOverlayIds: string[];
    transitionIds: string[];
    captionCueIds?: string[];
  };
  projectionSnapshots: Record<string, ElahProjectionSnapshot>;
}

export interface ToElahProjectOptions {
  assets?: readonly AssetRef[];
  assetSources?: Readonly<Record<string, string>>;
  projectId?: string;
  resolveAssetSource?: (assetId: string, asset?: AssetRef) => string | undefined;
}

export interface ElahProjectProjection {
  project: ElahProject;
  sidecar: InkframeElahSidecar;
  diagnostics: ElahAdapterDiagnostic[];
}

export interface InkframeTimelineProjection {
  rejected?: boolean;
  version: VersionTimeline;
  diagnostics: ElahAdapterDiagnostic[];
}

const cloneVersion = (version: VersionTimeline): VersionTimeline => ({
  ...version,
  ...(version.captionCues ? { captionCues: version.captionCues.map(cue => ({ ...cue })) } : {}),
  tracks: version.tracks?.map((track) => ({ ...track })),
  clips: version.clips.map((clip) => ({
    ...clip,
    ...(clip.videoFilter ? { videoFilter: structuredClone(clip.videoFilter) } : {}),
    ...(clip.transform ? { transform: { ...clip.transform, anchor: { ...clip.transform.anchor } } } : {}),
  })),
  textOverlays: version.textOverlays.map((overlay) => ({ ...overlay })),
  audioTracks: version.audioTracks.map((track) => ({ ...track })),
  transitions: version.transitions.map((transition) => ({ ...transition })),
});

const durationOf = (startFrame: number, endFrame: number): number =>
  Math.max(1, Math.round(endFrame) - Math.round(startFrame));

const clampVolume = (volume: number | undefined, fallback = 1): number =>
  Math.min(1, Math.max(0, volume ?? fallback));

const transitionKind = (transition: Transition): ElahTransition["kind"] =>
  transition.kind ?? (transition.type === "crossfade" ? "fade" : "fade");

const backgroundTransform = (
  width: number,
  height: number,
): ElahTransform => ({
  x: 0.5,
  y: 0.5,
  scale: Math.max(width, height) / Math.min(width, height),
  rotation: 0,
  anchor: { x: 0.5, y: 0.5 },
});

const transformForOverlay = (overlay: TextOverlay): ElahTransform => ({
  x: overlay.x / 100,
  y: overlay.y / 100,
  scale: 1,
  rotation: 0,
  anchor: { x: 0.5, y: 0.5 },
});

const ELah_FONT_BY_INKFRAME: Record<TextOverlayFontFamily, string> = {
  sans: '"Barlow Condensed", "Arial Narrow", sans-serif',
  modern: '"Sora", "Avenir Next", Avenir, "Trebuchet MS", sans-serif',
  serif: '"Source Serif 4", "Cormorant Garamond", Georgia, serif',
  cursive: '"Cormorant Garamond", Georgia, cursive',
  mono: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
  display: '"Barlow Condensed", "Arial Narrow", sans-serif',
  editorial: '"Source Serif 4", Georgia, serif',
  rounded: '"Plus Jakarta Sans", "Segoe UI", sans-serif',
};

const toInkframeFontFamily = (fontFamily: string | undefined): TextOverlayFontFamily => {
  const normalized = fontFamily?.toLowerCase() ?? "";
  if (normalized.includes("mono")) return "mono";
  if (normalized.includes("barlow")) return "sans";
  if (normalized.includes("source serif")) return "serif";
  if (normalized.includes("jakarta") || normalized.includes("rounded")) return "rounded";
  if (
    normalized.includes("avenir") ||
    normalized.includes("trebuchet") ||
    normalized.includes("helvetica")
  ) {
    return "modern";
  }
  if (normalized.includes("cursive") || normalized.includes("script")) return "cursive";
  if (normalized.includes("serif") && !normalized.includes("sans")) return "serif";
  return "sans";
};

const createTrack = (
  id: string,
  name: string,
  kind: ElahTrack["kind"],
  order: number,
  height = ELah_TRACK_HEIGHT,
): ElahTrack => ({
  id,
  name,
  kind,
  order,
  height,
  locked: false,
  disabled: false,
  muted: false,
  solo: false,
  volume: 1,
});

const toElahTrackKind = (kind: EditorTrack["kind"]): ElahTrack["kind"] =>
  kind === "text" || kind === "caption" ? "elements" : kind;

const toEditorTrackKind = (kind: ElahTrack["kind"]): EditorTrack["kind"] =>
  kind === "elements" ? "text" : kind === "audio" ? "audio" : "video";

const projectSnapshot = (clip: ElahClip): ElahProjectionSnapshot => ({
  startFrame: clip.startFrame,
  durationFrames: clip.durationFrames,
  sourceStartFrame: clip.sourceStartFrame,
  sourceDurationFrames: clip.sourceDurationFrames,
});

const resolveSource = (
  assetId: string,
  options: ToElahProjectOptions,
  assetById: ReadonlyMap<string, AssetRef>,
): string | undefined => {
  const asset = assetById.get(assetId);
  return (
    options.resolveAssetSource?.(assetId, asset) ??
    options.assetSources?.[assetId] ??
    asset?.externalUrl
  );
};

export const toElahProject = (
  version: VersionTimeline,
  options: ToElahProjectOptions = {},
): ElahProjectProjection => {
  const diagnostics: ElahAdapterDiagnostic[] = [];
  const assetById = new Map((options.assets ?? []).map((asset) => [asset.assetId, asset]));
  const tracks: ElahTrack[] = [];
  const clipsByTrack: Record<string, ElahClip[]> = {};
  const transitions: ElahTransition[] = [];
  const projectionSnapshots: Record<string, ElahProjectionSnapshot> = {};
  const mappedClipIds: string[] = [];
  const mappedAudioTrackIds: string[] = [];
  const mappedTextOverlayIds: string[] = [];
  const mappedTransitionIds: string[] = [];
  const mappedCaptionCueIds: string[] = [];

  const preset = ASPECT_PRESETS[version.aspect];
  const totalFrames = Math.max(
    1,
    ...version.clips.map((clip) => clip.endFrame),
    ...version.textOverlays.map((overlay) => overlay.endFrame),
    ...version.audioTracks.map((track) => track.endFrame),
    ...(version.captionCues ?? []).map(cue => cue.endFrame),
  );
  const editorTracks = ensureEditorTracks(version);
  const editorTrackById = new Map(editorTracks.map((track) => [track.id, track]));
  for (const editorTrack of editorTracks) {
    const track = createTrack(
      editorTrack.id,
      editorTrack.name,
      toElahTrackKind(editorTrack.kind),
      tracks.length,
    );
    tracks.push(track);
    clipsByTrack[track.id] = [];
  }

  // The generated canvas remains a render-only Elah layer. A zero-height row
  // keeps it out of the user-facing lane list while preserving composition.
  const backgroundTrack = createTrack(
    BACKGROUND_TRACK_ID,
    "Canvas",
    "video",
    tracks.length,
    0,
  );
  tracks.push(backgroundTrack);
  clipsByTrack[backgroundTrack.id] = [
    {
      id: "inkframe-background-base",
      trackId: backgroundTrack.id,
      type: "shape",
      name: "Canvas background",
      startFrame: 0,
      durationFrames: totalFrames,
      sourceStartFrame: 0,
      sourceDurationFrames: totalFrames,
      shapeKind: "rect",
      shapeFill: "#111827",
      shapeStrokeWidth: 0,
      transform: backgroundTransform(preset.width, preset.height),
      volume: 1,
      opacity: 1,
      locked: true,
      disabled: false,
    },
  ];

  for (const clip of version.clips) {
    const src = resolveSource(clip.assetId, options, assetById);
    if (!src) {
      diagnostics.push({
        code: "missing-asset-source",
        entityId: clip.id,
        message: `Clip ${clip.id} remains in the Inkframe sidecar because asset ${clip.assetId} has no browser source.`,
      });
      continue;
    }

    const asset = assetById.get(clip.assetId);
    const trackId =
      clip.trackId && editorTrackById.get(clip.trackId)?.kind === "video"
        ? clip.trackId
        : DEFAULT_VIDEO_TRACK_ID;
    const elahClip: ElahClip = {
      id: clip.id,
      trackId,
      type: clip.kind,
      name: asset?.name ?? clip.assetId,
      startFrame: clip.startFrame,
      durationFrames: durationOf(clip.startFrame, clip.endFrame),
      sourceStartFrame: clip.trimStartFrame,
      sourceDurationFrames: Math.max(1, clip.trimEndFrame),
      src,
      assetId: clip.assetId,
      volume: clampVolume(clip.volume),
      opacity: clip.opacity ?? 1,
      ...(clip.videoFilter
        ? { videoFilter: structuredClone(clip.videoFilter) }
        : {}),
      ...(clip.keyframes ? { keyframes: structuredClone(clip.keyframes) } : {}),
      ...(clip.timeMapping ? { timeMapping: structuredClone(clip.timeMapping) } : {}),
      ...(clip.transform ? { transform: { ...clip.transform, anchor: { ...clip.transform.anchor } } } : {}),
      locked: false,
      disabled: false,
    };
    clipsByTrack[trackId].push(elahClip);
    projectionSnapshots[clip.id] = projectSnapshot(elahClip);
    mappedClipIds.push(clip.id);

    if (clip.kind === "video" && clip.volume > 0 && (!clip.timeMapping || clip.timeMapping.kind === "normal")) {
      // Elah's audio controller schedules audio-track clips, not the audio
      // stream embedded in a video clip. Mirror that stream as a linked audio
      // clip so uploaded videos retain their original soundtrack in preview
      // and export without adding a second Inkframe asset.
      const sourceAudioId = `${VIDEO_AUDIO_TRACK_PREFIX}${clip.id}`;
      clipsByTrack[DEFAULT_AUDIO_TRACK_ID].push(
        {
          id: sourceAudioId,
          trackId: DEFAULT_AUDIO_TRACK_ID,
          type: "audio",
          name: `${asset?.name ?? clip.assetId} audio`,
          startFrame: clip.startFrame,
          durationFrames: durationOf(clip.startFrame, clip.endFrame),
          sourceStartFrame: clip.trimStartFrame,
          sourceDurationFrames: Math.max(1, clip.trimEndFrame),
          src,
          assetId: clip.assetId,
          volume: clampVolume(clip.volume),
          gainEnvelope: buildDuckingEnvelope(version, { kind: "video", id: clip.id }),
          opacity: 1,
          locked: true,
          disabled: false,
        },
      );
    }
  }

  for (const overlay of version.textOverlays) {
    const trackId =
      overlay.trackId && editorTrackById.get(overlay.trackId)?.kind === "text"
        ? overlay.trackId
        : DEFAULT_TEXT_TRACK_ID;
    const elahClip: ElahClip = {
      id: overlay.id,
      trackId,
      type: "text",
      name: "Text",
      startFrame: overlay.startFrame,
      durationFrames: durationOf(overlay.startFrame, overlay.endFrame),
      sourceStartFrame: 0,
      sourceDurationFrames: durationOf(overlay.startFrame, overlay.endFrame),
      content: overlay.text,
      fontSize: overlay.fontSize,
      color: overlay.color,
      ...(overlay.contrast === "outline"
        ? {
            strokeColor: "#17120f",
            strokeWidth: Math.max(2, Math.round(overlay.fontSize * 0.07)),
          }
        : {}),
      fontFamily: ELah_FONT_BY_INKFRAME[overlay.fontFamily],
      fontWeight: overlay.fontWeight >= 600 ? "bold" : "normal",
      textAlign: overlay.textAlign ?? "center",
      volume: 1,
      opacity: 1,
      locked: false,
      disabled: false,
      transform: transformForOverlay(overlay),
      ...(overlay.animation
        ? {
            textAnimation: {
              ...(overlay.animation.in ? { in: overlay.animation.in } : {}),
              ...(overlay.animation.out ? { out: overlay.animation.out } : {}),
              durationFrames: Math.max(0, Math.round(overlay.animation.durationFrames)),
            } as ElahClip["textAnimation"],
          }
        : {}),
    };
    projectionSnapshots[overlay.id] = projectSnapshot(elahClip);
    mappedTextOverlayIds.push(overlay.id);

    clipsByTrack[trackId].push(elahClip);
  }

  for (const cue of version.captionCues ?? []) {
    if (editorTrackById.get(cue.trackId)?.kind !== "caption") continue;
    const caption: ElahClip = {
      id: cue.id, trackId: cue.trackId, type: "text", name: "Caption",
      startFrame: cue.startFrame, durationFrames: cue.endFrame - cue.startFrame,
      sourceStartFrame: 0, sourceDurationFrames: cue.endFrame - cue.startFrame,
      content: cue.text, fontSize: Math.round(preset.height * 0.045),
      color: "#ffffff", fontFamily: "sans-serif", fontWeight: "bold", textAlign: "center",
      opacity: 1, volume: 0, locked: false, disabled: false,
      transform: { x: 0.5, y: 0.88, scale: 1, rotation: 0, anchor: { x: 0.5, y: 0.5 } },
    };
    clipsByTrack[cue.trackId].push(caption);
    mappedCaptionCueIds.push(cue.id);
    projectionSnapshots[cue.id] = projectSnapshot(caption);
  }

  for (const audio of version.audioTracks) {
    const src = resolveSource(audio.assetId, options, assetById);
    if (!src) {
      diagnostics.push({
        code: "missing-asset-source",
        entityId: audio.id,
        message: `Audio ${audio.id} remains in the Inkframe sidecar because asset ${audio.assetId} has no browser source.`,
      });
      continue;
    }

    const trackId =
      audio.trackId && editorTrackById.get(audio.trackId)?.kind === "audio"
        ? audio.trackId
        : DEFAULT_AUDIO_TRACK_ID;
    const asset = assetById.get(audio.assetId);
    const elahClip: ElahClip = {
      id: audio.id,
      trackId,
      type: "audio",
      name: asset?.name ?? audio.assetId,
      startFrame: audio.startFrame,
      durationFrames: durationOf(audio.startFrame, audio.endFrame),
      sourceStartFrame: audio.trimStartFrame,
      sourceDurationFrames: Math.max(1, audio.trimEndFrame),
      src,
      assetId: audio.assetId,
      volume: clampVolume(audio.volume),
      gainEnvelope: buildDuckingEnvelope(version, { kind: "audio", id: audio.id }),
      fadeInFrames: Math.max(0, Math.round(audio.fadeInFrames ?? 0)),
      fadeOutFrames: Math.max(0, Math.round(audio.fadeOutFrames ?? 0)),
      opacity: 1,
      locked: false,
      disabled: audio.muted ?? false,
    };
    clipsByTrack[trackId].push(elahClip);
    projectionSnapshots[audio.id] = projectSnapshot(elahClip);
    mappedAudioTrackIds.push(audio.id);
  }

  const mappedVisualIds = new Set(mappedClipIds);
  const visualById = new Map(
    editorTracks
      .filter((track) => track.kind === "video")
      .flatMap((track) => clipsByTrack[track.id] ?? [])
      .map((clip) => [clip.id, clip]),
  );
  for (const transition of version.transitions) {
    if (
      !mappedVisualIds.has(transition.fromClipId) ||
      !mappedVisualIds.has(transition.toClipId)
    ) {
      continue;
    }

    const toClip = visualById.get(transition.toClipId);
    if (!toClip) continue;
    const kind = transitionKind(transition);
    transitions.push({
      id: transition.id,
      kind,
      fromClipId: transition.fromClipId,
      toClipId: transition.toClipId,
      trackId: toClip.trackId,
      startFrame: toClip.startFrame - Math.floor(transition.durationInFrames / 2),
      durationFrames: Math.max(1, transition.durationInFrames),
      ...(transition.direction ? { direction: transition.direction } : {}),
      easing: transition.easing ?? "linear",
    });
    mappedTransitionIds.push(transition.id);
  }

  return {
    project: {
      id: options.projectId ?? `inkframe-${version.aspect}`,
      fps: preset.fps,
      stage: { width: preset.width, height: preset.height },
      tracks,
      clips: clipsByTrack,
      transitions,
      version: ELah_SCHEMA_VERSION,
      masterVolume: 1,
    },
    sidecar: {
      schemaVersion: 1,
      canonicalVersion: cloneVersion(version),
      mapped: {
        clipIds: mappedClipIds,
        audioTrackIds: mappedAudioTrackIds,
        textOverlayIds: mappedTextOverlayIds,
        transitionIds: mappedTransitionIds,
        captionCueIds: mappedCaptionCueIds,
      },
      projectionSnapshots,
    },
    diagnostics,
  };
};

const flattenClips = (project: ElahProject): ElahClip[] =>
  [...project.tracks]
    .sort((left, right) => left.order - right.order)
    .flatMap((track) => project.clips[track.id] ?? []);

const mergeCanonicalOrder = <T extends { id: string }>(
  canonical: readonly T[],
  mappedIds: ReadonlySet<string>,
  projectedById: ReadonlyMap<string, T>,
): T[] => {
  const merged: T[] = [];
  const consumed = new Set<string>();
  for (const item of canonical) {
    if (!mappedIds.has(item.id)) {
      merged.push({ ...item });
      continue;
    }
    const projected = projectedById.get(item.id);
    if (projected) {
      merged.push(projected);
      consumed.add(projected.id);
    }
  }
  for (const [id, projected] of projectedById) {
    if (!consumed.has(id)) merged.push(projected);
  }
  return merged;
};

const mergeVisualTimelineOrder = (
  canonical: readonly Clip[],
  mappedIds: ReadonlySet<string>,
  projectedById: ReadonlyMap<string, Clip>,
): Clip[] => {
  const canonicalIndex = new Map(canonical.map((clip, index) => [clip.id, index]));
  return mergeCanonicalOrder(canonical, mappedIds, projectedById).sort(
    (left, right) =>
      left.startFrame - right.startFrame ||
      (canonicalIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (canonicalIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
};

const hasSameProjection = (
  clip: ElahClip,
  snapshot: ElahProjectionSnapshot | undefined,
): boolean =>
  Boolean(
    snapshot &&
      snapshot.startFrame === clip.startFrame &&
      snapshot.durationFrames === clip.durationFrames &&
      snapshot.sourceStartFrame === clip.sourceStartFrame &&
      snapshot.sourceDurationFrames === clip.sourceDurationFrames,
  );

export const fromElahProject = (
  project: ElahProject,
  sidecar: InkframeElahSidecar,
): InkframeTimelineProjection => {
  const diagnostics: ElahAdapterDiagnostic[] = [];
  const canonical = sidecar.canonicalVersion;
  if (project.fps !== FPS) {
    diagnostics.push({
      code: "fps-mismatch",
      message: `Elah project uses ${project.fps} fps; Inkframe frame values are interpreted at ${FPS} fps.`,
    });
  }

  const canonicalClipById = new Map(canonical.clips.map((clip) => [clip.id, clip]));
  const canonicalAudioById = new Map(canonical.audioTracks.map((track) => [track.id, track]));
  const canonicalTextById = new Map(canonical.textOverlays.map((overlay) => [overlay.id, overlay]));
  const trackById = new Map(project.tracks.map((track) => [track.id, track]));
  const editorTracks = ensureEditorTracks({
    tracks: project.tracks
      .filter((track) => track.id !== BACKGROUND_TRACK_ID)
      .map((track) => ({
        id: track.id,
        kind: canonical.tracks?.find(item => item.id === track.id)?.kind === "caption"
          ? "caption" as const : toEditorTrackKind(track.kind),
        name: track.name,
        order: track.order,
      })),
  });
  const editorTrackIds = new Set(editorTracks.map((track) => track.id));
  const resolvePersistedTrackId = (
    originalTrackId: string | undefined,
    projectedTrackId: string,
    defaultTrackId: string,
  ): string | undefined =>
    canonical.tracks || originalTrackId || projectedTrackId !== defaultTrackId
      ? projectedTrackId
      : undefined;
  const nativeClips = flattenClips(project);
  // Native trimming/splitting does not rebase animation channels or source maps.
  // Reject the complete gesture rather than commit a partially changed timeline.
  for (const original of canonical.clips) {
    if (!original.keyframes && (!original.timeMapping || original.timeMapping.kind === "normal")) continue;
    const native = nativeClips.find(clip => clip.id === original.id);
    const snapshot = sidecar.projectionSnapshots[original.id];
    if (native && snapshot && (native.durationFrames !== snapshot.durationFrames || native.sourceStartFrame !== snapshot.sourceStartFrame || native.sourceDurationFrames !== snapshot.sourceDurationFrames)) {
      return { version: cloneVersion(canonical), rejected: true, diagnostics: [{ code: "unsupported-native-timing-edit", entityId: original.id, message: "Use canonical trim or split commands for clips with keyframes or source-time mapping." }] };
    }
  }
  const captionById = new Map<string, CaptionCue>();
  const visualById = new Map<string, Clip>();
  const audioById = new Map<string, AudioTrack>();
  const textById = new Map<string, TextOverlay>();

  for (const native of nativeClips) {
    if (native.id.startsWith(VIDEO_AUDIO_TRACK_PREFIX)) {
      continue;
    }

    if (
      native.trackId === BACKGROUND_TRACK_ID &&
      native.id.startsWith("inkframe-background-")
    ) {
      continue;
    }

    if (native.type === "text" && editorTracks.some(track => track.id === native.trackId && track.kind === "caption")) {
      captionById.set(native.id, {
        id: native.id, trackId: native.trackId, startFrame: native.startFrame,
        endFrame: native.startFrame + native.durationFrames, text: native.content ?? "",
      });
      continue;
    }

    if (native.type === "video" || native.type === "image") {
      const original = canonicalClipById.get(native.id);
      const nativeVideoFilter = (
        native as ElahClip & { videoFilter?: Clip["videoFilter"] }
      ).videoFilter;
      const assetId = native.assetId ?? original?.assetId;
      if (!assetId) {
        diagnostics.push({
          code: "missing-asset-id",
          entityId: native.id,
          message: `Elah ${native.type} clip ${native.id} was skipped because it has no asset id.`,
        });
        continue;
      }
      const unchanged = hasSameProjection(native, sidecar.projectionSnapshots[native.id]);
      const trimStartFrame = Math.max(0, Math.round(native.sourceStartFrame));
      const durationFrames = Math.max(1, Math.round(native.durationFrames));
      visualById.set(native.id, {
        ...original,
        ...(native.keyframes ? { keyframes: structuredClone(native.keyframes) } : {}),
        ...(native.timeMapping ? { timeMapping: structuredClone(native.timeMapping) } : {}),
        // Explicit transforms use Elah source-pixel scale and radians. Missing
        // transforms retain automatic contain-fit for legacy projects.
        transform: native.transform
          ? { ...native.transform, anchor: { ...native.transform.anchor } }
          : undefined,
        ...(native.opacity !== 1 || original?.opacity !== undefined
          ? { opacity: native.opacity }
          : {}),
        ...((nativeVideoFilter || original?.videoFilter)
          // Elah may return only its supported filter fields. Keep optional
          // canonical grades while allowing explicit native values to win.
          ? { videoFilter: structuredClone({ ...original?.videoFilter, ...nativeVideoFilter }) as NonNullable<Clip["videoFilter"]> }
          : {}),
        id: native.id,
        assetId,
        trackId: resolvePersistedTrackId(
          original?.trackId,
          editorTrackIds.has(native.trackId) ? native.trackId : DEFAULT_VIDEO_TRACK_ID,
          DEFAULT_VIDEO_TRACK_ID,
        ),
        kind: native.type,
        startFrame: Math.max(0, Math.round(native.startFrame)),
        endFrame: Math.max(0, Math.round(native.startFrame)) + durationFrames,
        trimStartFrame,
        trimEndFrame:
          unchanged && original
            ? original.trimEndFrame
            : trimStartFrame + durationFrames,
        volume: clampVolume(native.volume, original?.volume),
      });
      continue;
    }

    if (native.type === "audio") {
      const original = canonicalAudioById.get(native.id);
      const assetId = native.assetId ?? original?.assetId;
      if (!assetId) {
        diagnostics.push({
          code: "missing-asset-id",
          entityId: native.id,
          message: `Elah audio clip ${native.id} was skipped because it has no asset id.`,
        });
        continue;
      }
      const unchanged = hasSameProjection(native, sidecar.projectionSnapshots[native.id]);
      const trimStartFrame = Math.max(0, Math.round(native.sourceStartFrame));
      const durationFrames = Math.max(1, Math.round(native.durationFrames));
      const muted =
        native.disabled ||
        trackById.get(native.trackId)?.muted ||
        original?.muted ||
        false;
      const volume = clampVolume(native.volume, original?.volume);
      if (
        original &&
        unchanged &&
        volume === original.volume &&
        muted === (original.muted ?? false)
      ) {
        audioById.set(native.id, {
          ...original,
          trackId: resolvePersistedTrackId(
            original.trackId,
            editorTrackIds.has(native.trackId) ? native.trackId : DEFAULT_AUDIO_TRACK_ID,
            DEFAULT_AUDIO_TRACK_ID,
          ),
        });
        continue;
      }
      audioById.set(native.id, {
        id: native.id,
        assetId,
        trackId: resolvePersistedTrackId(
          original?.trackId,
          editorTrackIds.has(native.trackId) ? native.trackId : DEFAULT_AUDIO_TRACK_ID,
          DEFAULT_AUDIO_TRACK_ID,
        ),
        startFrame: Math.max(0, Math.round(native.startFrame)),
        endFrame: Math.max(0, Math.round(native.startFrame)) + durationFrames,
        trimStartFrame,
        trimEndFrame:
          unchanged && original
            ? original.trimEndFrame
            : trimStartFrame + durationFrames,
        volume,
        fadeInFrames: original?.fadeInFrames ?? 0,
        fadeOutFrames: original?.fadeOutFrames ?? 0,
        muted,
      });
      continue;
    }

    if (native.type === "text") {
      const original = canonicalTextById.get(native.id);
      const expectedFont = original ? ELah_FONT_BY_INKFRAME[original.fontFamily] : undefined;
      const expectedWeight = original
        ? original.fontWeight >= 600
          ? "bold"
          : "normal"
        : undefined;
      const fontFamily =
        original && native.fontFamily === expectedFont
          ? original.fontFamily
          : toInkframeFontFamily(native.fontFamily);
      const fontWeight =
        original && native.fontWeight === expectedWeight
          ? original.fontWeight
          : native.fontWeight === "bold"
            ? 700
            : 400;
      textById.set(native.id, {
        id: native.id,
        trackId: resolvePersistedTrackId(
          original?.trackId,
          editorTrackIds.has(native.trackId) ? native.trackId : DEFAULT_TEXT_TRACK_ID,
          DEFAULT_TEXT_TRACK_ID,
        ),
        text:
          original && native.content === original.text
            ? original.text
            : (native.content ?? original?.text ?? "Text"),
        startFrame: Math.max(0, Math.round(native.startFrame)),
        endFrame:
          Math.max(0, Math.round(native.startFrame)) +
          Math.max(1, Math.round(native.durationFrames)),
        x:
          native.transform?.x !== undefined
            ? native.transform.x * 100
            : (original?.x ?? 50),
        y:
          native.transform?.y !== undefined
            ? native.transform.y * 100
            : (original?.y ?? 50),
        fontSize:
          original && native.fontSize === original.fontSize
            ? original.fontSize
            : (native.fontSize ?? original?.fontSize ?? 64),
        color: native.color ?? original?.color ?? "#ffffff",
        fontFamily,
        fontWeight,
        fontStyle: original?.fontStyle ?? "normal",
        ...(native.textAlign &&
        (native.textAlign !== "center" || original?.textAlign !== undefined)
          ? { textAlign: native.textAlign }
          : {}),
        stylePreset: original?.stylePreset ?? "classic",
        ...(original?.contrast ? { contrast: original.contrast } : {}),
        ...(native.textAnimation
          ? {
              animation: {
                ...(native.textAnimation.in
                  ? { in: native.textAnimation.in as TextOverlayAnimationKind }
                  : {}),
                ...(native.textAnimation.out
                  ? { out: native.textAnimation.out as TextOverlayAnimationKind }
                  : {}),
                durationFrames: Math.max(
                  0,
                  Math.round(native.textAnimation.durationFrames),
                ),
              },
            }
          : {}),
      });
      continue;
    }

    diagnostics.push({
      code: "unsupported-elah-clip",
      entityId: native.id,
      message: `Elah ${native.type} clip ${native.id} has no Inkframe equivalent and was skipped.`,
    });
  }

  const transitionById = new Map<string, Transition>();
  const visualIds = new Set(visualById.keys());
  for (const transition of project.transitions) {
    if (
      !visualIds.has(transition.fromClipId) ||
      !visualIds.has(transition.toClipId)
    ) {
      diagnostics.push({
        code: "unsupported-elah-transition",
        entityId: transition.id,
        message: `Elah transition ${transition.id} references clips that have no Inkframe equivalent and was skipped.`,
      });
      continue;
    }
    const original = canonical.transitions.find((item) => item.id === transition.id);
    const kind = transition.kind;
    const toClip = visualById.get(transition.toClipId);
    const expectedStartFrame = toClip
      ? toClip.startFrame - Math.floor((original?.durationInFrames ?? transition.durationFrames) / 2)
      : transition.startFrame;
    const unchanged =
      Boolean(original) &&
      transition.startFrame === expectedStartFrame &&
      transition.durationFrames === original?.durationInFrames &&
      kind === (original?.kind ?? (original?.type === "crossfade" ? "fade" : "fade")) &&
      (transition.direction ?? undefined) === (original?.direction ?? undefined) &&
      (transition.easing ?? "linear") === (original?.easing ?? "linear");

    if (unchanged && original) {
      transitionById.set(transition.id, { ...original });
      continue;
    }

    transitionById.set(transition.id, {
      id: transition.id,
      kind,
      fromClipId: transition.fromClipId,
      toClipId: transition.toClipId,
      durationInFrames: Math.max(1, Math.round(transition.durationFrames)),
      ...(transition.direction ? { direction: transition.direction } : {}),
      ...(transition.easing ? { easing: transition.easing } : {}),
    });
  }

  return {
    version: {
      ...canonical,
      aspect: canonical.aspect,
      ...(canonical.captionCues || captionById.size ? { captionCues: mergeCanonicalOrder(canonical.captionCues ?? [], new Set(sidecar.mapped.captionCueIds ?? []), captionById) } : {}),
      ...(canonical.tracks ? { tracks: editorTracks } : {}),
      clips: mergeVisualTimelineOrder(
        canonical.clips,
        new Set(sidecar.mapped.clipIds),
        visualById,
      ),
      textOverlays: mergeCanonicalOrder(
        canonical.textOverlays,
        new Set(sidecar.mapped.textOverlayIds),
        textById,
      ),
      audioTracks: mergeCanonicalOrder(
        canonical.audioTracks,
        new Set(sidecar.mapped.audioTrackIds),
        audioById,
      ),
      transitions: mergeCanonicalOrder(
        canonical.transitions,
        new Set(sidecar.mapped.transitionIds),
        transitionById,
      ),
    },
    diagnostics,
  };
};
