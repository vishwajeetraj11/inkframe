import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ColorConsistencyPanel } from "@/components/editor/ColorConsistencyPanel";
import type { AssetRef, VersionTimeline, VideoFilter } from "@/lib/editor/types";
import type { ColorWorkflowProposal } from "@/lib/editor/webmcp/color-workflow";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
});

const { propose, capture } = vi.hoisted(() => ({ propose: vi.fn(), capture: vi.fn() }));
vi.mock("@/lib/editor/webmcp/color-workflow", () => ({ proposeShotGradesFromSources: propose }));
vi.mock("@/lib/editor/webmcp/color-evidence", () => ({ captureColorComparison: capture }));

const before: VideoFilter = { preset: "warm", brightness: 1, contrast: 1, saturation: 1, sepia: 0.1, grayscale: 0, hueRotate: 0 };
const after = { ...before, preset: "custom" as const, brightness: 1.1, exposure: 0.2, temperature: -0.1, tint: 0.05, shadows: 0.1, highlights: -0.2, toneCurve: "filmic" as const };
const assets: AssetRef[] = ["Sunrise.mov", "Courtyard.mov", "Portrait.mov"].map((name, index) => ({ assetId: `asset-internal-${index}`, name, kind: "video", mimeType: "video/mp4", size: 100 }));
const version: VersionTimeline = {
  aspect: "reel_9_16", textOverlays: [], audioTracks: [], transitions: [],
  clips: assets.map((asset, index) => ({ id: `clip-internal-${index}`, assetId: asset.assetId, kind: "video", startFrame: index * 60, endFrame: index * 60 + 60, trimStartFrame: 0, trimEndFrame: 60, volume: 1, videoFilter: before })),
};
const result: ColorWorkflowProposal = {
  candidateOnly: true, requiresVisualReview: true,
  inspection: {
    analysisMode: "source-frames", pixelAnalysisAvailable: true, aspect: "reel_9_16",
    reference: { mode: "median-source-frames", metrics: {} as ColorWorkflowProposal["inspection"]["reference"]["metrics"] },
    findings: [{ findingId: "finding-0", targetType: "clip", targetId: "clip-internal-0", issue: "temperature-drift", severity: "warning", metrics: {}, recommendedAction: "review-manually", message: "Source differs" }],
    summary: { clipsAnalyzed: 3, clipsWithDrift: 3, highConfidenceFindings: 3, skippedClips: 0, unreadableClips: 0, cancelled: false, score: 80 },
    warnings: ["Check clip-internal-0 from asset-internal-0"],
  },
  changes: version.clips.map((clip) => ({ changeId: `change-${clip.id}`, candidate: true, targetType: "clip", targetId: clip.id, reason: "Proposed adjustment", before: { videoFilter: before }, after: { videoFilter: after }, reversible: true, risk: "low" })),
};
const evidence = (clipId = "clip-internal-0") => ({
  clipId, scope: "source-clip" as const, warnings: [],
  samples: [0, 29, 59].map((frame) => ({
    frame, sourceTimeSeconds: frame / 30,
    before: { frame, width: 320, height: 180, dataUrl: `data:image/jpeg;base64,original${frame}`, contrastChecks: [] },
    after: { frame, width: 320, height: 180, dataUrl: `data:image/jpeg;base64,graded${frame}`, contrastChecks: [] },
  })),
});
const makeProps = () => ({ version, assets, revision: 4, assetSources: { "asset-internal-0": "blob:source-zero" }, onPreviewFilters: vi.fn(), onApplyCorrections: vi.fn(), onUndoColorPass: vi.fn() });
const open = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Prepare shot candidates" }));
  await screen.findByRole("button", { name: /Compare Sunrise/ });
};
const compare = async (name = "Sunrise", load = true) => {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`Compare ${name}`) }));
  await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(6));
  if (load) screen.getAllByRole("img").forEach((image) => fireEvent.load(image));
};

beforeEach(() => {
  propose.mockReset();
  capture.mockReset();
  propose.mockResolvedValue(result);
  capture.mockImplementation(async ({ clipId }) => evidence(clipId));
});
afterEach(cleanup);

describe("ColorConsistencyPanel", () => {
  it("shows three actual paired captures and never approves by opening review", async () => {
    const props = makeProps();
    render(<ColorConsistencyPanel {...props} />);
    await open();
    await compare("Sunrise", false);
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ version, clipId: "clip-internal-0", before, after, assets: expect.arrayContaining([expect.objectContaining({ assetId: "asset-internal-0", objectUrl: "blob:source-zero" })]) }));
    expect(capture.mock.calls[0][0].after).toBe(after);
    expect(screen.getAllByRole("img", { name: /^Original:/ })).toHaveLength(3);
    expect(screen.getAllByRole("img", { name: /^Graded:/ })).toHaveLength(3);
    expect(screen.getAllByRole("img")[0]).toHaveAttribute("src", evidence().samples[0].before.dataUrl);
    expect(screen.getAllByRole("img")[1]).toHaveAttribute("src", evidence().samples[0].after.dataUrl);
    expect(screen.getByRole("button", { name: "Improves" })).toBeDisabled();
    const images = screen.getAllByRole("img");
    images.slice(0, 5).forEach((image) => fireEvent.load(image));
    expect(screen.getByRole("button", { name: "Improves" })).toBeDisabled();
    fireEvent.load(images[5]);
    expect(screen.getByRole("button", { name: "Improves" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Apply 0/ })).toBeDisabled();
    expect(props.onApplyCorrections).not.toHaveBeenCalled();
    expect(screen.getByText(/Source shot only/)).toBeInTheDocument();
  });

  it("applies only improvements and forwards every filter field unchanged", async () => {
    const props = makeProps();
    render(<ColorConsistencyPanel {...props} />);
    await open();
    await compare();
    fireEvent.click(screen.getByRole("button", { name: "Improves" }));
    await compare("Courtyard");
    fireEvent.click(screen.getByRole("button", { name: "Neutral" }));
    await compare("Portrait");
    fireEvent.click(screen.getByRole("button", { name: "Worse" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply 1 improving change" }));
    expect(props.onApplyCorrections).toHaveBeenCalledTimes(1);
    const applied = props.onApplyCorrections.mock.calls[0][0];
    expect(applied).toHaveLength(1);
    expect(applied[0].clipId).toBe("clip-internal-0");
    expect(applied[0].after).toBe(after);
    expect(props.onPreviewFilters).toHaveBeenLastCalledWith(null);
  });

  it.each(["Neutral", "Worse"])("removes an improvement when changed to %s", async (decision) => {
    render(<ColorConsistencyPanel {...makeProps()} />);
    await open();
    await compare();
    fireEvent.click(screen.getByRole("button", { name: "Improves" }));
    expect(screen.getByRole("button", { name: "Apply 1 improving change" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: decision }));
    expect(screen.getByRole("button", { name: /Apply 0/ })).toBeDisabled();
  });

  it("blocks improvements after an image fails, even if it loaded earlier", async () => {
    render(<ColorConsistencyPanel {...makeProps()} />);
    await open();
    await compare();
    fireEvent.click(screen.getByRole("button", { name: "Improves" }));
    fireEvent.error(screen.getAllByRole("img")[5]);
    expect(screen.getByRole("button", { name: "Improves" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Apply 0/ })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Graded image unavailable");
    expect(screen.getByRole("button", { name: "Neutral" })).toBeEnabled();
  });

  it("blocks improvements when a capture has no image data", async () => {
    const broken = evidence();
    broken.samples[1].after.dataUrl = "";
    capture.mockResolvedValueOnce(broken);
    render(<ColorConsistencyPanel {...makeProps()} />);
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Compare Sunrise/ }));
    await screen.findByRole("alert");
    screen.getAllByRole("img").forEach((image) => fireEvent.load(image));
    expect(screen.getByRole("button", { name: "Improves" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Apply 0/ })).toBeDisabled();
  });

  it("surfaces capture failures and allows retry without approving", async () => {
    capture.mockRejectedValueOnce(new Error("Source is unavailable."));
    render(<ColorConsistencyPanel {...makeProps()} />);
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Compare Sunrise/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Source is unavailable");
    expect(screen.getByRole("button", { name: "Improves" })).toBeDisabled();
    await compare();
    expect(screen.getByRole("button", { name: "Improves" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Apply 0/ })).toBeDisabled();
  });

  it("rejects mismatched or incomplete comparison evidence", async () => {
    capture.mockResolvedValueOnce({ ...evidence("another-shot"), samples: evidence().samples.slice(0, 2) });
    render(<ColorConsistencyPanel {...makeProps()} />);
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Compare Sunrise/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Three matched source-frame pairs are required");
    expect(screen.getByRole("button", { name: "Improves" })).toBeDisabled();
  });

  it("uses names and explains natural variation without quality scores or safe-pass claims", async () => {
    render(<ColorConsistencyPanel {...makeProps()} />);
    await open();
    expect(screen.getByText(/A warm sunrise/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("clip-internal");
    expect(document.body).not.toHaveTextContent("asset-internal");
    expect(document.body).not.toHaveTextContent("Safe pass");
    expect(document.body).not.toHaveTextContent("Score 80");
    expect(screen.getByRole("status")).toHaveTextContent("rule-based suggestions, not AI approval");
  });

  it("prepares the chosen creative intent and clears old decisions on a look change", async () => {
    render(<ColorConsistencyPanel {...makeProps()} />);
    await open();
    expect(propose).toHaveBeenLastCalledWith(expect.objectContaining({ creativeIntent: "natural" }));
    await compare();
    fireEvent.click(screen.getByRole("button", { name: "Improves" }));
    fireEvent.change(screen.getByLabelText("Candidate look"), { target: { value: "filmic" } });
    expect(screen.queryByRole("button", { name: /^Apply/ })).not.toBeInTheDocument();
    await open();
    expect(propose).toHaveBeenLastCalledWith(expect.objectContaining({ creativeIntent: "filmic" }));
    expect(screen.getByRole("button", { name: /Apply 0/ })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Filmic contrast");
  });

  it("clears decisions after a timeline revision", async () => {
    const props = makeProps();
    const view = render(<ColorConsistencyPanel {...props} />);
    await open();
    await compare();
    fireEvent.click(screen.getByRole("button", { name: "Improves" }));
    view.rerender(<ColorConsistencyPanel {...props} revision={5} />);
    expect(screen.queryByRole("button", { name: /Apply 1/ })).not.toBeInTheDocument();
    expect(props.onPreviewFilters).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("status")).toHaveTextContent("Timeline changed");
    expect(props.onApplyCorrections).not.toHaveBeenCalled();
  });

  it("aborts pending captures and ignores their completion after closing", async () => {
    let resolveCapture!: (value: ReturnType<typeof evidence>) => void;
    capture.mockImplementationOnce(() => new Promise((resolve) => { resolveCapture = resolve; }));
    render(<ColorConsistencyPanel {...makeProps()} />);
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Compare Sunrise/ }));
    const signal = capture.mock.calls[0][0].signal;
    fireEvent.click(screen.getByRole("button", { name: "Cancel review" }));
    await act(async () => { resolveCapture(evidence()); });
    expect(signal.aborted).toBe(true);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Improves" })).not.toBeInTheDocument();
  });

  it("ignores preparation completion after cancellation and cleans up on unmount", async () => {
    let resolveAnalysis!: (value: ColorWorkflowProposal) => void;
    propose.mockImplementationOnce(() => new Promise((resolve) => { resolveAnalysis = resolve; }));
    const props = makeProps();
    const view = render(<ColorConsistencyPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Prepare shot candidates" }));
    const signal = propose.mock.calls[0][0].signal;
    fireEvent.click(screen.getByRole("button", { name: "Cancel review" }));
    await act(async () => { resolveAnalysis(result); });
    expect(signal.aborted).toBe(true);
    expect(screen.queryByRole("button", { name: /Compare Sunrise/ })).not.toBeInTheDocument();
    view.unmount();
    expect(props.onPreviewFilters).toHaveBeenLastCalledWith(null);
  });

  it("preserves evidence when callback identity changes", async () => {
    const props = makeProps();
    const view = render(<ColorConsistencyPanel {...props} />);
    await open();
    await compare();
    const nextPreview = vi.fn();
    view.rerender(<ColorConsistencyPanel {...props} onPreviewFilters={nextPreview} />);
    expect(screen.getByRole("button", { name: "Improves" })).toBeEnabled();
    expect(nextPreview).not.toHaveBeenCalled();
    view.unmount();
    expect(nextPreview).toHaveBeenCalledWith(null);
  });

  it("labels metadata fallback and empty proposals honestly", async () => {
    propose.mockResolvedValueOnce({ ...result, changes: [], inspection: { ...result.inspection, analysisMode: "timeline-filter-state", pixelAnalysisAvailable: false, findings: [], warnings: [] } });
    render(<ColorConsistencyPanel {...makeProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Prepare shot candidates" }));
    await screen.findByText(/No grades proposed/);
    expect(screen.getByRole("status")).toHaveTextContent("not the appearance of the footage");
    expect(screen.getByText(/does not confirm that every shot looks right/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Apply/ })).not.toBeInTheDocument();
  });
});
