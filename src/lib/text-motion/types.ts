import type { AspectPreset } from "../editor/types";

export type TextMotionTemplate = "default" | "grid-kinetic" | "photo-card";

export type TextMotionAnimation =
  | "slide-up"
  | "slide-left"
  | "slide-right"
  | "pop"
  | "bounce"
  | "zoom-spin"
  | "glitch"
  | "wipe"
  | "typewriter"
  | "fade";
export type TextMotionFontFamily =
  | "sans"
  | "serif"
  | "mono"
  | "display"
  | "condensed"
  | "slab"
  | "modern";
export type TextMotionFontStyle = "normal" | "italic";

export interface TextMotionTheme {
  backgroundFrom: string;
  backgroundTo: string;
  textColor: string;
  accentColor: string;
}

export interface TextMotionScene {
  id: string;
  text: string;
  durationInFrames: number;
  animation: TextMotionAnimation;
  accentWord?: string;
  fontFamily: TextMotionFontFamily;
  fontWeight: number;
  fontStyle: TextMotionFontStyle;
  keepOnScreen?: boolean;
  imageAssetId?: string;
  imageScale?: number;
  imageOpacity?: number;
  imageX?: number;
  imageY?: number;
}

export interface TextMotionImageAsset {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface TextMotionProject {
  title: string;
  aspect: AspectPreset;
  template: TextMotionTemplate;
  theme: TextMotionTheme;
  imageAssets: TextMotionImageAsset[];
  scenes: TextMotionScene[];
}
