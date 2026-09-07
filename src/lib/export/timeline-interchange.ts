import { ASPECT_PRESETS, FPS } from "@/lib/editor/constants";
import { buildDuckingEnvelope, type GainPoint } from "@/lib/editor/audio-ducking";
import type { ClipKeyframes } from "@/lib/editor/keyframes";
import type { TimeMapping } from "@/lib/editor/time-mapping";
import {
  defaultTrackIdForKind,
  ensureEditorTracks,
} from "@/lib/editor/tracks";
import type {
  AssetKind,
  AssetRef,
  ClipTransform,
  EditorTrackKind,
  TextOverlayAlignment,
  TextOverlayFontFamily,
  TextOverlayFontStyle,
  TextOverlayAnimation,
  Transition,
  VersionTimeline,
} from "@/lib/editor/types";

export type ExportDiagnosticSeverity = "warning" | "error";

export interface ExportDiagnostic {
  severity: ExportDiagnosticSeverity;
  code: string;
  message: string;
  itemId?: string;
}

export interface InterchangeAsset {
  id: string;
  kind: AssetKind;
  name: string;
  mimeType: string;
  uri?: string;
  durationFrames?: number;
  width?: number;
  height?: number;
}

export type InterchangeItemKind =
  | "video"
  | "image"
  | "audio"
  | "title"
  | "caption";

export interface InterchangeTitleStyle {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: TextOverlayFontFamily;
  fontWeight: number;
  fontStyle: TextOverlayFontStyle;
  textAlign: TextOverlayAlignment;
  contrast?: "outline";
}

export interface InterchangeItem {
  id: string;
  kind: InterchangeItemKind;
  laneId: string;
  name: string;
  recordIn: number;
  recordOut: number;
  sourceIn: number;
  sourceOut: number;
  assetId?: string;
  text?: string;
  volume?: number;
  muted?: boolean;
  fadeInFrames?: number;
  fadeOutFrames?: number;
  gainEnvelope?: GainPoint[];
  transform?: ClipTransform;
  opacity?: number;
  keyframes?: ClipKeyframes;
  timeMapping?: TimeMapping;
  titleStyle?: InterchangeTitleStyle;
  titleAnimation?: TextOverlayAnimation;
}

export interface InterchangeLane {
  id: string;
  kind: EditorTrackKind;
  name: string;
  order: number;
  items: InterchangeItem[];
}

export interface InterchangeTransition {
  id: string;
  kind: "fade" | "slide" | "wipe";
  durationFrames: number;
  fromItemId: string;
  toItemId: string;
}

export interface InterchangeTimeline {
  name: string;
  fps: number;
  width: number;
  height: number;
  durationFrames: number;
  assets: InterchangeAsset[];
  lanes: InterchangeLane[];
  transitions: InterchangeTransition[];
  diagnostics: ExportDiagnostic[];
}

export interface BuildInterchangeTimelineOptions {
  version: VersionTimeline;
  assets: readonly AssetRef[];
  name?: string;
}

const byPlacement = (left: InterchangeItem, right: InterchangeItem) =>
  left.recordIn - right.recordIn ||
  left.recordOut - right.recordOut ||
  left.id.localeCompare(right.id);

const normalizedTransitionKind = (
  transition: Transition,
): InterchangeTransition["kind"] => transition.kind ?? "fade";

const isDurableMediaUri = (value: string | undefined): value is string => {
  if (!value) return false;
  try {
    return ["file:", "http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

/**
 * Projects an Inkframe version into an editor-neutral, frame-accurate timeline.
 * The projection is pure and never repairs invalid source data; such data is
 * retained where possible and reported through diagnostics.
 */
export const buildInterchangeTimeline = ({
  version,
  assets,
  name = "Inkframe Timeline",
}: BuildInterchangeTimelineOptions): InterchangeTimeline => {
  const preset = ASPECT_PRESETS[version.aspect];
  const diagnostics: ExportDiagnostic[] = [];
  const assetById = new Map(assets.map((asset) => [asset.assetId, asset]));
  const referencedAssetIds = new Set<string>();
  const laneItems = new Map<string, InterchangeItem[]>();

  const addItem = (laneId: string, item: InterchangeItem) => {
    const current = laneItems.get(laneId) ?? [];
    current.push(item);
    laneItems.set(laneId, current);
    if (item.assetId) referencedAssetIds.add(item.assetId);
    if (item.recordIn < 0 || item.recordOut <= item.recordIn) {
      diagnostics.push({
        severity: "error",
        code: "INVALID_RECORD_RANGE",
        message: `Item ${item.id} has an invalid record range.`,
        itemId: item.id,
      });
    }
    if (item.sourceIn < 0 || item.sourceOut <= item.sourceIn) {
      diagnostics.push({
        severity: "error",
        code: "INVALID_SOURCE_RANGE",
        message: `Item ${item.id} has an invalid source range.`,
        itemId: item.id,
      });
    }
  };

  for (const clip of version.clips) {
    const laneId = clip.trackId ?? defaultTrackIdForKind("video");
    addItem(laneId, {
      id: clip.id,
      kind: clip.kind,
      laneId,
      name: assetById.get(clip.assetId)?.name ?? clip.id,
      recordIn: clip.startFrame,
      recordOut: clip.endFrame,
      sourceIn: clip.trimStartFrame,
      sourceOut: clip.trimEndFrame,
      assetId: clip.assetId,
      ...(clip.kind === "video"
        ? {
            volume: clip.volume,
            muted: clip.volume <= 0,
            gainEnvelope: buildDuckingEnvelope(version, { kind: "video", id: clip.id }),
          }
        : {}),
      ...(clip.transform ? { transform: clip.transform } : {}),
      ...(clip.opacity !== undefined ? { opacity: clip.opacity } : {}),
      ...(clip.keyframes ? { keyframes: clip.keyframes } : {}),
      ...(clip.timeMapping ? { timeMapping: clip.timeMapping } : {}),
    });
    const lossyClipFeatures: Array<[unknown, string, string]> = [
      [clip.videoFilter, "VIDEO_FILTER_APPROXIMATED", "video filter"],
    ];
    for (const [present, code, feature] of lossyClipFeatures) {
      if (!present) continue;
      diagnostics.push({
        severity: "warning",
        code,
        message: `The ${feature} on ${clip.id} may not survive interchange.`,
        itemId: clip.id,
      });
    }
  }

  for (const audio of version.audioTracks) {
    const laneId = audio.trackId ?? defaultTrackIdForKind("audio");
    addItem(laneId, {
      id: audio.id,
      kind: "audio",
      laneId,
      name: assetById.get(audio.assetId)?.name ?? audio.id,
      recordIn: audio.startFrame,
      recordOut: audio.endFrame,
      sourceIn: audio.trimStartFrame,
      sourceOut: audio.trimEndFrame,
      assetId: audio.assetId,
      volume: audio.volume,
      muted: audio.muted || audio.volume <= 0,
      fadeInFrames: audio.fadeInFrames ?? 0,
      fadeOutFrames: audio.fadeOutFrames ?? 0,
      gainEnvelope: buildDuckingEnvelope(version, { kind: "audio", id: audio.id }),
    });
  }

  for (const title of version.textOverlays) {
    const laneId = title.trackId ?? defaultTrackIdForKind("text");
    addItem(laneId, {
      id: title.id,
      kind: "title",
      laneId,
      name: title.text.slice(0, 40) || title.id,
      recordIn: title.startFrame,
      recordOut: title.endFrame,
      sourceIn: 0,
      sourceOut: title.endFrame - title.startFrame,
      text: title.text,
      titleStyle: {
        x: title.x,
        y: title.y,
        fontSize: title.fontSize,
        color: title.color,
        fontFamily: title.fontFamily,
        fontWeight: title.fontWeight,
        fontStyle: title.fontStyle,
        textAlign: title.textAlign ?? "center",
        ...(title.contrast ? { contrast: title.contrast } : {}),
      },
      ...(title.animation ? { titleAnimation: title.animation } : {}),
    });
  }

  for (const caption of version.captionCues ?? []) {
    addItem(caption.trackId, {
      id: caption.id,
      kind: "caption",
      laneId: caption.trackId,
      name: caption.text.slice(0, 40) || caption.id,
      recordIn: caption.startFrame,
      recordOut: caption.endFrame,
      sourceIn: 0,
      sourceOut: caption.endFrame - caption.startFrame,
      text: caption.text,
    });
  }
  for (const assetId of referencedAssetIds) {
    if (!assetById.has(assetId)) {
      diagnostics.push({
        severity: "error",
        code: "MISSING_ASSET",
        message: `Referenced asset ${assetId} is unavailable.`,
        itemId: assetId,
      });
    }
  }
  for (const lane of laneItems.values()) {
    for (const item of lane) {
      if (!item.assetId) continue;
      const asset = assetById.get(item.assetId);
      const compatible =
        !asset ||
        (item.kind === "audio" && asset.kind === "audio") ||
        (item.kind === "video" && asset.kind === "video") ||
        (item.kind === "image" && asset.kind === "image");
      if (!compatible) {
        diagnostics.push({
          severity: "error",
          code: "ASSET_KIND_MISMATCH",
          message: `Item ${item.id} is ${item.kind} but asset ${asset?.assetId ?? item.assetId} is ${asset?.kind}.`,
          itemId: item.id,
        });
      }
    }
  }

  const projectedAssets: InterchangeAsset[] = [...referencedAssetIds]
    .map((assetId) => assetById.get(assetId))
    .filter((asset): asset is AssetRef => asset !== undefined)
    .map((asset) => ({
      id: asset.assetId,
      kind: asset.kind,
      name: asset.name,
      mimeType: asset.mimeType,
      uri: isDurableMediaUri(asset.externalUrl) ? asset.externalUrl : undefined,
      durationFrames: asset.mediaMetadata
        ? Math.ceil((asset.mediaMetadata.durationUs * FPS) / 1_000_000)
        : undefined,
      width: asset.mediaMetadata?.width,
      height: asset.mediaMetadata?.height,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  for (const asset of assets) {
    if (referencedAssetIds.has(asset.assetId) && asset.externalUrl && !isDurableMediaUri(asset.externalUrl)) {
      diagnostics.push({
        severity: "warning",
        code: "NON_DURABLE_ASSET_URI",
        message: `Asset ${asset.name} has a non-durable media URL and will be exported as offline media.`,
        itemId: asset.assetId,
      });
    }
  }

  const tracks = ensureEditorTracks(version);
  const knownTrackIds = new Set(tracks.map((track) => track.id));
  const implicitTracks = [...laneItems.keys()]
    .filter((id) => !knownTrackIds.has(id))
    .sort()
    .map((id, index) => {
      const first = laneItems.get(id)?.[0];
      const kind: EditorTrackKind =
        first?.kind === "audio"
          ? "audio"
          : first?.kind === "title"
            ? "text"
            : first?.kind === "caption"
              ? "caption"
            : "video";
      diagnostics.push({
        severity: "warning",
        code: "IMPLICIT_LANE",
        message: `Lane ${id} was not declared and was inferred as ${kind}.`,
        itemId: id,
      });
      return { id, kind, name: id, order: tracks.length + index };
    });

  const lanes = [...tracks, ...implicitTracks]
    .map((track) => ({
      ...track,
      items: [...(laneItems.get(track.id) ?? [])].sort(byPlacement),
    }))
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));

  const itemIds = new Set(lanes.flatMap((lane) => lane.items.map((item) => item.id)));
  const transitions = version.transitions
    .map((transition) => ({
      id: transition.id,
      kind: normalizedTransitionKind(transition),
      durationFrames: transition.durationInFrames,
      fromItemId: transition.fromClipId,
      toItemId: transition.toClipId,
    }))
    .filter((transition) => {
      const valid =
        itemIds.has(transition.fromItemId) && itemIds.has(transition.toItemId);
      if (!valid) {
        diagnostics.push({
          severity: "error",
          code: "ORPHANED_TRANSITION",
          message: `Transition ${transition.id} references a missing clip.`,
          itemId: transition.id,
        });
      }
      return valid;
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  for (const transition of version.transitions) {
    if (normalizedTransitionKind(transition) !== "fade") {
      diagnostics.push({
        severity: "warning",
        code: "NON_FADE_TRANSITION_APPROXIMATED",
        message: `${normalizedTransitionKind(transition)} transition ${transition.id} requires target-specific approximation.`,
        itemId: transition.id,
      });
    }
    if (transition.direction || (transition.easing && transition.easing !== "linear")) {
      diagnostics.push({
        severity: "warning",
        code: "TRANSITION_METADATA_APPROXIMATED",
        message: `Direction or easing on ${transition.id} may not survive interchange.`,
        itemId: transition.id,
      });
    }
  }

  const durationFrames = Math.max(
    0,
    ...lanes.flatMap((lane) => lane.items.map((item) => item.recordOut)),
  );

  return {
    name,
    fps: preset.fps,
    width: preset.width,
    height: preset.height,
    durationFrames,
    assets: projectedAssets,
    lanes,
    transitions,
    diagnostics,
  };
};
