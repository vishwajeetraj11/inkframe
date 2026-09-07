"use client";

import type { AssetRef, VersionTimeline, VideoFilter } from "@/lib/editor/types";
import {
  proposeShotGradesFromSources,
  type ColorWorkflowFinding,
  type ColorWorkflowProposal,
} from "@/lib/editor/webmcp/color-workflow";
import { captureColorComparison } from "@/lib/editor/webmcp/color-evidence";
import type { SourceColorAsset, SourceFrameAnalysisProgress } from "@/lib/editor/webmcp/color-consistency";
import { useEffect, useId, useMemo, useRef, useState } from "react";

interface ColorProposal {
  clipId: string;
  before: VideoFilter;
  after: VideoFilter;
  reason: string;
  confidence: "high" | "medium";
}

export type ColorPreviewFilters = Record<string, VideoFilter>;

interface ColorConsistencyPanelProps {
  version: VersionTimeline;
  disabled?: boolean;
  revision: number;
  assets: readonly AssetRef[];
  assetSources: Readonly<Record<string, string>>;
  onPreviewFilters: (filters: ColorPreviewFilters | null) => void;
  onApplyCorrections: (proposals: readonly ColorProposal[]) => void;
  onUndoColorPass: () => void;
}

type Decision = "improves" | "neutral" | "worse";
type Evidence = Awaited<ReturnType<typeof captureColorComparison>>;
type ShotReview = { evidence: Evidence; token: number; images: Record<string, "loaded" | "failed"> };
const ISSUE_LABELS: Record<ColorWorkflowFinding["issue"], string> = {
  "exposure-drift": "Brightness differs",
  "temperature-drift": "Warmth differs",
  "tint-drift": "Green or magenta balance differs",
  "saturation-drift": "Color intensity differs",
  "palette-drift": "Scene colors differ",
  "skin-tone-risk": "Check skin tones",
  "changing-light": "Light changes within this shot",
  "text-contrast": "Check text readability",
};
const buttonClass = "min-h-9 border border-white/20 px-3 py-2 text-xs text-neutral-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-40";
const completeReview = (review?: ShotReview): boolean => Boolean(review &&
  review.evidence.samples.length === 3 && review.evidence.samples.every((sample, index) =>
    (["before", "after"] as const).every((side) => {
      const capture = sample[side];
      return capture.dataUrl && !capture.imageError && capture.width > 0 && capture.height > 0 &&
        capture.frame === sample.frame && review.images[`${index}-${side}`] === "loaded";
    })));

export const ColorConsistencyPanel = ({
  version, disabled, revision, assets, assetSources,
  onPreviewFilters, onApplyCorrections, onUndoColorPass,
}: ColorConsistencyPanelProps) => {
  const intentId = useId();
  const [creativeIntent, setCreativeIntent] = useState<"natural" | "filmic">("natural");
  const [strength, setStrength] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [result, setResult] = useState<ColorWorkflowProposal | null>(null);
  const [progress, setProgress] = useState<SourceFrameAnalysisProgress | null>(null);
  const [reviewRevision, setReviewRevision] = useState<number | null>(null);
  const [appliedRevision, setAppliedRevision] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<string, ShotReview>>({});
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const abortRef = useRef<AbortController | null>(null);
  const captureAbortRef = useRef<AbortController | null>(null);
  const runRef = useRef(0);
  const captureRunRef = useRef(0);
  const reviewTokensRef = useRef<Record<string, number>>({});
  const appliedRef = useRef(false);
  const previewCallbackRef = useRef(onPreviewFilters);
  useEffect(() => { previewCallbackRef.current = onPreviewFilters; }, [onPreviewFilters]);

  const sourceAssets = useMemo<SourceColorAsset[]>(() => assets
    .filter((asset) => asset.kind === "video" || asset.kind === "image")
    .map((asset) => ({
      assetId: asset.assetId, kind: asset.kind, mimeType: asset.mimeType,
      ...(assetSources[asset.assetId] ? { objectUrl: assetSources[asset.assetId] } : {}),
      ...(asset.externalUrl ? { externalUrl: asset.externalUrl } : {}),
      ...(asset.mediaMetadata ? { mediaMetadata: asset.mediaMetadata } : {}),
      colorSpace: "unknown", dynamicRange: "unknown",
    })), [assets, assetSources]);
  const proposals = useMemo<ColorProposal[]>(() => result?.changes.map((change) => ({
    clipId: change.targetId, before: change.before.videoFilter, after: change.after.videoFilter,
    reason: change.reason, confidence: change.risk === "low" ? "high" : "medium",
  })) ?? [], [result]);
  const improvements = proposals.filter((proposal) => decisions[proposal.clipId] === "improves" && completeReview(reviews[proposal.clipId]));
  const activeProposal = proposals.find((proposal) => proposal.clipId === activeId);
  const activeReview = activeId ? reviews[activeId] : undefined;
  const isStale = reviewRevision !== null && reviewRevision !== revision;
  const locked = Boolean(disabled || isAnalyzing || isCapturing || isStale || appliedRevision !== null);
  const clipLabel = (clipId: string): string => {
    const index = version.clips.findIndex((clip) => clip.id === clipId);
    const clip = version.clips[index];
    const name = assets.find((asset) => asset.assetId === clip?.assetId)?.name?.trim();
    return name ? `${name} (shot ${index + 1})` : index >= 0 ? `Shot ${index + 1}` : "Unavailable shot";
  };
  const readableText = (text: string): string => {
    const replacements: Array<[string, string]> = [
      ...version.clips.map((clip): [string, string] => [clip.id, clipLabel(clip.id)]),
      ...assets.map((asset): [string, string] => [asset.assetId, asset.name || "Unnamed source"]),
    ];
    return replacements.sort((a, b) => b[0].length - a[0].length)
      .reduce((value, [id, name]) => id ? value.split(id).join(name) : value, text);
  };

  useEffect(() => () => {
    abortRef.current?.abort();
    captureAbortRef.current?.abort();
    runRef.current += 1;
    captureRunRef.current += 1;
    reviewTokensRef.current = {};
    try { previewCallbackRef.current(null); } catch { /* Unmount cleanup. */ }
  }, []);

  useEffect(() => {
    if (!isOpen || !isStale || appliedRef.current) return;
    abortRef.current?.abort();
    captureAbortRef.current?.abort();
    runRef.current += 1;
    captureRunRef.current += 1;
    reviewTokensRef.current = {};
    setIsOpen(false);
    setIsAnalyzing(false);
    setIsCapturing(false);
    setActiveId(null);
    setResult(null);
    setDecisions({});
    setReviews({});
    setStatus("Timeline changed. Prepare new candidates before reviewing these shots.");
    try { previewCallbackRef.current(null); }
    catch { setStatus("Timeline changed. Preview could not be cleared; close and reopen the editor preview."); }
  }, [isOpen, isStale]);

  const closeReview = () => {
    abortRef.current?.abort();
    captureAbortRef.current?.abort();
    runRef.current += 1;
    captureRunRef.current += 1;
    reviewTokensRef.current = {};
    setIsOpen(false);
    setIsAnalyzing(false);
    setIsCapturing(false);
    setActiveId(null);
    setReviews({});
    setDecisions({});
    try { onPreviewFilters(null); }
    catch { setStatus("Preview could not be cleared. Close and reopen the editor preview."); }
  };

  const openReview = async () => {
    abortRef.current?.abort();
    captureAbortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const run = ++runRef.current;
    captureRunRef.current += 1;
    reviewTokensRef.current = {};
    appliedRef.current = false;
    setIsOpen(true);
    setIsAnalyzing(true);
    setIsCapturing(false);
    setReviewRevision(revision);
    setAppliedRevision(null);
    setActiveId(null);
    setCaptureError(null);
    setStatus(null);
    setResult(null);
    setProgress(null);
    setReviews({});
    setDecisions({});
    try {
      onPreviewFilters(null);
      const next = await proposeShotGradesFromSources({
        version, assets: sourceAssets, signal: controller.signal, creativeIntent, strength,
        samplesPerClip: 3, maximumDimension: 192,
        onProgress: (value) => {
          if (run === runRef.current && !controller.signal.aborted) setProgress(value);
        },
      });
      if (run !== runRef.current || controller.signal.aborted) return;
      setResult(next);
      setStatus(next.inspection.analysisMode === "source-frames"
        ? `Prepared ${creativeIntent === "filmic" ? "Filmic contrast" : "Natural"} candidates at ${Math.round(strength * 100)}% strength. These are rule-based suggestions, not AI approval.`
        : "Source pixels were unavailable. These suggestions compare saved filter settings, not the appearance of the footage.");
    } catch {
      if (run === runRef.current && !controller.signal.aborted) {
        setStatus("Candidates could not be prepared. Check that source media loads in the editor, then try again.");
      }
    } finally {
      if (run === runRef.current) setIsAnalyzing(false);
    }
  };

  const compareShot = async (proposal: ColorProposal) => {
    if (locked) return;
    captureAbortRef.current?.abort();
    const controller = new AbortController();
    captureAbortRef.current = controller;
    const token = ++captureRunRef.current;
    reviewTokensRef.current[proposal.clipId] = token;
    setIsCapturing(true);
    setActiveId(proposal.clipId);
    setCaptureError(null);
    // A fresh capture needs fresh visual approval, including when retrying a shot.
    setDecisions((current) => {
      const next = { ...current };
      delete next[proposal.clipId];
      return next;
    });
    setReviews((current) => {
      const next = { ...current };
      delete next[proposal.clipId];
      return next;
    });
    try {
      const evidence = await captureColorComparison({
        version, assets: sourceAssets, clipId: proposal.clipId,
        before: proposal.before, after: proposal.after, signal: controller.signal, maximumDimension: 1280,
      });
      if (token !== captureRunRef.current || controller.signal.aborted) return;
      if (evidence.clipId !== proposal.clipId || evidence.scope !== "source-clip" || evidence.samples.length !== 3) {
        throw new Error("Three matched source-frame pairs are required. Retry this shot's comparison.");
      }
      setReviews((current) => ({ ...current, [proposal.clipId]: { evidence, token, images: {} } }));
    } catch (error) {
      if (token === captureRunRef.current && !controller.signal.aborted) {
        setCaptureError(error instanceof Error ? readableText(error.message) : "Comparison could not load. Retry this shot or keep the original.");
      }
    } finally {
      if (token === captureRunRef.current) setIsCapturing(false);
    }
  };

  const imageResult = (clipId: string, token: number, key: string, value: "loaded" | "failed") => {
    if (reviewTokensRef.current[clipId] !== token) return;
    setReviews((current) => {
      const review = current[clipId];
      if (!review || review.token !== token || review.images[key] === "failed") return current;
      return { ...current, [clipId]: { ...review, images: { ...review.images, [key]: value } } };
    });
    if (value === "failed") setDecisions((current) => {
      if (current[clipId] !== "improves") return current;
      const next = { ...current };
      delete next[clipId];
      return next;
    });
  };

  const decide = (decision: Decision) => {
    if (locked || !activeProposal || (decision === "improves" && !completeReview(activeReview))) return;
    setDecisions((current) => ({ ...current, [activeProposal.clipId]: decision }));
  };

  const applyImprovements = () => {
    if (locked || appliedRef.current || reviewRevision !== revision || !improvements.length) return;
    try {
      onPreviewFilters(null);
      onApplyCorrections(improvements);
      appliedRef.current = true;
      setAppliedRevision(revision + 1);
      setIsOpen(false);
      setActiveId(null);
      setReviews({});
      reviewTokensRef.current = {};
      setStatus(`Sent ${improvements.length} improving change${improvements.length === 1 ? "" : "s"} to the editor. Neutral, worse, and undecided shots were excluded.`);
    } catch {
      setStatus("Changes could not be applied. Your decisions are retained; try again.");
    }
  };

  return (
    <section aria-label="Color consistency" className="border-b border-white/10 bg-[#1a1611] p-3 text-neutral-100">
      <h2 className="app-title text-[15px] font-semibold">Color consistency</h2>
      <p className="mt-2 text-xs leading-5 text-neutral-300">Compare suggested grades and keep only changes that improve the shot.</p>
      <p className="mt-2 text-xs leading-5 text-neutral-400">Different light is not automatically a defect. A warm sunrise, cool shade, or a new location may belong in your story.</p>
      <label htmlFor={intentId} className="mt-3 block text-xs font-semibold">Candidate look</label>
      <select id={intentId} value={creativeIntent} disabled={disabled || isAnalyzing || isCapturing} onChange={(event) => {
        closeReview();
        setCreativeIntent(event.target.value as "natural" | "filmic");
        setResult(null);
        setAppliedRevision(null);
        setStatus("Look changed. Prepare new candidates to compare this treatment.");
      }} className="mt-2 min-h-9 w-full border border-white/20 bg-[#211c16] px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:opacity-40">
        <option value="natural">Natural</option>
        <option value="filmic">Filmic contrast</option>
      </select>
      <p className="mt-2 text-xs leading-5 text-neutral-400">{creativeIntent === "natural" ? "Recover bright detail and lift deep shadows where needed. Balanced shots may stay unchanged." : "Deeper contrast, restrained saturation and a filmic curve. Adjust strength to suit the footage."}</p>
      <label className="mt-3 block text-xs">Grade strength: {Math.round(strength * 100)}%
        <input aria-label="Grade strength" type="range" min="0" max="2" step="0.1" value={strength} disabled={disabled || isAnalyzing || isCapturing} className="mt-2 w-full accent-amber-200" onChange={(event) => {
          closeReview();
          setStrength(Number(event.target.value));
          setResult(null);
          setAppliedRevision(null);
          setStatus("Strength changed. Prepare new candidates to compare.");
        }} />
      </label>
      <button type="button" disabled={disabled || isAnalyzing || isCapturing || version.clips.length === 0} onClick={() => void openReview()} className={`${buttonClass} mt-3 w-full bg-amber-200 !text-[#20180d] hover:!bg-amber-100`}>
        {isAnalyzing ? "Preparing shot candidates..." : "Prepare shot candidates"}
      </button>
      {status ? <p role="status" className="mt-3 text-xs leading-5 text-neutral-300">{status}</p> : null}
      {appliedRevision === revision ? <button type="button" className={`${buttonClass} mt-2`} disabled={disabled} onClick={() => {
        onUndoColorPass();
        setAppliedRevision(null);
        setResult(null);
        setStatus("Undo requested for the color pass.");
      }}>Undo color pass</button> : null}
      {isOpen ? <div className="mt-4 border-t border-white/10 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="app-title text-sm font-semibold">Review each shot</h3>
          <button type="button" className={buttonClass} onClick={closeReview}>{isAnalyzing || isCapturing ? "Cancel review" : "Close review"}</button>
        </div>
        {isAnalyzing ? <p role="status" className="mt-3 text-xs text-neutral-300">{progress ? `${progress.completedClipCount} of ${progress.totalClipCount} shots checked${progress.currentClipId ? `: ${clipLabel(progress.currentClipId)}` : ""}.` : "Loading source frames..."}</p> : null}
        {!isAnalyzing && result ? <>
          <p className="mt-3 text-xs leading-5 text-neutral-400">{result.inspection.analysisMode === "source-frames"
            ? "Sequence measurements highlight differences; they do not establish the right look. Each candidate still needs your judgment."
            : "Saved filter settings are not a visual quality judgment."}</p>
          {result.inspection.summary.skippedClips + result.inspection.summary.unreadableClips > 0 ? <p className="mt-2 text-xs text-amber-200">{result.inspection.summary.skippedClips + result.inspection.summary.unreadableClips} shots could not be checked. Review them manually.</p> : null}
          {result.inspection.warnings.length > 0 ? <details className="mt-3 text-xs text-amber-100">
            <summary className="cursor-pointer">Analysis limitations ({result.inspection.warnings.length})</summary>
            {result.inspection.warnings.map((warning, index) => <p key={index} className="mt-2 leading-5">{readableText(warning)}</p>)}
          </details> : null}
          {result.inspection.findings.length > 0 ? <details className="mt-3 text-xs text-neutral-300">
            <summary className="cursor-pointer">Measured differences ({result.inspection.findings.length})</summary>
            <ul className="mt-2 space-y-2">{result.inspection.findings.map((finding) => <li key={finding.findingId}>
              <span className="font-semibold">{clipLabel(finding.targetId)}: </span>{ISSUE_LABELS[finding.issue]}
              {finding.issue === "changing-light" ? ". A single grade may not suit the whole shot." : finding.issue === "skin-tone-risk" ? ". Check that faces still look natural." : ". Review in context before changing it."}
            </li>)}</ul>
          </details> : <p className="mt-3 text-xs leading-5 text-neutral-400">No differences exceeded the analysis thresholds. This does not confirm that every shot looks right.</p>}
          {proposals.length ? <>
            <ul aria-label="Shot reviews" className="mt-3 divide-y divide-white/10">{proposals.map((proposal) => <li key={proposal.clipId} className="py-3">
              <p className="break-words text-xs font-semibold">{clipLabel(proposal.clipId)}</p>
              <p className="mt-1 text-xs text-neutral-400">{decisions[proposal.clipId] === "improves" ? "Improves: included when you apply" : decisions[proposal.clipId] === "neutral" ? "Neutral: keep original" : decisions[proposal.clipId] === "worse" ? "Worse: keep original" : "Undecided: excluded from Apply"}</p>
              <button type="button" className={`${buttonClass} mt-2`} disabled={locked} aria-label={`Compare ${clipLabel(proposal.clipId)}`} onClick={() => void compareShot(proposal)}>Compare shot</button>
            </li>)}</ul>
            {activeProposal ? <dialog ref={(node) => { if (node && !node.open) node.showModal(); }} onCancel={() => setActiveId(null)} aria-label={`Comparison for ${clipLabel(activeProposal.clipId)}`} className="fixed inset-0 m-auto max-h-[92vh] w-[min(1400px,94vw)] max-w-none overflow-y-auto border border-amber-200/30 bg-[#16130f] p-6 text-neutral-100 backdrop:bg-black/80">
              <button type="button" className={`${buttonClass} float-right`} onClick={() => setActiveId(null)}>Close comparison</button>
              <h4 className="break-words text-xs font-semibold">{clipLabel(activeProposal.clipId)}</h4>
              <p className="mt-2 text-xs leading-5 text-neutral-300">Three matched source-frame pairs. Original keeps your existing treatment; Graded shows the candidate.</p>
              <p className="mt-2 text-xs leading-5 text-neutral-400">Source shot only: these samples do not show timeline overlays, transitions, or neighboring shots. Review the full sequence before export.</p>
              {isCapturing ? <p role="status" className="mt-3 text-xs text-amber-100">Rendering Original and Graded samples...</p> : null}
              {captureError ? <p role="alert" className="mt-3 text-xs leading-5 text-amber-100">{captureError} Improves is unavailable. Retry Compare shot, or reject the candidate.</p> : null}
              {activeReview ? <>
                {activeReview.evidence.warnings.map((warning, index) => <p key={index} className="mt-2 text-xs leading-5 text-amber-100">{readableText(warning)}</p>)}
                <div className="mt-3 space-y-4">{activeReview.evidence.samples.map((sample, index) => <div key={`${activeReview.token}-${index}`}>
                  <p className="mb-2 text-xs text-neutral-400">Sample {index + 1} / source {sample.sourceTimeSeconds.toFixed(2)}s</p>
                  <div className="grid grid-cols-2 gap-2">{(["before", "after"] as const).map((side) => {
                    const capture = sample[side];
                    const label = side === "before" ? "Original" : "Graded";
                    const key = `${index}-${side}`;
                    const invalid = !capture.dataUrl || Boolean(capture.imageError) || capture.width <= 0 || capture.height <= 0 || capture.frame !== sample.frame || activeReview.images[key] === "failed";
                    return <figure key={side} className="min-w-0">
                      <figcaption className="mb-1 text-xs font-semibold">{label}</figcaption>
                      {invalid ? <p role="alert" className="flex min-h-24 items-center border border-amber-200/30 p-2 text-xs text-amber-100">{label} image unavailable. Retry this comparison.</p> : (
                        // Captures are generated data URLs; Next image optimization cannot improve them.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={capture.dataUrl} alt={`${label}: ${clipLabel(activeProposal.clipId)}, sample ${index + 1}`} width={capture.width} height={capture.height} className="h-auto w-full border border-white/10 bg-[#100e0b] object-contain" onLoad={() => imageResult(activeProposal.clipId, activeReview.token, key, "loaded")} onError={() => imageResult(activeProposal.clipId, activeReview.token, key, "failed")} />
                      )}
                    </figure>;
                  })}</div>
                </div>)}</div>
                {!completeReview(activeReview) ? <p className="mt-3 text-xs leading-5 text-amber-100">All six images must load before you can mark this grade Improves. If an image stays unavailable, retry Compare shot.</p> : null}
              </> : null}
              <fieldset disabled={locked} className="mt-3">
                <legend className="text-xs font-semibold">Does the proposed grade improve this shot?</legend>
                <p className="mt-2 text-xs leading-5 text-neutral-400">Compare skin, bright detail, dark detail, and the intended mood across all three pairs.</p>
                <div className="mt-2 flex flex-wrap gap-2">{(["improves", "neutral", "worse"] as const).map((value) => <button type="button" key={value} className={buttonClass} disabled={value === "improves" && !completeReview(activeReview)} aria-pressed={decisions[activeProposal.clipId] === value} onClick={() => decide(value)}>{value === "improves" ? "Improves" : value === "neutral" ? "Neutral" : "Worse"}</button>)}</div>
              </fieldset>
              <p className="mt-2 text-xs text-neutral-400">Neutral or worse keeps the original and rejects this grade.</p>
            </dialog> : null}
            <button type="button" className={`${buttonClass} mt-4 w-full bg-amber-200 !text-[#20180d] hover:!bg-amber-100`} disabled={locked || improvements.length === 0} onClick={applyImprovements}>Apply {improvements.length} improving change{improvements.length === 1 ? "" : "s"}</button>
            <p className="mt-2 text-xs leading-5 text-neutral-400">Only shots marked Improves will change. Opening a comparison never approves a grade.</p>
          </> : <p className="mt-3 text-xs leading-5 text-neutral-300">No grades proposed. Keep the current look, or adjust shots manually after reviewing them in context.</p>}
        </> : null}
      </div> : null}
    </section>
  );
};
