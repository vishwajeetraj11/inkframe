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
  TextOverlay,
  TextOverlayFontFamily,
  Transition,
  VersionTimeline,
} from "./types";

const ELah_SCHEMA_VERSION = 1;
const ELah_TRACK_HEIGHT = 40;
const VIDEO_TRACK_ID = "inkframe-video";

export type ElahAdapterDiagnosticCode =
  | "missing-asset-source"
  | "preset-projected-as-text"
  | "unsupported-elah-clip"
  | "unsupported-elah-transition"
  | "missing-asset-id"
  | "fps-mismatch";

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
 * as preset ids, italic text, numeric font weights, and Createdaley settings.
 */
export interface InkframeElahSidecar {
  schemaVersion: 1;
  canonicalVersion: VersionTimeline;
  mapped: {
    clipIds: string[];
    audioTrackIds: string[];
    textOverlayIds: string[];
    transitionIds: string[];
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
  version: VersionTimeline;
  diagnostics: ElahAdapterDiagnostic[];
}

const cloneVersion = (version: VersionTimeline): VersionTimeline => ({
  ...version,
  clips: version.clips.map((clip) => ({ ...clip })),
  textOverlays: version.textOverlays.map((overlay) => ({ ...overlay })),
  audioTracks: version.audioTracks.map((track) => ({ ...track })),
  transitions: version.transitions.map((transition) => ({ ...transition })),
});

const durationOf = (startFrame: number, endFrame: number): number =>
  Math.max(1, Math.round(endFrame) - Math.round(startFrame));

const clampVolume = (volume: number | undefined, fallback = 1): number =>
  Math.min(1, Math.max(0, volume ?? fallback));

const transformForOverlay = (overlay: TextOverlay): ElahTransform => ({
  x: overlay.x / 100,
  y: overlay.y / 100,
  scale: 1,
  rotation: 0,
  anchor: { x: 0.5, y: 0.5 },
});

const ELah_FONT_BY_INKFRAME: Record<TextOverlayFontFamily, string> = {
  sans: "sans-serif",
  serif: "serif",
  cursive: "cursive",
  mono: "monospace",
};

const toInkframeFontFamily = (fontFamily: string | undefined): TextOverlayFontFamily => {
  const normalized = fontFamily?.toLowerCase() ?? "";
  if (normalized.includes("mono")) return "mono";
  if (normalized.includes("cursive") || normalized.includes("script")) return "cursive";
  if (normalized.includes("serif") && !normalized.includes("sans")) return "serif";
  return "sans";
};

const createTrack = (
  id: string,
  name: string,
  kind: ElahTrack["kind"],
  order: number,
): ElahTrack => ({
  id,
  name,
  kind,
  order,
  height: ELah_TRACK_HEIGHT,
  locked: false,
  disabled: false,
  muted: false,
  solo: false,
  volume: 1,
});

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

  const videoTrack = createTrack(VIDEO_TRACK_ID, "Video", "video", tracks.length);
  tracks.push(videoTrack);
  clipsByTrack[videoTrack.id] = [];

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
    const elahClip: ElahClip = {
      id: clip.id,
      trackId: videoTrack.id,
      type: clip.kind,
      name: asset?.name ?? clip.assetId,
      startFrame: clip.startFrame,
      durationFrames: durationOf(clip.startFrame, clip.endFrame),
      sourceStartFrame: clip.trimStartFrame,
      sourceDurationFrames: Math.max(1, clip.trimEndFrame),
      src,
      assetId: clip.assetId,
      volume: clampVolume(clip.volume),
      opacity: 1,
      locked: false,
      disabled: false,
    };
    clipsByTrack[videoTrack.id].push(elahClip);
    projectionSnapshots[clip.id] = projectSnapshot(elahClip);
    mappedClipIds.push(clip.id);
  }

  for (const overlay of version.textOverlays) {
    const trackId = `inkframe-elements-${overlay.id}`;
    const track = createTrack(trackId, "Text", "elements", tracks.length);
    tracks.push(track);

    const elahClip: ElahClip = {
      id: overlay.id,
      trackId,
      type: "text",
      name: overlay.stylePreset === "classic" ? "Text" : `Preset · ${overlay.stylePreset}`,
      startFrame: overlay.startFrame,
      durationFrames: durationOf(overlay.startFrame, overlay.endFrame),
      sourceStartFrame: 0,
      sourceDurationFrames: durationOf(overlay.startFrame, overlay.endFrame),
      content: overlay.text,
      fontSize: overlay.fontSize,
      color: overlay.color,
      fontFamily: ELah_FONT_BY_INKFRAME[overlay.fontFamily],
      fontWeight: overlay.fontWeight >= 600 ? "bold" : "normal",
      textAlign: "center",
      volume: 1,
      opacity: 1,
      locked: false,
      disabled: false,
      transform: transformForOverlay(overlay),
    };
    clipsByTrack[trackId] = [elahClip];
    projectionSnapshots[overlay.id] = projectSnapshot(elahClip);
    mappedTextOverlayIds.push(overlay.id);

    if (overlay.stylePreset !== "classic") {
      diagnostics.push({
        code: "preset-projected-as-text",
        entityId: overlay.id,
        message: `Preset ${overlay.stylePreset} is shown as editable text in Elah; its canonical preset data remains in the sidecar.`,
      });
    }
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

    const trackId = `inkframe-audio-${audio.id}`;
    const track = createTrack(trackId, "Audio", "audio", tracks.length);
    tracks.push(track);
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
      opacity: 1,
      locked: false,
      disabled: false,
    };
    clipsByTrack[trackId] = [elahClip];
    projectionSnapshots[audio.id] = projectSnapshot(elahClip);
    mappedAudioTrackIds.push(audio.id);
  }

  const mappedVisualIds = new Set(mappedClipIds);
  const visualById = new Map(clipsByTrack[VIDEO_TRACK_ID].map((clip) => [clip.id, clip]));
  for (const transition of version.transitions) {
    if (
      !mappedVisualIds.has(transition.fromClipId) ||
      !mappedVisualIds.has(transition.toClipId)
    ) {
      continue;
    }

    const toClip = visualById.get(transition.toClipId);
    if (!toClip) continue;
    transitions.push({
      id: transition.id,
      kind: "fade",
      fromClipId: transition.fromClipId,
      toClipId: transition.toClipId,
      trackId: VIDEO_TRACK_ID,
      startFrame: toClip.startFrame - Math.floor(transition.durationInFrames / 2),
      durationFrames: Math.max(1, transition.durationInFrames),
      easing: "linear",
    });
    mappedTransitionIds.push(transition.id);
  }

  const preset = ASPECT_PRESETS[version.aspect];
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
  const nativeClips = flattenClips(project);
  const visualById = new Map<string, Clip>();
  const audioById = new Map<string, AudioTrack>();
  const textById = new Map<string, TextOverlay>();

  for (const native of nativeClips) {
    if (native.type === "video" || native.type === "image") {
      const original = canonicalClipById.get(native.id);
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
        id: native.id,
        assetId,
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
      audioById.set(native.id, {
        id: native.id,
        assetId,
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
      const syncMediaToTimelineEvents = original?.syncMediaToTimelineEvents;
      textById.set(native.id, {
        id: native.id,
        text: native.content ?? original?.text ?? "Text",
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
        fontSize: native.fontSize ?? original?.fontSize ?? 56,
        color: native.color ?? original?.color ?? "#ffffff",
        fontFamily,
        fontWeight,
        fontStyle: original?.fontStyle ?? "normal",
        stylePreset: original?.stylePreset ?? "classic",
        createdaleyTexture: original?.createdaleyTexture ?? "plain",
        ...(syncMediaToTimelineEvents !== undefined
          ? { syncMediaToTimelineEvents }
          : original
            ? {}
            : { syncMediaToTimelineEvents: false }),
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
      transition.kind !== "fade" ||
      !visualIds.has(transition.fromClipId) ||
      !visualIds.has(transition.toClipId)
    ) {
      diagnostics.push({
        code: "unsupported-elah-transition",
        entityId: transition.id,
        message: `Elah transition ${transition.id} cannot be represented as an Inkframe crossfade and was skipped.`,
      });
      continue;
    }
    transitionById.set(transition.id, {
      id: transition.id,
      type: "crossfade",
      fromClipId: transition.fromClipId,
      toClipId: transition.toClipId,
      durationInFrames: Math.max(1, Math.round(transition.durationFrames)),
    });
  }

  return {
    version: {
      aspect: canonical.aspect,
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
