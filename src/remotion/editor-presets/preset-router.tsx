import type { TextOverlayStylePreset } from "@/lib/editor/types";
import type { ReactNode } from "react";
import type { PresetRendererProps } from "./types";

export const renderPresetById = (
  presetId: TextOverlayStylePreset,
  renderers: Partial<Record<TextOverlayStylePreset, (props: PresetRendererProps) => ReactNode>>,
  fallback: (props: PresetRendererProps) => ReactNode,
  props: PresetRendererProps,
): ReactNode => {
  const renderer = renderers[presetId] ?? fallback;
  return renderer(props);
};
