import type { ClipKeyframes } from "./keyframes";
import type { TimeMapping } from "./time-mapping";
import type { CaptionCue } from "./captions";
import type { AudioDuckingRule } from "./audio-ducking";

export type AspectPreset = "reel_9_16" | "widescreen_16_9";

export type AssetKind = "video" | "image" | "audio";

export const TEXT_OVERLAY_FONT_FAMILIES = [
  "sans",
  "modern",
  "serif",
  "cursive",
  "mono",
  "display",
  "editorial",
  "rounded",
] as const;
export type TextOverlayFontFamily = (typeof TEXT_OVERLAY_FONT_FAMILIES)[number];

export const TEXT_OVERLAY_FONT_STYLES = ["normal", "italic"] as const;
export type TextOverlayFontStyle = (typeof TEXT_OVERLAY_FONT_STYLES)[number];

export const TEXT_OVERLAY_ALIGNMENTS = ["left", "center", "right"] as const;
export type TextOverlayAlignment = (typeof TEXT_OVERLAY_ALIGNMENTS)[number];

export const TEXT_OVERLAY_STYLE_PRESETS = [
  "classic",
] as const;
export type TextOverlayStylePreset = (typeof TEXT_OVERLAY_STYLE_PRESETS)[number];

export interface AssetRef {
  assetId: string;
  kind: AssetKind;
  mimeType: string;
  name: string;
  size: number;
  externalUrl?: string;
  mediaMetadata?: { durationUs: number; width?: number; height?: number };
  attribution?: {
    provider: "pexels" | "mixkit" | "freesound";
    sourceUrl: string;
    creatorName: string;
    creatorUrl: string;
    licenseName?: string;
    licenseUrl?: string;
    attributionRequired?: boolean;
  };
}

/** Elah-compatible transform. Positions/anchor are stage fractions, rotation is
 * radians and scale multiplies source pixels. Omission retains automatic fit. */
export interface ClipTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  anchor: { x: number; y: number };
}

export const VIDEO_FILTER_PRESETS = [
  "none",
  "cinematic",
  "warm",
  "cool",
  "vintage",
  "mono",
] as const;
export type VideoFilterPreset = (typeof VIDEO_FILTER_PRESETS)[number];

/** Source-relative mask; x/y are the center, width/height the full extent.
 * Feather fades inward from the boundary as a fraction of the mask radius. */
export interface SelectiveColorRegion {
  id: string;
  shape: "ellipse" | "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  feather: number;
  inverted?: boolean;
  exposure: number;
  temperature: number;
  tint: number;
  saturation: number;
}

export interface VideoFilter {
  preset: VideoFilterPreset | "custom";
  brightness: number;
  contrast: number;
  saturation: number;
  sepia: number;
  grayscale: number;
  hueRotate: number;
  /** Additive grading; omission is neutral for older projects. */
  exposure?: number; // -2..2 stops in linear light
  temperature?: number; // -1..1; positive warms
  tint?: number; // -1..1; positive adds magenta
  shadows?: number; // -1..1
  highlights?: number; // -1..1
  toneCurve?: "linear" | "filmic";
  /** Up to eight ordered, source-relative creative SDR adjustments. */
  selectiveRegions?: SelectiveColorRegion[];
}

export interface Clip {
  id: string;
  assetId: string;
  /** Persistent timeline lane. Older projects are assigned to the default video lane. */
  trackId?: string;
  kind: "video" | "image";
  startFrame: number;
  endFrame: number;
  trimStartFrame: number;
  trimEndFrame: number;
  volume: number;
  transform?: ClipTransform;
  opacity?: number;
  /** Export-safe color treatment applied identically in preview and MP4 rendering. */
  videoFilter?: VideoFilter;
  keyframes?: ClipKeyframes;
  timeMapping?: TimeMapping;
  /** Verified source bound retained for pure reducer validation. */
  sourceDurationUs?: number;
}

export interface TextOverlay {
  id: string;
  /** Persistent timeline lane. Older projects are assigned to the default text lane. */
  trackId?: string;
  text: string;
  startFrame: number;
  endFrame: number;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: TextOverlayFontFamily;
  fontWeight: number;
  fontStyle: TextOverlayFontStyle;
  textAlign?: TextOverlayAlignment;
  stylePreset: TextOverlayStylePreset;
  /** Optional export-safe edge treatment for text placed over variable footage. */
  contrast?: "outline";
  /** Browser-native text motion rendered by Inkframe's Elah compatibility layer. */
  animation?: TextOverlayAnimation;
}

export const TEXT_OVERLAY_ANIMATION_KINDS = [
  "fade",
  "rise",
  "slide-left",
  "punch",
  "typewriter",
  "word-reveal",
] as const;
export type TextOverlayAnimationKind =
  (typeof TEXT_OVERLAY_ANIMATION_KINDS)[number];

export interface TextOverlayAnimation {
  in?: TextOverlayAnimationKind;
  out?: TextOverlayAnimationKind;
  durationFrames: number;
}

export interface AudioTrack {
  id: string;
  assetId: string;
  /** Persistent timeline lane. Older projects are assigned to the default audio lane. */
  trackId?: string;
  startFrame: number;
  endFrame: number;
  trimStartFrame: number;
  trimEndFrame: number;
  volume: number;
  /** Audio clip fades are retained in Inkframe; Elah 0.4.1 has no clip fade fields. */
  fadeInFrames?: number;
  fadeOutFrames?: number;
  muted?: boolean;
}

export interface Transition {
  id: string;
  /** Native transition kind. `type: "crossfade"` is the legacy persisted form. */
  kind?: "fade" | "slide" | "wipe";
  type?: "crossfade";
  durationInFrames: number;
  fromClipId: string;
  toClipId: string;
  direction?: "left" | "right" | "up" | "down";
  easing?: "linear" | "ease-in" | "ease-out";
}

export const EDITOR_TRACK_KINDS = ["video", "text", "audio", "caption"] as const;
export type EditorTrackKind = (typeof EDITOR_TRACK_KINDS)[number];

/** A persistent, user-visible lane in the browser-native Elah timeline. */
export interface EditorTrack {
  id: string;
  kind: EditorTrackKind;
  name: string;
  order: number;
}

export interface VersionTimeline {
  aspect: AspectPreset;
  /** Optional only for compatibility with projects created before persistent lanes. */
  tracks?: EditorTrack[];
  clips: Clip[];
  textOverlays: TextOverlay[];
  audioTracks: AudioTrack[];
  transitions: Transition[];
  captionCues?: CaptionCue[];
  duckingRules?: AudioDuckingRule[];
}

export interface VersionMap {
  reel_9_16: VersionTimeline;
  widescreen_16_9: VersionTimeline;
}

export interface ProjectCutdown {
  id: string;
  name: string;
  sourceAspect: AspectPreset;
  durationFrames: number;
  timeline: VersionTimeline;
}

export interface ProjectSession {
  /** Project content format; independent of the IndexedDB storage layout. */
  contentVersion?: 1;
  activeVersion: AspectPreset;
  /** Selected derived version. Omitted for the full-duration aspect master. */
  activeCutdownId?: string;
  versions: VersionMap;
  /** Derived edits retained alongside the two full-duration masters. */
  cutdowns?: ProjectCutdown[];
}

export interface ExportProject extends ProjectSession {
  assets: AssetRef[];
}
