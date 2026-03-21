import {
  isChartCardStylePreset,
  isVoxTimelineStylePreset,
  type TextOverlayStylePreset,
  type VoxTimelineStylePreset,
  type ChartCardStylePreset,
} from "../types";

/**
 * Type guards for grouping presets by category
 * These enable type narrowing and reduce string comparisons throughout the codebase
 */

export const isMapPreset = (preset: TextOverlayStylePreset): boolean =>
  preset === "world-map-focus" || preset === "regional-map-focus";

export const isEditorialPreset = (preset: TextOverlayStylePreset): boolean =>
  preset === "editorial-mono" ||
  preset === "editorial-bar-chart" ||
  preset === "editorial-stat-ring" ||
  preset === "editorial-seat-arc";

export const isCreatedaleyPreset = (preset: TextOverlayStylePreset): preset is "createdaley-opener" =>
  preset === "createdaley-opener";

export const isTextMotionPreset = (
  preset: TextOverlayStylePreset,
): preset is VoxTimelineStylePreset | ChartCardStylePreset =>
  isVoxTimelineStylePreset(preset) || isChartCardStylePreset(preset);

export const requiresMinimalDuration = (preset: TextOverlayStylePreset): boolean =>
  preset === "news-clipping" ||
  preset === "editorial-stat-ring" ||
  preset === "vox-timeline" ||
  preset === "vox-timeline-ribbon" ||
  preset === "vox-timeline-ledger" ||
  preset === "regional-map-focus" ||
  isCreatedaleyPreset(preset);

export const hasCustomInspector = (preset: TextOverlayStylePreset): boolean =>
  isMapPreset(preset) ||
  isEditorialPreset(preset) ||
  isCreatedaleyPreset(preset) ||
  isTextMotionPreset(preset);
