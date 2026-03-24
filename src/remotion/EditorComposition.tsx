import { buildRenderTrack } from "@/lib/editor/timeline";
import { parseVoxTimelineText } from "@/lib/editor/vox-timeline";
import {
  isChartCardStylePreset,
  isVoxTimelineStylePreset,
  type VersionTimeline,
} from "@/lib/editor/types";
import { AbsoluteFill, Audio, Sequence, useCurrentFrame } from "remotion";
import {
  ClipLayer,
  MissingAsset,
  MotionTypographyLayer,
  NewsCrumpleTexture,
} from "./editor-presets/layers";
import type { RenderMode } from "./editor-presets/types";

export interface EditorCompositionProps extends Record<string, unknown> {
  version: VersionTimeline;
  assetSources: Record<string, string>;
  renderMode: RenderMode;
}

interface BackdropFlags {
  hasMediaClips: boolean;

  hasNewsClippingOverlay: boolean;
  hasTextOverlays: boolean;
  showNewsBackdrop: boolean;
  showChartCardBackdrop: boolean;
  showCreatedaleyBackdrop: boolean;
  showEditorialBarBackdrop: boolean;
  showEditorialStatRingBackdrop: boolean;
  showGridKineticBackdrop: boolean;
  showRegionalMapFocusBackdrop: boolean;
  showVoxExplainerBackdrop: boolean;
  showVoxTimelineBackdrop: boolean;
  showVoxTypographyBackdrop: boolean;
  showWorldMapFocusBackdrop: boolean;
}

const DEFAULT_EMPTY_TEXT_BACKGROUND =
  "radial-gradient(circle at 30% 20%, #2d3748, #111827)";

const PAPER_BACKGROUND =
  "radial-gradient(circle at 14% 9%, rgba(255, 255, 255, 0.52), rgba(255, 255, 255, 0) 36%)," +
  "radial-gradient(circle at 85% 78%, rgba(133, 103, 72, 0.18), rgba(133, 103, 72, 0) 44%)," +
  "repeating-linear-gradient(0deg, rgba(89, 79, 62, 0.2) 0 1.25px, transparent 1.25px 86px)," +
  "repeating-linear-gradient(90deg, rgba(89, 79, 62, 0.2) 0 1.25px, transparent 1.25px 86px)," +
  "linear-gradient(160deg, #f4eddc 0%, #e8ddc6 55%, #d6c7ad 100%)";
const VOX_BACKGROUND =
  "radial-gradient(circle at 14% 16%, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0) 28%)," +
  "radial-gradient(circle at 84% 18%, rgba(214, 161, 23, 0.18), rgba(214, 161, 23, 0) 26%)," +
  "radial-gradient(circle at 72% 74%, rgba(87, 64, 26, 0.2), rgba(87, 64, 26, 0) 30%)," +
  "linear-gradient(145deg, #f6f0e4 0%, #e9dcc7 58%, #d7c3a2 100%)";
const VOX_TYPOGRAPHY_BACKGROUND =
  "radial-gradient(circle at 18% 18%, rgba(255, 246, 92, 0.12), rgba(255, 246, 92, 0) 18%)," +
  "radial-gradient(circle at 78% 20%, rgba(117, 197, 199, 0.16), rgba(117, 197, 199, 0) 24%)," +
  "radial-gradient(circle at 50% 80%, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.42) 100%)," +
  "linear-gradient(160deg, #06080b 0%, #111417 52%, #0a0d10 100%)";
const GRID_KINETIC_BACKGROUND =
  "radial-gradient(circle at 66% 34%, rgba(46, 247, 155, 0.22), rgba(46, 247, 155, 0) 22%)," +
  "radial-gradient(circle at 104% 4%, rgba(46, 247, 155, 0.2), rgba(46, 247, 155, 0) 24%)," +
  "linear-gradient(115deg, #020505 0%, #06120d 46%, #0b2117 100%)";
const WORLD_MAP_BACKGROUND =
  "radial-gradient(circle at 18% 16%, rgba(77, 190, 255, 0.16), rgba(77, 190, 255, 0) 22%)," +
  "radial-gradient(circle at 82% 78%, rgba(22, 107, 163, 0.14), rgba(22, 107, 163, 0) 24%)," +
  "linear-gradient(145deg, #050b12 0%, #0b1520 54%, #060d15 100%)";
const REGIONAL_MAP_BACKGROUND =
  "radial-gradient(circle at 16% 14%, rgba(255, 255, 255, 0.48), rgba(255, 255, 255, 0) 22%)," +
  "radial-gradient(circle at 82% 76%, rgba(156, 119, 73, 0.14), rgba(156, 119, 73, 0) 24%)," +
  "linear-gradient(160deg, #f2ebdd 0%, #e4dcc8 44%, #cfd5c4 100%)";
const EDITORIAL_BAR_BACKGROUND =
  "radial-gradient(circle at 14% 9%, rgba(255, 255, 255, 0.52), rgba(255, 255, 255, 0) 36%)," +
  "repeating-linear-gradient(0deg, rgba(96, 102, 109, 0.08) 0 1px, transparent 1px 84px)," +
  "repeating-linear-gradient(90deg, rgba(96, 102, 109, 0.08) 0 1px, transparent 1px 84px)," +
  "linear-gradient(160deg, #f3f1e7 0%, #eceae0 56%, #e4e1d5 100%)";
const EDITORIAL_STAT_RING_BACKGROUND = "linear-gradient(180deg, #efe9cf 0%, #ece5ca 100%)";
const CREATEDALEY_BACKGROUND =
  "radial-gradient(circle at 18% 18%, rgba(120, 78, 138, 0.22), rgba(120, 78, 138, 0) 26%)," +
  "radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 18%)," +
  "linear-gradient(150deg, #17151c 0%, #0a0a0f 54%, #17111b 100%)";
const CHART_BACKGROUND =
  "radial-gradient(circle at 18% 14%, rgba(255, 255, 255, 0.62), rgba(255, 255, 255, 0) 28%)," +
  "radial-gradient(circle at 82% 20%, rgba(188, 198, 210, 0.12), rgba(188, 198, 210, 0) 30%)," +
  "repeating-linear-gradient(0deg, rgba(102, 116, 132, 0.09) 0 1px, transparent 1px 96px)," +
  "repeating-linear-gradient(90deg, rgba(102, 116, 132, 0.09) 0 1px, transparent 1px 126px)," +
  "linear-gradient(160deg, #f8f5ed 0%, #f1ece2 54%, #e8dfd1 100%)";

const getBackdropFlags = (
  version: VersionTimeline,
  trackEntryCount: number,
): BackdropFlags => {
  const noMediaClips = trackEntryCount === 0;
  const hasMediaClips = trackEntryCount > 0;

  // Build preset detection flags in a single pass
  const overlayPresetFlags: Record<string, boolean> = {};
  for (const overlay of version.textOverlays) {
    const preset = overlay.stylePreset;
    if (preset === "news-clipping") overlayPresetFlags.hasNewsClippingOverlay = true;
    if (preset === "vox-explainer") overlayPresetFlags.hasVoxExplainerOverlay = true;
    if (preset === "vox-typography") overlayPresetFlags.hasVoxTypographyOverlay = true;
    if (isVoxTimelineStylePreset(preset)) overlayPresetFlags.hasVoxTimelineOverlay = true;
    if (preset === "grid-kinetic") overlayPresetFlags.hasGridKineticOverlay = true;
    if (preset === "world-map-focus") overlayPresetFlags.hasWorldMapFocusOverlay = true;
    if (preset === "regional-map-focus") overlayPresetFlags.hasRegionalMapFocusOverlay = true;
    if (preset === "editorial-bar-chart") overlayPresetFlags.hasEditorialBarOverlay = true;
    if (preset === "editorial-stat-ring") overlayPresetFlags.hasEditorialStatRingOverlay = true;
    if (preset === "createdaley-opener") overlayPresetFlags.hasCreatedaleyOpenerOverlay = true;
    if (isChartCardStylePreset(preset)) overlayPresetFlags.hasChartCardOverlay = true;
  }

  const hasNewsClippingOverlay = overlayPresetFlags.hasNewsClippingOverlay || false;
  const hasVoxExplainerOverlay = overlayPresetFlags.hasVoxExplainerOverlay || false;
  const hasVoxTypographyOverlay = overlayPresetFlags.hasVoxTypographyOverlay || false;
  const hasVoxTimelineOverlay = overlayPresetFlags.hasVoxTimelineOverlay || false;
  const hasGridKineticOverlay = overlayPresetFlags.hasGridKineticOverlay || false;
  const hasWorldMapFocusOverlay = overlayPresetFlags.hasWorldMapFocusOverlay || false;
  const hasRegionalMapFocusOverlay = overlayPresetFlags.hasRegionalMapFocusOverlay || false;
  const hasEditorialBarOverlay = overlayPresetFlags.hasEditorialBarOverlay || false;
  const hasEditorialStatRingOverlay = overlayPresetFlags.hasEditorialStatRingOverlay || false;
  const hasCreatedaleyOpenerOverlay = overlayPresetFlags.hasCreatedaleyOpenerOverlay || false;
  const hasChartCardOverlay = overlayPresetFlags.hasChartCardOverlay || false;

  return {
    hasMediaClips,
    hasNewsClippingOverlay,
    hasTextOverlays: version.textOverlays.length > 0,
    showNewsBackdrop: noMediaClips && hasNewsClippingOverlay,
    showChartCardBackdrop: noMediaClips && hasChartCardOverlay,
    showCreatedaleyBackdrop: noMediaClips && hasCreatedaleyOpenerOverlay,
    showEditorialBarBackdrop: noMediaClips && hasEditorialBarOverlay,
    showEditorialStatRingBackdrop: noMediaClips && hasEditorialStatRingOverlay,
    showGridKineticBackdrop: noMediaClips && hasGridKineticOverlay,
    showRegionalMapFocusBackdrop: noMediaClips && hasRegionalMapFocusOverlay,
    showVoxExplainerBackdrop: noMediaClips && hasVoxExplainerOverlay,
    showVoxTimelineBackdrop: noMediaClips && hasVoxTimelineOverlay,
    showVoxTypographyBackdrop: noMediaClips && hasVoxTypographyOverlay,
    showWorldMapFocusBackdrop: noMediaClips && hasWorldMapFocusOverlay,
  };
};

const BACKDROP_MAP: Array<[keyof BackdropFlags, string]> = [
  ["hasNewsClippingOverlay", PAPER_BACKGROUND],
  ["showGridKineticBackdrop", GRID_KINETIC_BACKGROUND],
  ["showWorldMapFocusBackdrop", WORLD_MAP_BACKGROUND],
  ["showRegionalMapFocusBackdrop", REGIONAL_MAP_BACKGROUND],
  ["showEditorialBarBackdrop", EDITORIAL_BAR_BACKGROUND],
  ["showEditorialStatRingBackdrop", EDITORIAL_STAT_RING_BACKGROUND],
  ["showCreatedaleyBackdrop", CREATEDALEY_BACKGROUND],
  ["showChartCardBackdrop", CHART_BACKGROUND],
  ["showVoxTimelineBackdrop", VOX_BACKGROUND],
  ["showVoxTypographyBackdrop", VOX_TYPOGRAPHY_BACKGROUND],
  ["showVoxExplainerBackdrop", VOX_BACKGROUND],
];

const getCompositionBackground = (flags: BackdropFlags): string => {
  for (const [flagKey, background] of BACKDROP_MAP) {
    if (flags[flagKey]) {
      return background;
    }
  }
  return "black";
};

const getEventDrivenTimelineOverlay = (version: VersionTimeline) =>
  version.textOverlays.find(
    (overlay) =>
      isVoxTimelineStylePreset(overlay.stylePreset) &&
      overlay.syncMediaToTimelineEvents,
  ) ?? null;

const buildEventDrivenMediaSegments = ({
  overlay,
  trackDurationInFrames,
  clipCount,
}: {
  overlay: VersionTimeline["textOverlays"][number];
  trackDurationInFrames: number;
  clipCount: number;
}) => {
  if (clipCount === 0 || trackDurationInFrames <= 0) {
    return [];
  }

  const { events } = parseVoxTimelineText(overlay.text);
  const overlayStart = Math.max(0, overlay.startFrame);
  const overlayEnd = Math.min(
    trackDurationInFrames,
    Math.max(overlayStart + 1, overlay.endFrame),
  );
  const safeDuration = Math.max(1, overlayEnd - overlayStart);
  const introFrames = Math.min(42, Math.max(24, Math.round(safeDuration * 0.18)));
  const outroFrames = Math.min(18, Math.max(10, Math.round(safeDuration * 0.1)));
  const eventWindow = Math.max(1, safeDuration - introFrames - outroFrames);
  const segmentFrames = eventWindow / Math.max(1, events.length);
  const boundaries = Array.from({ length: events.length + 1 }, (_, index) => {
    if (index === 0) {
      return overlayStart;
    }

    if (index === events.length) {
      return overlayEnd;
    }

    return overlayStart + Math.round(introFrames + segmentFrames * index);
  });
  const segments: Array<{
    clipEntryIndex: number;
    startFrame: number;
    durationInFrames: number;
  }> = [];

  if (overlayStart > 0) {
    segments.push({
      clipEntryIndex: 0,
      startFrame: 0,
      durationInFrames: overlayStart,
    });
  }

  events.forEach((_, index) => {
    const startFrame = boundaries[index] ?? overlayStart;
    const endFrame = boundaries[index + 1] ?? overlayEnd;

    if (endFrame <= startFrame) {
      return;
    }

    segments.push({
      clipEntryIndex: Math.min(index, clipCount - 1),
      startFrame,
      durationInFrames: endFrame - startFrame,
    });
  });

  if (overlayEnd < trackDurationInFrames) {
    segments.push({
      clipEntryIndex: Math.max(0, clipCount - 1),
      startFrame: overlayEnd,
      durationInFrames: trackDurationInFrames - overlayEnd,
    });
  }

  return segments;
};

const BackdropOverlays = ({
  frame,
  flags,
  showEmptyState,
}: {
  frame: number;
  flags: BackdropFlags;
  showEmptyState: boolean;
}) => {
  const paperDriftX = Math.sin(frame / 56) * 16;
  const paperDriftY = Math.cos(frame / 74) * 11;
  const paperCounterX = Math.sin(frame / 61 + 1.2) * -12;
  const paperCounterY = Math.cos(frame / 83 + 0.8) * 9;
  const grainShiftX = Math.sin(frame / 11) * 5;
  const grainShiftY = Math.cos(frame / 14) * 4;
  const multiplyOpacity = 0.62 + Math.sin(frame / 52) * 0.08;
  const softLightOpacity = 0.27 + Math.cos(frame / 63) * 0.06;
  const dotOpacity = 0.2 + Math.sin(frame / 40 + 0.6) * 0.05;
  const sweepCycleFrames = 150;
  const sweepT = (frame % sweepCycleFrames) / sweepCycleFrames;
  const sweepX = -260 + sweepT * 520;
  const sweepOpacity = 0.32 + Math.sin(frame / 48) * 0.06;
  const showDefaultTextBackdrop =
    !flags.hasMediaClips &&
    flags.hasTextOverlays &&
    !flags.hasNewsClippingOverlay &&
    !flags.showGridKineticBackdrop &&
    !flags.showWorldMapFocusBackdrop &&
    !flags.showRegionalMapFocusBackdrop &&
    !flags.showEditorialBarBackdrop &&
    !flags.showEditorialStatRingBackdrop &&
    !flags.showCreatedaleyBackdrop &&
    !flags.showChartCardBackdrop &&
    !flags.showVoxTimelineBackdrop &&
    !flags.showVoxTypographyBackdrop &&
    !flags.showVoxExplainerBackdrop;

  return (
    <>
      {flags.showNewsBackdrop ? (
        <AbsoluteFill style={{ background: "transparent" }}>
          <NewsCrumpleTexture
            style={{
              opacity: multiplyOpacity,
              mixBlendMode: "multiply",
              pointerEvents: "none",
              transform: `translate(${paperDriftX}px, ${paperDriftY}px) scale(1.028)`,
            }}
          />
          <NewsCrumpleTexture
            style={{
              opacity: softLightOpacity,
              mixBlendMode: "soft-light",
              pointerEvents: "none",
              transform: `translate(${paperCounterX}px, ${paperCounterY}px) scale(1.02)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.08) 1px, transparent 1.1px)",
              backgroundSize: "7px 7px",
              backgroundPosition: `${grainShiftX}px ${grainShiftY}px`,
              opacity: dotOpacity,
              mixBlendMode: "multiply",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(105deg, transparent 42%, rgba(255, 248, 216, 0.16) 50%, rgba(255, 248, 216, 0.06) 58%, transparent 66%)",
              mixBlendMode: "soft-light",
              opacity: sweepOpacity,
              pointerEvents: "none",
              transform: `translateX(${sweepX}px)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 48% 52%, rgba(255, 255, 255, 0) 0%, rgba(59, 45, 26, 0.07) 100%)",
              opacity: 0.32,
              mixBlendMode: "multiply",
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      ) : null}

      {flags.showCreatedaleyBackdrop ? (
        <AbsoluteFill style={{ background: "transparent" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 24% 20%, rgba(122, 87, 139, 0.18), rgba(122, 87, 139, 0) 24%)," +
                "radial-gradient(circle at 74% 24%, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 18%)," +
                "radial-gradient(circle at 50% 70%, rgba(0, 0, 0, 0.46), rgba(0, 0, 0, 0) 42%)",
              pointerEvents: "none",
            }}
          />
          <NewsCrumpleTexture
            style={{
              opacity: 0.08,
              mixBlendMode: "soft-light",
              pointerEvents: "none",
              transform: `translate(${paperCounterX}px, ${paperCounterY}px) scale(1.02)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0) 38%, rgba(0, 0, 0, 0.42) 100%)",
              opacity: 0.78,
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      ) : null}

      {flags.showGridKineticBackdrop ? (
        <AbsoluteFill style={{ background: "transparent" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 48px)," +
                "repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 48px)",
              opacity: 0.45,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, rgba(0, 0, 0, 0.42) 0%, rgba(0, 0, 0, 0.08) 46%, rgba(0, 0, 0, 0.18) 100%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: "-8% -4% -8% 40%",
              background:
                "linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(46, 247, 155, 0.2) 46%, rgba(0, 0, 0, 0) 100%)",
              filter: "blur(56px)",
              transform: `translateX(${Math.sin(frame / 32) * 18}px)`,
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      ) : null}

      {flags.showWorldMapFocusBackdrop ? (
        <AbsoluteFill style={{ background: "transparent" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(0deg, rgba(146, 173, 198, 0.08) 0 1px, transparent 1px 76px)," +
                "repeating-linear-gradient(90deg, rgba(146, 173, 198, 0.08) 0 1px, transparent 1px 76px)",
              opacity: 0.44,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(141, 171, 196, 0.09) 1px, transparent 1.1px)",
              backgroundSize: "10px 10px",
              backgroundPosition: `${grainShiftX}px ${grainShiftY}px`,
              opacity: 0.18,
              mixBlendMode: "screen",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 24% 18%, rgba(77, 190, 255, 0.14), rgba(77, 190, 255, 0) 26%)," +
                "radial-gradient(circle at 72% 68%, rgba(16, 104, 161, 0.14), rgba(16, 104, 161, 0) 28%)," +
                "radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0) 34%, rgba(0, 0, 0, 0.4) 100%)",
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      ) : null}

      {flags.showEditorialBarBackdrop ? (
        <AbsoluteFill style={{ background: "transparent" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(0deg, rgba(96, 102, 109, 0.07) 0 1px, transparent 1px 84px)," +
                "repeating-linear-gradient(90deg, rgba(96, 102, 109, 0.07) 0 1px, transparent 1px 84px)",
              opacity: 0.56,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(74, 82, 91, 0.06) 1px, transparent 1.1px)",
              backgroundSize: "9px 9px",
              backgroundPosition: `${grainShiftX}px ${grainShiftY}px`,
              opacity: 0.18,
              mixBlendMode: "multiply",
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      ) : null}

      {flags.showEditorialStatRingBackdrop ? (
        <AbsoluteFill style={{ background: "transparent" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(55, 42, 28, 0.05) 0.65px, transparent 0.9px)",
              backgroundSize: "16px 16px",
              opacity: 0.12,
              mixBlendMode: "multiply",
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      ) : null}

      {flags.showChartCardBackdrop ? (
        <AbsoluteFill style={{ background: "transparent" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(0deg, rgba(110, 122, 136, 0.08) 0 1px, transparent 1px 96px)," +
                "repeating-linear-gradient(90deg, rgba(110, 122, 136, 0.08) 0 1px, transparent 1px 126px)",
              opacity: 0.55,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(75, 85, 99, 0.06) 1px, transparent 1.1px)",
              backgroundSize: "9px 9px",
              backgroundPosition: `${grainShiftX}px ${grainShiftY}px`,
              opacity: 0.2,
              mixBlendMode: "multiply",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 28% 18%, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0) 24%)," +
                "radial-gradient(circle at 78% 68%, rgba(115, 131, 153, 0.08), rgba(115, 131, 153, 0) 24%)",
              opacity: 0.72,
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      ) : null}

      {flags.showVoxExplainerBackdrop ? (
        <AbsoluteFill style={{ background: "transparent" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(35, 24, 7, 0.08) 1px, transparent 1.1px)",
              backgroundSize: "9px 9px",
              opacity: 0.18,
              mixBlendMode: "multiply",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(0deg, rgba(88, 62, 24, 0.08) 0 1px, transparent 1px 82px)," +
                "repeating-linear-gradient(90deg, rgba(88, 62, 24, 0.06) 0 1px, transparent 1px 96px)",
              opacity: 0.42,
              mixBlendMode: "multiply",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 76% 22%, rgba(214, 161, 23, 0.16), rgba(214, 161, 23, 0) 20%)," +
                "radial-gradient(circle at 24% 72%, rgba(31, 41, 55, 0.08), rgba(31, 41, 55, 0) 26%)",
              opacity: 0.8,
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      ) : null}

      {!showEmptyState && showDefaultTextBackdrop ? (
        <AbsoluteFill style={{ background: DEFAULT_EMPTY_TEXT_BACKGROUND }} />
      ) : null}
    </>
  );
};

export const EditorComposition = ({
  version,
  assetSources,
  renderMode,
}: EditorCompositionProps) => {
  const frame = useCurrentFrame();
  const track = buildRenderTrack(version);
  const eventDrivenTimelineOverlay = getEventDrivenTimelineOverlay(version);
  const eventDrivenMediaSegments = eventDrivenTimelineOverlay
    ? buildEventDrivenMediaSegments({
        overlay: eventDrivenTimelineOverlay,
        trackDurationInFrames: track.durationInFrames,
        clipCount: track.entries.length,
      })
    : [];
  const flags = getBackdropFlags(version, track.entries.length);
  const showEmptyState = track.entries.length === 0 && !flags.hasTextOverlays;
  const enableFilmFrameGalleryMotion = version.textOverlays.some(
    (overlay) =>
      overlay.stylePreset === "film-frame-gallery" &&
      frame >= overlay.startFrame &&
      frame < overlay.endFrame,
  );

  return (
    <AbsoluteFill
      style={{
        background: getCompositionBackground(flags),
      }}
    >
      <BackdropOverlays
        frame={frame}
        flags={flags}
        showEmptyState={showEmptyState}
      />

      {showEmptyState ? (
        <AbsoluteFill
          style={{
            background: DEFAULT_EMPTY_TEXT_BACKGROUND,
            color: "#ffffff",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 46,
            fontWeight: 700,
          }}
        >
          Upload media to begin
        </AbsoluteFill>
      ) : null}

      {eventDrivenMediaSegments.length > 0
        ? eventDrivenMediaSegments.map((segment) => {
            const entry = track.entries[segment.clipEntryIndex];

            if (!entry) {
              return null;
            }

            const source = assetSources[entry.clip.assetId];

            return (
              <Sequence
                key={`${entry.clip.id}-event-segment-${segment.startFrame}`}
                from={segment.startFrame}
                durationInFrames={segment.durationInFrames}
              >
                {source ? (
                  <ClipLayer
                    clip={entry.clip}
                    src={source}
                    durationInFrames={segment.durationInFrames}
                    fadeInFrames={0}
                    fadeOutFrames={0}
                    renderMode={renderMode}
                    enableFilmFrameGalleryMotion={enableFilmFrameGalleryMotion}
                  />
                ) : (
                  <MissingAsset assetId={entry.clip.assetId} />
                )}
              </Sequence>
            );
          })
        : track.entries.map((entry) => {
            const source = assetSources[entry.clip.assetId];

            return (
              <Sequence
                key={entry.clip.id}
                from={entry.startFrame}
                durationInFrames={entry.durationInFrames}
              >
                {source ? (
                  <ClipLayer
                    clip={entry.clip}
                    src={source}
                    durationInFrames={entry.durationInFrames}
                    fadeInFrames={entry.fadeInFrames}
                    fadeOutFrames={entry.fadeOutFrames}
                    renderMode={renderMode}
                    enableFilmFrameGalleryMotion={enableFilmFrameGalleryMotion}
                  />
                ) : (
                  <MissingAsset assetId={entry.clip.assetId} />
                )}
              </Sequence>
            );
          })}

      {version.audioTracks.map((trackItem) => {
        const source = assetSources[trackItem.assetId];
        const duration = Math.max(1, trackItem.endFrame - trackItem.startFrame);

        if (!source) {
          return null;
        }

        return (
          <Sequence
            key={trackItem.id}
            from={trackItem.startFrame}
            durationInFrames={duration}
          >
            <Audio
              src={source}
              startFrom={trackItem.trimStartFrame}
              endAt={trackItem.trimEndFrame}
              volume={trackItem.volume}
            />
          </Sequence>
        );
      })}

      {version.textOverlays.map((overlay) => {
        const duration = Math.max(1, overlay.endFrame - overlay.startFrame);
        const usesEventDrivenTimelineMedia =
          isVoxTimelineStylePreset(overlay.stylePreset) &&
          Boolean(overlay.syncMediaToTimelineEvents);
        const activeTrackEntryIndex = track.entries.findIndex(
          (entry) =>
            frame >= entry.startFrame &&
            frame < entry.startFrame + entry.durationInFrames,
        );
        const activeTrackEntry =
          activeTrackEntryIndex >= 0 ? track.entries[activeTrackEntryIndex] : null;

        return (
          <Sequence
            key={overlay.id}
            from={overlay.startFrame}
            durationInFrames={duration}
          >
            <MotionTypographyLayer
              overlay={overlay}
              durationInFrames={duration}
              aspect={version.aspect}
              hasMediaClips={track.entries.length > 0}
              activeMediaClipIndex={
                usesEventDrivenTimelineMedia
                  ? undefined
                  : activeTrackEntryIndex >= 0
                    ? activeTrackEntryIndex
                    : undefined
              }
              activeMediaClipStartFrame={
                usesEventDrivenTimelineMedia
                  ? undefined
                  : activeTrackEntry
                    ? Math.max(0, activeTrackEntry.startFrame - overlay.startFrame)
                    : undefined
              }
              activeMediaClipDurationInFrames={activeTrackEntry?.durationInFrames}
              mediaClipCount={track.entries.length}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
