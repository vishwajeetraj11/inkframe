import type { ReactNode } from "react";
import type { AspectPreset, TextOverlayStylePreset, VersionTimeline } from "@/lib/editor/types";

export type RenderMode = "preview" | "render";

export interface MotionTypographyAnimation {
  baseOpacity: number;
  baseTranslateY: number;
  baseScale: number;
  baseRotate: number;
  blur: number;
}

export interface MotionTypographyLayerProps {
  overlay: VersionTimeline["textOverlays"][number];
  durationInFrames: number;
  aspect: AspectPreset;
  hasMediaClips: boolean;
}

export interface PresetRendererProps extends MotionTypographyLayerProps {
  frame: number;
  safeDuration: number;
  animation: MotionTypographyAnimation;
}

export interface PresetBackdropProps {
  aspect: AspectPreset;
  hasMediaClips: boolean;
  overlays: VersionTimeline["textOverlays"];
}

export interface PresetDefinition {
  id: TextOverlayStylePreset;
  render: (props: PresetRendererProps) => ReactNode;
}
