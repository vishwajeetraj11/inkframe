import type { Clip, VersionTimeline } from "../types";
import { sampleTimelineSourceFrames } from "./source-frame-analysis";
import {
  analyzeColorConsistency,
  analyzeColorConsistencyFromSources,
  type ColorConsistencyFinding,
  type ColorConsistencyReport,
  type SourceColorAsset,
  type SourceFrameAnalysisProgress,
} from "./color-consistency";

type VideoFilter = NonNullable<Clip["videoFilter"]>;

export type ColorFindingIssue = ColorConsistencyFinding["issue"];

export interface ColorWorkflowFinding {
  findingId: string;
  targetType: "clip";
  targetId: string;
  issue: ColorFindingIssue;
  severity: "info" | "warning" | "error";
  metrics: Record<string, number>;
  recommendedAction: ColorConsistencyFinding["recommendedAction"];
  message: string;
}

export interface ColorWorkflowChange {
  changeId: string;
  candidate: true;
  targetType: "clip";
  targetId: string;
  reason: string;
  before: { videoFilter: VideoFilter };
  after: { videoFilter: VideoFilter };
  reversible: true;
  risk: "low" | "medium";
}

export interface ColorWorkflowInspection {
  analysisMode: "source-frames" | "timeline-filter-state";
  pixelAnalysisAvailable: boolean;
  aspect: VersionTimeline["aspect"];
  reference: {
    mode: "median-source-frames" | "median-filter-state";
    clipId?: string;
    metrics: ColorConsistencyReport["reference"];
  };
  findings: ColorWorkflowFinding[];
  summary: {
    clipsAnalyzed: number;
    clipsWithDrift: number;
    highConfidenceFindings: number;
    skippedClips: number;
    unreadableClips: number;
    cancelled: boolean;
    score: number;
  };
  warnings: string[];
}

export interface ColorWorkflowProposal {
  candidateOnly: true;
  requiresVisualReview: true;
  inspection: ColorWorkflowInspection;
  changes: ColorWorkflowChange[];
}

export interface ColorWorkflowPreview {
  mode: "structured-filter-preview";
  changeIds: string[];
  requiresPerChangeDecision: true;
  changes: ColorWorkflowChange[];
  representativeFrames: Array<{ clipId: string; frame: number }>;
  warnings: string[];
}

export interface InspectColorConsistencyFromSourcesInput {
  version: VersionTimeline;
  assets: readonly SourceColorAsset[];
  clipIds?: readonly string[];
  signal?: AbortSignal;
  samplesPerClip?: number;
  maximumDimension?: number;
  onProgress?: (progress: SourceFrameAnalysisProgress) => void;
}

export interface ProposeColorCorrectionsFromSourcesInput extends InspectColorConsistencyFromSourcesInput {
  findingIds?: readonly string[];
}

const identityFilter = (): VideoFilter => ({
  preset: "none",
  brightness: 1,
  contrast: 1,
  saturation: 1,
  sepia: 0,
  grayscale: 0,
  hueRotate: 0,
});

const effectiveFilter = (clip: Clip): VideoFilter => ({
  ...identityFilter(),
  ...(clip.videoFilter ?? {}),
});

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const round = (value: number): number => Number(value.toFixed(3));

const scopedVersion = (
  version: VersionTimeline,
  clipIds?: readonly string[],
): VersionTimeline => clipIds?.length
  ? { ...version, clips: version.clips.filter((clip) => clipIds.includes(clip.id)) }
  : version;

const findingMessage = (finding: ColorConsistencyFinding): string => {
  switch (finding.issue) {
    case "exposure-drift": return "Source exposure differs from the sequence reference.";
    case "temperature-drift": return "This shot is warmer or cooler than others; lighting and subject color may explain the difference, not a white-balance fault.";
    case "tint-drift": return "This shot has a different green-magenta balance; visual evidence is needed before changing it.";
    case "saturation-drift": return "Color intensity differs between shots; this may be intentional scene content.";
    case "palette-drift": return "The dominant source palette differs from the sequence reference.";
    case "skin-tone-risk": return "Skin-tone-like pixels may be affected by this chromatic correction.";
    case "changing-light": return "Lighting changes within this clip, so one correction may not fit the shot.";
    case "text-contrast": return "Text contrast falls below the configured readability target.";
  }
};

const toInspection = (
  report: ColorConsistencyReport,
  sourceRequested: boolean,
): ColorWorkflowInspection => {
  const sourceAvailable = (report.sourceAnalysis?.analyzedClipCount ?? 0) > 0;
  const findings = report.findings
    .filter((finding): finding is ColorConsistencyFinding & { targetType: "clip" } => finding.targetType === "clip")
    .map((finding): ColorWorkflowFinding => ({
      ...finding,
      targetType: "clip",
      severity: sourceAvailable && ["temperature-drift", "tint-drift", "saturation-drift", "palette-drift"].includes(finding.issue) ? "info" : finding.severity,
      message: findingMessage(finding),
    }));
  const warnings = [
    ...(report.sourceAnalysis?.warnings ?? []),
    ...(sourceRequested && !sourceAvailable
      ? ["No browser-readable source frames were available; results use deterministic clip filter metadata."]
      : []),
    ...(!sourceRequested
      ? ["Source media was unavailable; results use deterministic clip filter metadata."]
      : []),
  ];
  return {
    analysisMode: sourceAvailable ? "source-frames" : "timeline-filter-state",
    pixelAnalysisAvailable: sourceAvailable,
    aspect: report.aspect,
    reference: {
      mode: sourceAvailable ? "median-source-frames" : "median-filter-state",
      metrics: report.reference,
    },
    findings,
    summary: {
      clipsAnalyzed: sourceAvailable
        ? report.sourceAnalysis?.analyzedClipCount ?? 0
        : report.analyzedClipCount,
      clipsWithDrift: new Set(findings.map((finding) => finding.targetId)).size,
      highConfidenceFindings: findings.filter((finding) =>
        finding.recommendedAction === "normalize" && (finding.metrics.confidence ?? 1) >= 0.65,
      ).length,
      skippedClips: report.sourceAnalysis?.skippedClipCount ?? 0,
      unreadableClips: report.sourceAnalysis?.unreadableClipCount ?? 0,
      cancelled: report.sourceAnalysis?.cancelled ?? false,
      score: report.score,
    },
    warnings: [...new Set(warnings)],
  };
};

export const inspectColorConsistency = (
  version: VersionTimeline,
  clipIds?: readonly string[],
): ColorWorkflowInspection => {
  const selected = scopedVersion(version, clipIds);
  return toInspection(analyzeColorConsistency({ version: selected }), false);
};

export const inspectColorConsistencyFromSources = async ({
  version,
  assets,
  clipIds,
  signal,
  samplesPerClip,
  maximumDimension,
  onProgress,
}: InspectColorConsistencyFromSourcesInput): Promise<ColorWorkflowInspection> => {
  const selected = scopedVersion(version, clipIds);
  const report = await analyzeColorConsistencyFromSources({
    version: selected,
    assets,
    signal,
    ...(samplesPerClip === undefined ? {} : { samplesPerClip }),
    ...(maximumDimension === undefined ? {} : { maximumDimension }),
    ...(onProgress === undefined ? {} : { onProgress }),
  });
  return toInspection(report, true);
};

const applyFinding = (
  before: VideoFilter,
  finding: ColorWorkflowFinding,
  mode: ColorWorkflowInspection["analysisMode"],
): VideoFilter | null => {
  if (finding.recommendedAction !== "normalize") return null;
  const after = { ...before, preset: "custom" as const };
  const value = finding.metrics.value ?? 0;
  const reference = finding.metrics.reference ?? value;
  const delta = finding.metrics.delta ?? value - reference;
  if (mode === "timeline-filter-state") {
    // Different saved treatments are not evidence that the footage needs correction.
    return null;
  }
  if (!Number.isFinite(delta) || (finding.metrics.lightingVariation ?? 0) >= 0.75) return null;
  if (finding.issue === "exposure-drift") {
    // Source statistics are linear-light stops; CSS brightness scales encoded sRGB.
    // Match only a fraction of modest drift. Large differences need a chosen reference.
    if (Math.abs(delta) > 1.25) return null;
    const targetStops = clamp(-delta * 0.25, -0.2, 0.2);
    const targetBrightness = Math.pow(2, targetStops / 2.2);
    const highlight = finding.metrics.highlightLuminance;
    if (highlight === undefined || !Number.isFinite(highlight)) return null;
    const encodedHighlight = highlight <= 0.0031308 ? 12.92 * highlight : 1.055 * Math.pow(highlight, 1 / 2.4) - 0.055;
    const safeLift = Math.max(1, 0.96 / Math.max(0.01, encodedHighlight));
    after.brightness = round(Math.min(targetBrightness, safeLift));
  } else if (finding.issue === "saturation-drift") {
    // Scene content determines saturation; never force foliage, sand and sky to match.
    return null;
  } else {
    return null;
  }
  return after;
};

const buildProposal = (
  version: VersionTimeline,
  inspection: ColorWorkflowInspection,
  findingIds?: readonly string[],
): ColorWorkflowProposal => {
  const allowed = findingIds?.length ? new Set(findingIds) : null;
  const changes = new Map<string, ColorWorkflowChange>();
  for (const finding of inspection.findings) {
    if (allowed && !allowed.has(finding.findingId)) continue;
    const clip = version.clips.find((candidate) => candidate.id === finding.targetId);
    if (!clip) continue;
    const existing = changes.get(clip.id);
    const before = existing?.before.videoFilter ?? effectiveFilter(clip);
    // Existing creative treatments need intentional adjustment, not another auto pass.
    if (before.preset !== "none") continue;
    const currentAfter = existing?.after.videoFilter ?? before;
    const after = applyFinding(currentAfter, finding, inspection.analysisMode);
    if (!after) continue;
    if (Math.abs(after.brightness - before.brightness) < 0.005) continue;
    changes.set(clip.id, {
      changeId: `color-change-${clip.id}`,
      candidate: true,
      targetType: "clip",
      targetId: clip.id,
      reason: existing ? `${existing.reason} ${finding.message}` : finding.message,
      before: { videoFilter: before },
      after: { videoFilter: after },
      reversible: true,
      risk: existing?.risk === "medium" || finding.severity === "error" || (finding.metrics.confidence ?? 1) < 0.65
        ? "medium"
        : "low",
    });
  }
  return {
    candidateOnly: true,
    requiresVisualReview: true,
    inspection,
    changes: [...changes.values()],
  };
};

export const proposeColorCorrections = (
  version: VersionTimeline,
  findingIds?: readonly string[],
  clipIds?: readonly string[],
): ColorWorkflowProposal => buildProposal(version, inspectColorConsistency(version, clipIds), findingIds);

export const proposeColorCorrectionsFromSources = async ({
  findingIds,
  ...input
}: ProposeColorCorrectionsFromSourcesInput): Promise<ColorWorkflowProposal> => buildProposal(
  input.version,
  await inspectColorConsistencyFromSources(input),
  findingIds,
);

/** Starting points, not AI verdicts: scene content is judged against paired visual evidence. */
export const proposeShotGradesFromSources = async (input: ProposeColorCorrectionsFromSourcesInput & {
  creativeIntent?: "natural" | "filmic";
}): Promise<ColorWorkflowProposal> => {
  const version = scopedVersion(input.version, input.clipIds);
  const source = await sampleTimelineSourceFrames({ ...input, version });
  const inspection = toInspection(analyzeColorConsistency({ version, sourceFrameAnalysis: source }), true);
  const changes: ColorWorkflowChange[] = [];
  for (const shot of source.clips) {
    const clip = version.clips.find((item) => item.id === shot.clipId);
    if (!clip || shot.status !== "analyzed" || !shot.aggregate) continue;
    const aggregate = shot.aggregate;
    if (aggregate.confidence === "low" || aggregate.lightingVariation >= 0.75 || aggregate.luminance < 0.025) continue;
    const usable = shot.frames.filter((item) => item.statistics.usable);
    if (usable.length < 2 && clip.kind !== "image") continue;
    const high = Math.max(...usable.map((item) => item.statistics.luminance.high));
    const low = Math.min(...usable.map((item) => item.statistics.luminance.low));
    const before = effectiveFilter(clip);
    const after: VideoFilter = { ...before, preset: "custom" };
    // Absolute tonal targets avoid compounding repeated passes. Never infer WB from scenery.
    const highlights = high > 0.72 ? -0.12 : 0;
    const shadows = low < 0.035 && aggregate.luminance < 0.22 ? 0.08 : 0;
    after.highlights = (before.highlights ?? 0) === 0 ? highlights : before.highlights;
    after.shadows = (before.shadows ?? 0) === 0 ? shadows : before.shadows;
    if (input.creativeIntent === "filmic") after.toneCurve = "filmic";
    const changed = (after.highlights ?? 0) !== (before.highlights ?? 0)
      || (after.shadows ?? 0) !== (before.shadows ?? 0)
      || (after.toneCurve ?? "linear") !== (before.toneCurve ?? "linear");
    if (!changed) continue;
    changes.push({
      changeId: `color-change-${clip.id}`, candidate: true, targetType: "clip", targetId: clip.id,
      reason: `${input.creativeIntent === "filmic" ? "Gentle filmic tonal shape. " : "Natural tonal adjustment. "}Preserve this shot's existing color and lighting; compare sky detail and shadow texture across all samples before accepting.`,
      before: { videoFilter: before }, after: { videoFilter: after }, reversible: true, risk: "medium",
    });
  }
  inspection.warnings = [...new Set([
    "Shot candidates are measured starting points, not AI visual judgments. An agent or editor must review before/after evidence; keep unchanged shots when the grade adds no value.",
    ...inspection.warnings,
  ])];
  return { candidateOnly: true, requiresVisualReview: true, inspection, changes };
};

export const selectColorChanges = (
  proposal: ColorWorkflowProposal,
  changeIds?: readonly string[],
): ColorWorkflowChange[] => {
  if (!changeIds?.length) return proposal.changes;
  const requested = new Set(changeIds);
  if (requested.size !== changeIds.length) throw new Error("DUPLICATE_CHANGE_ID: Color change IDs must be unique");
  const selected = proposal.changes.filter((change) => requested.has(change.changeId));
  if (selected.length !== requested.size) throw new Error("CHANGE_NOT_FOUND: One or more color changes are not part of this proposal");
  return selected;
};

export const previewColorCorrections = (
  version: VersionTimeline,
  proposal: ColorWorkflowProposal,
  targetIds?: readonly string[],
  changeIds?: readonly string[],
): ColorWorkflowPreview => {
  if (targetIds?.length && changeIds?.length) {
    throw new Error("AMBIGUOUS_PREVIEW_SCOPE: Provide target IDs or change IDs, not both");
  }
  const targets = targetIds?.length ? new Set(targetIds) : null;
  const changes = changeIds?.length
    ? selectColorChanges(proposal, changeIds)
    : targets
      ? proposal.changes.filter((change) => targets.has(change.targetId))
      : proposal.changes;
  if (targets && changes.length !== targets.size) throw new Error("TARGET_NOT_FOUND: One or more preview targets are not part of this proposal");
  return {
    mode: "structured-filter-preview",
    changeIds: changes.map((change) => change.changeId),
    requiresPerChangeDecision: true,
    changes,
    representativeFrames: changes.flatMap((change) => {
      const clip = version.clips.find((item) => item.id === change.targetId);
      return clip ? [...new Set([0.12, 0.5, 0.88].map((fraction) => clip.startFrame + Math.floor(Math.max(0, clip.endFrame - clip.startFrame - 1) * fraction)))].map((frame) => ({ clipId: clip.id, frame })) : [];
    }),
    warnings: [
      "These are candidate corrections only. Preview each candidate and record an explicit visual decision before approval.",
      "The preview reports canonical before/after filter values.",
      "Successful paired source images are required for visual approval. Source comparisons exclude titles and transitions.",
    ],
  };
};
