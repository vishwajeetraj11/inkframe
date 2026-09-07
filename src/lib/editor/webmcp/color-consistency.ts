import type { EditorContrastCheck } from "../export-state";
import type { Clip, TextOverlay, VersionTimeline, VideoFilter } from "../types";
import type { WeightedPaletteColor } from "../domain/frame-color-statistics";
import {
  sampleTimelineSourceFrames,
  type SourceColorAsset,
  type SourceFrameAnalysisReport,
  type SourceFrameAnalysisProgress,
} from "./source-frame-analysis";

export type ColorConsistencyIssue =
  | "exposure-drift"
  | "temperature-drift"
  | "tint-drift"
  | "saturation-drift"
  | "palette-drift"
  | "skin-tone-risk"
  | "changing-light"
  | "text-contrast";

export type ColorConsistencySeverity = "info" | "warning" | "error";

export interface ColorConsistencyFinding {
  findingId: string;
  targetType: "clip" | "textOverlay";
  targetId: string;
  issue: ColorConsistencyIssue;
  severity: ColorConsistencySeverity;
  metrics: Record<string, number>;
  recommendedAction:
    | "normalize"
    | "recolor-overlay"
    | "increase-contrast"
    | "review-manually";
}

export interface ColorConsistencyReport {
  aspect: VersionTimeline["aspect"];
  analyzedClipCount: number;
  analyzedOverlayCount: number;
  reference: {
    brightness: number;
    temperature: number;
    saturation: number;
    overlayColor?: string;
    sourceLuminance?: number;
    sourceExposure?: number;
    sourceTemperature?: number;
    sourceTint?: number;
    sourceSaturation?: number;
    sourcePalette?: WeightedPaletteColor[];
  };
  findings: ColorConsistencyFinding[];
  score: number;
  sourceAnalysis?: {
    analyzedClipCount: number;
    skippedClipCount: number;
    unreadableClipCount: number;
    cancelled: boolean;
    warnings: string[];
  };
}

export interface AnalyzeColorConsistencyInput {
  version: VersionTimeline;
  /** Optional frame-derived checks produced by analyzeFrameContrast. */
  contrastChecks?: readonly EditorContrastCheck[];
  /** Optional source-pixel evidence produced by sampleTimelineSourceFrames. */
  sourceFrameAnalysis?: SourceFrameAnalysisReport;
}

export interface AnalyzeColorConsistencyFromSourcesInput {
  version: VersionTimeline;
  assets: readonly SourceColorAsset[];
  contrastChecks?: readonly EditorContrastCheck[];
  signal?: AbortSignal;
  samplesPerClip?: number;
  maximumDimension?: number;
  onProgress?: (progress: SourceFrameAnalysisProgress) => void;
}

const NEUTRAL_FILTER: VideoFilter = {
  preset: "none",
  brightness: 1,
  contrast: 1,
  saturation: 1,
  sepia: 0,
  grayscale: 0,
  hueRotate: 0,
};

const round = (value: number, places = 3): number =>
  Number(value.toFixed(places));

const median = (values: readonly number[], fallback: number): number => {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? fallback) + (sorted[middle] ?? fallback)) / 2
    : (sorted[middle] ?? fallback);
};

const filterFor = (clip: Clip): VideoFilter => clip.videoFilter ?? NEUTRAL_FILTER;

const driftSeverity = (
  difference: number,
  warningThreshold: number,
  errorThreshold: number,
): ColorConsistencySeverity | null => {
  const absolute = Math.abs(difference);
  if (absolute >= errorThreshold) return "error";
  if (absolute >= warningThreshold) return "warning";
  return null;
};

const clipFinding = ({
  clip,
  issue,
  value,
  reference,
  warningThreshold,
  errorThreshold,
}: {
  clip: Clip;
  issue: Extract<ColorConsistencyIssue, "exposure-drift" | "temperature-drift" | "saturation-drift">;
  value: number;
  reference: number;
  warningThreshold: number;
  errorThreshold: number;
}): ColorConsistencyFinding | null => {
  const delta = value - reference;
  const severity = driftSeverity(delta, warningThreshold, errorThreshold);
  if (!severity) return null;
  return {
    findingId: `${issue}:${clip.id}`,
    targetType: "clip",
    targetId: clip.id,
    issue,
    severity,
    metrics: { value: round(value), reference: round(reference), delta: round(delta) },
    recommendedAction: "normalize",
  };
};

const normalizeHex = (value: string): string | null => {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
  return match ? `#${match[1].toLowerCase()}` : null;
};

const dominantOverlayColor = (overlays: readonly TextOverlay[]): string | undefined => {
  const counts = new Map<string, number>();
  for (const overlay of overlays) {
    const color = normalizeHex(overlay.color);
    if (color) counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return [...counts]
    .filter(([, count]) => count >= 2)
    .sort(([leftColor, leftCount], [rightColor, rightCount]) =>
      rightCount - leftCount || leftColor.localeCompare(rightColor),
    )[0]?.[0];
};

const colorDistance = (left: string, right: string): number => {
  const channels = (value: string): [number, number, number] => [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
  const [leftRed, leftGreen, leftBlue] = channels(left);
  const [rightRed, rightGreen, rightBlue] = channels(right);
  return Math.sqrt(
    (leftRed - rightRed) ** 2 +
      (leftGreen - rightGreen) ** 2 +
      (leftBlue - rightBlue) ** 2,
  ) / Math.sqrt(3 * 255 ** 2);
};

const paletteDistance = (
  left: readonly WeightedPaletteColor[],
  right: readonly WeightedPaletteColor[],
): number => {
  if (left.length === 0 || right.length === 0) return 0;
  const directional = (
    source: readonly WeightedPaletteColor[],
    target: readonly WeightedPaletteColor[],
  ): number => source.reduce((total, color) => {
    const closest = Math.min(...target.map((candidate) => colorDistance(color.hex, candidate.hex)));
    return total + closest * color.weight;
  }, 0) / Math.max(0.0001, source.reduce((total, color) => total + color.weight, 0));
  return (directional(left, right) + directional(right, left)) / 2;
};

const sourceClipFindings = (
  sourceAnalysis: SourceFrameAnalysisReport,
): {
  findings: ColorConsistencyFinding[];
  reference?: {
    luminance: number;
    exposure: number;
    temperature: number;
    tint: number;
    saturation: number;
    palette: WeightedPaletteColor[];
  };
} => {
  const analyzed = sourceAnalysis.clips.filter(
    (clip): clip is typeof clip & { aggregate: NonNullable<typeof clip.aggregate> } =>
      clip.status === "analyzed" && clip.aggregate !== undefined,
  );
  if (analyzed.length === 0) return { findings: [] };
  const reference = {
    luminance: median(analyzed.map((clip) => clip.aggregate.luminance), 0.18),
    exposure: median(analyzed.map((clip) => clip.aggregate.exposure), 0),
    temperature: median(analyzed.map((clip) => clip.aggregate.temperature), 0),
    tint: median(analyzed.map((clip) => clip.aggregate.tint), 0),
    saturation: median(analyzed.map((clip) => clip.aggregate.saturation), 0),
    palette: analyzed
      .sort((left, right) =>
        Math.abs(left.aggregate.exposure) - Math.abs(right.aggregate.exposure) ||
        left.clipId.localeCompare(right.clipId),
      )[0]?.aggregate.palette ?? [],
  };
  if (analyzed.length < 2) {
    return {
      reference,
      findings: analyzed.flatMap((clip): ColorConsistencyFinding[] =>
        clip.aggregate.lightingVariation >= 0.75
          ? [{
            findingId: `changing-light:${clip.clipId}`,
            targetType: "clip",
            targetId: clip.clipId,
            issue: "changing-light",
            severity: clip.aggregate.lightingVariation >= 1.25 ? "error" : "warning",
            metrics: { exposureRange: round(clip.aggregate.lightingVariation) },
            recommendedAction: "review-manually",
          }]
          : []),
    };
  }

  const findings: ColorConsistencyFinding[] = [];
  for (const clip of analyzed) {
    const aggregate = clip.aggregate;
    const candidates = [
      { issue: "exposure-drift" as const, value: aggregate.exposure, target: reference.exposure, warning: 0.35, error: 0.8 },
      { issue: "temperature-drift" as const, value: aggregate.temperature, target: reference.temperature, warning: 0.045, error: 0.1 },
      { issue: "tint-drift" as const, value: aggregate.tint, target: reference.tint, warning: 0.035, error: 0.08 },
      { issue: "saturation-drift" as const, value: aggregate.saturation, target: reference.saturation, warning: 0.12, error: 0.28 },
    ];
    for (const candidate of candidates) {
      const delta = candidate.value - candidate.target;
      const severity = driftSeverity(delta, candidate.warning, candidate.error);
      if (!severity) continue;
      findings.push({
        findingId: `${candidate.issue}:${clip.clipId}`,
        targetType: "clip",
        targetId: clip.clipId,
        issue: candidate.issue,
        severity,
        metrics: {
          value: round(candidate.value),
          reference: round(candidate.target),
          delta: round(delta),
          highlightLuminance: Math.max(...clip.frames.filter((frame) => frame.statistics.usable).map((frame) => frame.statistics.luminance.high), 0),
          lightingVariation: aggregate.lightingVariation,
          confidence: aggregate.confidence === "high" ? 1 : aggregate.confidence === "medium" ? 0.65 : 0.35,
        },
        recommendedAction: aggregate.confidence === "low" || aggregate.lightingVariation >= 0.75 || candidate.issue === "temperature-drift" || candidate.issue === "tint-drift"
          ? "review-manually" : "normalize",
      });
    }

    const distance = paletteDistance(aggregate.palette, reference.palette);
    const paletteSeverity = driftSeverity(distance, 0.2, 0.38);
    if (paletteSeverity) {
      findings.push({
        findingId: `palette-drift:${clip.clipId}`,
        targetType: "clip",
        targetId: clip.clipId,
        issue: "palette-drift",
        severity: paletteSeverity,
        metrics: { distance: round(distance) },
        recommendedAction: aggregate.confidence === "low" ? "review-manually" : "normalize",
      });
    }

    if (aggregate.lightingVariation >= 0.75) {
      findings.push({
        findingId: `changing-light:${clip.clipId}`,
        targetType: "clip",
        targetId: clip.clipId,
        issue: "changing-light",
        severity: aggregate.lightingVariation >= 1.25 ? "error" : "warning",
        metrics: { exposureRange: round(aggregate.lightingVariation) },
        recommendedAction: "review-manually",
      });
    }

    const chromaticRisk = Math.max(
      Math.abs(aggregate.temperature - reference.temperature) / 0.08,
      Math.abs(aggregate.tint - reference.tint) / 0.06,
      Math.abs(aggregate.saturation - reference.saturation) / 0.22,
    );
    if (aggregate.skinToneFraction >= 0.015 && chromaticRisk >= 1) {
      findings.push({
        findingId: `skin-tone-risk:${clip.clipId}`,
        targetType: "clip",
        targetId: clip.clipId,
        issue: "skin-tone-risk",
        severity: chromaticRisk >= 1.75 ? "error" : "warning",
        metrics: {
          skinTonePixelFraction: round(aggregate.skinToneFraction),
          chromaticRisk: round(chromaticRisk),
        },
        recommendedAction: "review-manually",
      });
    }
  }
  return { findings, reference };
};

const paletteFindings = (
  overlays: readonly TextOverlay[],
  referenceColor: string | undefined,
): ColorConsistencyFinding[] => {
  if (!referenceColor || overlays.length < 3) return [];
  return overlays.flatMap((overlay): ColorConsistencyFinding[] => {
    const color = normalizeHex(overlay.color);
    if (!color || color === referenceColor) return [];
    const distance = colorDistance(color, referenceColor);
    const severity = driftSeverity(distance, 0.35, 0.65);
    if (!severity) return [];
    return [{
      findingId: `palette-drift:${overlay.id}`,
      targetType: "textOverlay",
      targetId: overlay.id,
      issue: "palette-drift",
      severity,
      metrics: { distance: round(distance) },
      recommendedAction: "recolor-overlay",
    }];
  });
};

const contrastFindings = (
  overlays: readonly TextOverlay[],
  checks: readonly EditorContrastCheck[],
): ColorConsistencyFinding[] => {
  const overlaysById = new Map(overlays.map((overlay) => [overlay.id, overlay]));
  const worstCheckByOverlay = new Map<string, EditorContrastCheck>();
  for (const check of checks) {
    if (check.passes || !overlaysById.has(check.overlayId)) continue;
    const previous = worstCheckByOverlay.get(check.overlayId);
    if (!previous || check.contrastRatio < previous.contrastRatio) {
      worstCheckByOverlay.set(check.overlayId, check);
    }
  }
  return [...worstCheckByOverlay]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([overlayId, check]): ColorConsistencyFinding => ({
      findingId: `text-contrast:${overlayId}`,
      targetType: "textOverlay" as const,
      targetId: overlayId,
      issue: "text-contrast" as const,
      severity: check.contrastRatio < check.minimumRatio * 0.67 ? "error" : "warning",
      metrics: {
        contrastRatio: round(check.contrastRatio, 2),
        minimumRatio: round(check.minimumRatio, 2),
        sampledBackgroundLuminance: round(check.sampledBackgroundLuminance, 4),
      },
      recommendedAction: overlaysById.get(overlayId)?.contrast === "outline"
        ? "review-manually" as const
        : "increase-contrast" as const,
    }));
};

export const analyzeColorConsistency = ({
  version,
  contrastChecks = [],
  sourceFrameAnalysis,
}: AnalyzeColorConsistencyInput): ColorConsistencyReport => {
  const clips = version.clips;
  const filters = clips.map(filterFor);
  const reference = {
    brightness: median(filters.map((filter) => filter.brightness), 1),
    temperature: median(filters.map((filter) => filter.hueRotate), 0),
    saturation: median(filters.map((filter) => filter.saturation), 1),
    overlayColor: dominantOverlayColor(version.textOverlays),
  };

  const source = sourceFrameAnalysis
    ? sourceClipFindings(sourceFrameAnalysis)
    : undefined;
  const findings: ColorConsistencyFinding[] = source?.findings ?? [];
  if (!sourceFrameAnalysis && clips.length >= 2) {
    for (const clip of clips) {
      const filter = filterFor(clip);
      const candidates = [
        clipFinding({ clip, issue: "exposure-drift", value: filter.brightness, reference: reference.brightness, warningThreshold: 0.08, errorThreshold: 0.2 }),
        clipFinding({ clip, issue: "temperature-drift", value: filter.hueRotate, reference: reference.temperature, warningThreshold: 6, errorThreshold: 15 }),
        clipFinding({ clip, issue: "saturation-drift", value: filter.saturation, reference: reference.saturation, warningThreshold: 0.15, errorThreshold: 0.4 }),
      ];
      findings.push(...candidates.filter((finding): finding is ColorConsistencyFinding => finding !== null));
    }
  }

  findings.push(
    ...paletteFindings(version.textOverlays, reference.overlayColor),
    ...contrastFindings(version.textOverlays, contrastChecks),
  );

  const penalty = findings.reduce(
    (total, finding) => total + (finding.severity === "error" ? 15 : finding.severity === "warning" ? 7 : 2),
    0,
  );

  return {
    aspect: version.aspect,
    analyzedClipCount: clips.length,
    analyzedOverlayCount: version.textOverlays.length,
    reference: {
      brightness: round(reference.brightness),
      temperature: round(reference.temperature),
      saturation: round(reference.saturation),
      ...(reference.overlayColor ? { overlayColor: reference.overlayColor } : {}),
      ...(source?.reference
        ? {
          sourceLuminance: round(source.reference.luminance),
          sourceExposure: round(source.reference.exposure),
          sourceTemperature: round(source.reference.temperature),
          sourceTint: round(source.reference.tint),
          sourceSaturation: round(source.reference.saturation),
          sourcePalette: source.reference.palette,
        }
        : {}),
    },
    findings,
    score: Math.max(0, 100 - penalty),
    ...(sourceFrameAnalysis
      ? {
        sourceAnalysis: {
          analyzedClipCount: sourceFrameAnalysis.analyzedClipCount,
          skippedClipCount: sourceFrameAnalysis.skippedClipCount,
          unreadableClipCount: sourceFrameAnalysis.unreadableClipCount,
          cancelled: sourceFrameAnalysis.cancelled,
          warnings: sourceFrameAnalysis.warnings,
        },
      }
      : {}),
  };
};

/** Browser-only convenience API. The synchronous analyzer remains available for existing callers. */
export const analyzeColorConsistencyFromSources = async ({
  version,
  assets,
  contrastChecks = [],
  signal,
  samplesPerClip,
  maximumDimension,
  onProgress,
}: AnalyzeColorConsistencyFromSourcesInput): Promise<ColorConsistencyReport> => {
  const sourceFrameAnalysis = await sampleTimelineSourceFrames({
    version,
    assets,
    signal,
    ...(samplesPerClip === undefined ? {} : { samplesPerClip }),
    ...(maximumDimension === undefined ? {} : { maximumDimension }),
    ...(onProgress === undefined ? {} : { onProgress }),
  });
  if (sourceFrameAnalysis.analyzedClipCount === 0) {
    const fallback = analyzeColorConsistency({ version, contrastChecks });
    return {
      ...fallback,
      sourceAnalysis: {
        analyzedClipCount: 0,
        skippedClipCount: sourceFrameAnalysis.skippedClipCount,
        unreadableClipCount: sourceFrameAnalysis.unreadableClipCount,
        cancelled: sourceFrameAnalysis.cancelled,
        warnings: sourceFrameAnalysis.warnings,
      },
    };
  }
  return analyzeColorConsistency({ version, contrastChecks, sourceFrameAnalysis });
};

export type {
  ClipSourceColorAggregate,
  ClipSourceColorAnalysis,
  SampledSourceFrame,
  SourceColorAsset,
  SourceFrameAnalysisReport,
  SourceFrameAnalysisProgress,
} from "./source-frame-analysis";
