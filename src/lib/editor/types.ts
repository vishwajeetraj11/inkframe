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
  "vox-timeline",
  "vox-timeline-ribbon",
  "vox-timeline-ledger",
  "vox-typography",
  "world-map-focus",
  "regional-map-focus",
  "film-frame-gallery",
  "editorial-bar-chart",
  "editorial-stat-ring",
  "editorial-seat-arc",
  "createdaley-opener",
  "chart-card",
  "news-clipping",
  "vox-pull-quote",
  "harris-marker",
  "harris-location",
] as const;
export type TextOverlayStylePreset = (typeof TEXT_OVERLAY_STYLE_PRESETS)[number];

export const VOX_TIMELINE_STYLE_PRESETS = [
  "vox-timeline",
  "vox-timeline-ribbon",
  "vox-timeline-ledger",
] as const satisfies readonly TextOverlayStylePreset[];
export type VoxTimelineStylePreset = (typeof VOX_TIMELINE_STYLE_PRESETS)[number];

export const isVoxTimelineStylePreset = (
  value: string,
): value is VoxTimelineStylePreset =>
  VOX_TIMELINE_STYLE_PRESETS.includes(value as VoxTimelineStylePreset);

export const CHART_CARD_STYLE_PRESETS = [
  "chart-card",
  "editorial-seat-arc",
] as const satisfies readonly TextOverlayStylePreset[];
export type ChartCardStylePreset = (typeof CHART_CARD_STYLE_PRESETS)[number];

export const isChartCardStylePreset = (
  value: string,
): value is ChartCardStylePreset =>
  CHART_CARD_STYLE_PRESETS.includes(value as ChartCardStylePreset);

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
  "vox-timeline": "Vox Timeline",
  "vox-timeline-ribbon": "Timeline Ribbon",
  "vox-timeline-ledger": "Timeline Ledger",
  "vox-typography": "Vox Typography",
  "world-map-focus": "World Map Focus",
  "regional-map-focus": "Regional Map Focus",
  "film-frame-gallery": "Film Frame Gallery",
  "editorial-bar-chart": "Editorial Bar Chart",
  "editorial-stat-ring": "Stat Ring Card",
  "editorial-seat-arc": "Editorial Seat Arc",
  "createdaley-opener": "Dictionary Animation",
  "chart-card": "Pie Chart Card",
  "news-clipping": "News Clipping",
  "vox-pull-quote": "Vox Pull Quote",
  "harris-marker": "Marker Headline",
  "harris-location": "Location Stamp",
};

export interface AssetRef {
  assetId: string;
  kind: AssetKind;
  mimeType: string;
  name: string;
  size: number;
  externalUrl?: string;
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
  syncMediaToTimelineEvents?: boolean;
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
