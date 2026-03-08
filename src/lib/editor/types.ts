export type AspectPreset = "reel_9_16" | "widescreen_16_9";

export type AssetKind = "video" | "image" | "audio";

export const TEXT_OVERLAY_FONT_FAMILIES = [
  "sans",
  "serif",
  "cursive",
  "mono",
] as const;
export type TextOverlayFontFamily = (typeof TEXT_OVERLAY_FONT_FAMILIES)[number];

export const TEXT_OVERLAY_FONT_STYLES = ["normal", "italic"] as const;
export type TextOverlayFontStyle = (typeof TEXT_OVERLAY_FONT_STYLES)[number];

export const TEXT_OVERLAY_STYLE_PRESETS = [
  "classic",
  "impact-grid",
  "grid-kinetic",
  "hero-slam",
  "sticker-cutout",
  "editorial-mono",
  "vox-explainer",
  "vox-typography",
  "world-map-focus",
  "editorial-bar-chart",
  "editorial-stat-ring",
  "createdaley-opener",
  "chart-card",
  "news-clipping",
] as const;
export type TextOverlayStylePreset = (typeof TEXT_OVERLAY_STYLE_PRESETS)[number];

export const CREATEDALEY_OPENER_TEXTURES = [
  "plain",
  "dots",
  "grid-dots",
  "newsprint-grain",
  "warm-editorial",
] as const;
export type CreatedaleyOpenerTexture =
  (typeof CREATEDALEY_OPENER_TEXTURES)[number];

export const CREATEDALEY_OPENER_TEXTURE_LABELS: Record<
  CreatedaleyOpenerTexture,
  string
> = {
  plain: "Plain",
  dots: "Dots",
  "grid-dots": "Grid + Dots",
  "newsprint-grain": "Newsprint Grain",
  "warm-editorial": "Warm Editorial",
};

export const TEXT_OVERLAY_STYLE_PRESET_LABELS: Record<TextOverlayStylePreset, string> = {
  classic: "Classic",
  "impact-grid": "Impact Grid",
  "grid-kinetic": "Grid Kinetic",
  "hero-slam": "Hero Slam",
  "sticker-cutout": "Sticker Cutout",
  "editorial-mono": "Editorial Mono",
  "vox-explainer": "Vox Explainer",
  "vox-typography": "Vox Typography",
  "world-map-focus": "World Map Focus",
  "editorial-bar-chart": "Editorial Bar Chart",
  "editorial-stat-ring": "Stat Ring Card",
  "createdaley-opener": "Createdaley Opener",
  "chart-card": "Pie Chart Card",
  "news-clipping": "News Clipping",
};

export interface AssetRef {
  assetId: string;
  kind: AssetKind;
  mimeType: string;
  name: string;
  size: number;
}

export interface Clip {
  id: string;
  assetId: string;
  kind: "video" | "image";
  startFrame: number;
  endFrame: number;
  trimStartFrame: number;
  trimEndFrame: number;
  volume: number;
}

export interface TextOverlay {
  id: string;
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
  stylePreset: TextOverlayStylePreset;
  createdaleyTexture: CreatedaleyOpenerTexture;
}

export interface AudioTrack {
  id: string;
  assetId: string;
  startFrame: number;
  endFrame: number;
  trimStartFrame: number;
  trimEndFrame: number;
  volume: number;
}

export interface Transition {
  id: string;
  type: "crossfade";
  durationInFrames: number;
  fromClipId: string;
  toClipId: string;
}

export interface VersionTimeline {
  aspect: AspectPreset;
  clips: Clip[];
  textOverlays: TextOverlay[];
  audioTracks: AudioTrack[];
  transitions: Transition[];
}

export interface VersionMap {
  reel_9_16: VersionTimeline;
  widescreen_16_9: VersionTimeline;
}

export interface ProjectSession {
  activeVersion: AspectPreset;
  versions: VersionMap;
}

export interface ExportProject extends ProjectSession {
  assets: AssetRef[];
}
