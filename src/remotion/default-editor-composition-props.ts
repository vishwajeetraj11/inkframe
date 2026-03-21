import { createEmptyVersionTimeline } from "@/lib/editor/defaults";
import type { AspectPreset } from "@/lib/editor/types";
import type { EditorCompositionProps } from "./EditorComposition";

export const createDefaultEditorCompositionProps = (
  aspect: AspectPreset,
): EditorCompositionProps => ({
  version: createEmptyVersionTimeline(aspect),
  assetSources: {},
  renderMode: "render",
});
