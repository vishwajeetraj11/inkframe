import { AbsoluteFill, useCurrentFrame } from "remotion";
import { renderPresetById } from "./preset-router";
import {
  renderChartCardPreset,
  renderCreatedaleyOpenerPreset,
  renderHarrisLocationPreset,
  renderHarrisMarkerPreset,
  renderVoxPullQuotePreset,
  renderEditorialBarChartPreset,
  renderEditorialSeatArcPreset,
  renderEditorialStatRingPreset,
  renderFilmFrameGalleryPreset,
  renderNewsClippingPreset,
  renderRegionalMapFocusPreset,
  renderVoxExplainerPreset,
  renderVoxTimelineLedgerPreset,
  renderVoxTimelinePreset,
  renderVoxTimelineRibbonPreset,
  renderVoxTypographyPreset,
  renderWorldMapFocusPreset,
} from "./editorial-presets";
import {
  OVERLAY_STYLE_PRESET_LABEL,
  getBaseTypographyAnimation,
} from "./shared";
import {
  renderClassicPreset,
  renderEditorialMonoPreset,
  renderGridKineticPreset,
  renderHeroSlamPreset,
  renderImpactGridPreset,
  renderStickerCutoutPreset,
} from "./text-presets";
import type { MotionTypographyLayerProps, PresetRendererProps } from "./types";

const PRESET_RENDERERS = {
  classic: renderClassicPreset,
  "impact-grid": renderImpactGridPreset,
  "grid-kinetic": renderGridKineticPreset,
  "hero-slam": renderHeroSlamPreset,
  "sticker-cutout": renderStickerCutoutPreset,
  "editorial-mono": renderEditorialMonoPreset,
  "vox-explainer": renderVoxExplainerPreset,
  "vox-timeline": renderVoxTimelinePreset,
  "vox-timeline-ribbon": renderVoxTimelineRibbonPreset,
  "vox-timeline-ledger": renderVoxTimelineLedgerPreset,
  "vox-typography": renderVoxTypographyPreset,
  "world-map-focus": renderWorldMapFocusPreset,
  "regional-map-focus": renderRegionalMapFocusPreset,
  "film-frame-gallery": renderFilmFrameGalleryPreset,
  "editorial-bar-chart": renderEditorialBarChartPreset,
  "editorial-stat-ring": renderEditorialStatRingPreset,
  "editorial-seat-arc": renderEditorialSeatArcPreset,
  "createdaley-opener": renderCreatedaleyOpenerPreset,
  "chart-card": renderChartCardPreset,
  "news-clipping": renderNewsClippingPreset,
  "vox-pull-quote": renderVoxPullQuotePreset,
  "harris-marker": renderHarrisMarkerPreset,
  "harris-location": renderHarrisLocationPreset,
} satisfies Partial<Record<keyof typeof OVERLAY_STYLE_PRESET_LABEL, (props: PresetRendererProps) => React.ReactNode>>;

export const MotionTypographyLayer = ({
  overlay,
  durationInFrames,
  aspect,
  hasMediaClips,
  activeMediaClipIndex,
  activeMediaClipStartFrame,
  activeMediaClipDurationInFrames,
  mediaClipCount,
}: MotionTypographyLayerProps) => {
  const frame = useCurrentFrame();
  const safeDuration = Math.max(1, Math.round(durationInFrames));
  const animation = getBaseTypographyAnimation(frame, safeDuration);
  const preset =
    overlay.stylePreset in OVERLAY_STYLE_PRESET_LABEL
      ? overlay.stylePreset
      : "classic";
  const props: PresetRendererProps = {
    overlay,
    durationInFrames,
    aspect,
    hasMediaClips,
    activeMediaClipIndex,
    activeMediaClipStartFrame,
    activeMediaClipDurationInFrames,
    mediaClipCount,
    frame,
    safeDuration,
    animation,
  };

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {renderPresetById(preset, PRESET_RENDERERS, renderClassicPreset, props)}
    </AbsoluteFill>
  );
};
