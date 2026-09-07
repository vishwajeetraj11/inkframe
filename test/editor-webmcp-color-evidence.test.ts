import { describe, expect, it, vi } from "vitest";
import { createDefaultClip } from "@/lib/editor/defaults";
import { createInitialEditorHistory, editorHistoryReducer } from "@/lib/editor/history";
import { createEditorWebMcpTools, type EditorWebMcpToolContext } from "@/lib/editor/webmcp/tools";
import type { EditorFrameCapture } from "@/lib/editor/export-state";

const filter = { preset: "custom" as const, brightness: 1.05, contrast: 1, saturation: 1, sepia: 0, grayscale: 0, hueRotate: 0 };
const image = (frame: number, after = false): EditorFrameCapture => ({
  frame, width: 160, height: 90, mimeType: "image/jpeg", contrastChecks: [],
  dataUrl: `data:image/jpeg;base64,${after ? "YWZ0ZXI=" : "YmVmb3Jl"}`,
});
const fixture = (count = 2, duration = 30, autoReview = true) => {
  let state = createInitialEditorHistory();
  const aspect = state.present.activeVersion;
  state.present.versions[aspect].clips = Array.from({ length: count }, (_, index) => ({
    ...createDefaultClip(`shot-${index}`, `asset-${index}`, "video"),
    startFrame: index * duration, endFrame: (index + 1) * duration,
    trimStartFrame: 0, trimEndFrame: duration,
  }));
  const capture = vi.fn<NonNullable<EditorWebMcpToolContext["captureColorComparison"]>>(async (_aspect, clipId) => {
    const clip = state.present.versions[aspect].clips.find((item) => item.id === clipId)!;
    return { clipId, scope: "source-clip", warnings: [], samples: Array.from({ length: Math.min(3, duration) }, (_, index) => {
      const frame = clip.startFrame + Math.floor(index * duration / Math.min(3, duration));
      return { frame, sourceTimeSeconds: (frame - clip.startFrame) / 30, before: image(frame), after: image(frame, true) };
    }) };
  });
  const dispatchCommand = vi.fn<NonNullable<EditorWebMcpToolContext["dispatchCommand"]>>((command) => { state = editorHistoryReducer(state, command); });
  const context: EditorWebMcpToolContext = { getState: () => state, dispatchCommand, captureColorComparison: capture };
  const tools = createEditorWebMcpTools(context);
  const call = async (name: string, input: Record<string, unknown>, signal?: AbortSignal) => {
    if (name === "approve" && count === 1 && autoReview) {
      for (const persona of ["colorist", "technical", "critic"]) {
        await call("submit_review", { proposalId: input.proposalId, previewId: input.previewId, persona, reviewerId: `agent-${persona}`, verdict: "improves", findings: "Reviewed all paired samples against the intended look.", requestedChanges: "None." });
      }
    }
    const tool = tools.find((item) => item.name === `editor_color_${name}`)!;
    return JSON.parse(String(await tool.execute(input, signal ? { signal } : undefined)));
  };
  const candidates = Array.from({ length: count }, (_, index) => ({ clipId: `shot-${index}`, videoFilter: filter, rationale: "Lift this shot gently while preserving the highlights." }));
  return { call, capture, candidates, context, dispatchCommand, aspect, state: () => state,
    project: async (input: Record<string, unknown>) => JSON.parse(String(await tools.find((item) => item.name === "editor_get_project")!.execute(input))),
    bumpRevision: () => { state = { ...state, revision: (state.revision ?? 0) + 1 }; },
    propose: () => call("propose", { candidates }),
  };
};

describe("WebMCP per-shot visual evidence", () => {
  it("gates single-video approval on three independent, exact-preview reviews", async () => {
    const f = fixture(1, 30, false);
    const proposal = await f.propose();
    expect(proposal.reviewProtocol.personas).toHaveProperty("technical");
    const preview = await f.call("preview", { proposalId: proposal.proposalId, includeImages: true });
    const approval = { proposalId: proposal.proposalId, previewId: preview.previewId, confirmed: true, decisions: [{ changeId: preview.reviewedChangeIds[0], decision: "improves" }] };
    await expect(f.call("approve", approval)).rejects.toThrow("THREE_REVIEWS_REQUIRED");
    const review = { proposalId: proposal.proposalId, previewId: preview.previewId, verdict: "improves", findings: "Reviewed all paired frames and found improved tonal separation.", requestedChanges: "None." };
    await f.call("submit_review", { ...review, persona: "colorist", reviewerId: "a" });
    await expect(f.call("submit_review", { ...review, persona: "technical", reviewerId: "a" })).rejects.toThrow("INDEPENDENT_REVIEWERS_REQUIRED");
    await f.call("submit_review", { ...review, persona: "technical", reviewerId: "b" });
    await f.call("submit_review", { ...review, persona: "critic", reviewerId: "c", verdict: "revise" });
    await expect(f.call("approve", approval)).rejects.toThrow("GRADE_REVISION_REQUIRED");
    await f.call("submit_review", { ...review, persona: "critic", reviewerId: "c" });
    const approved = await f.call("approve", approval);
    expect(approved.approvalId).toBeTruthy();
    await f.call("submit_review", { ...review, persona: "critic", reviewerId: "c", verdict: "reject" });
    await expect(f.call("apply", { proposalId: proposal.proposalId, approvalId: approved.approvalId, expectedRevision: proposal.revision, operationId: "invalidated-review" })).rejects.toThrow("APPROVAL_NOT_FOUND");
    const fresh = await f.call("preview", { proposalId: proposal.proposalId, includeImages: true });
    await expect(f.call("approve", { ...approval, previewId: fresh.previewId })).rejects.toThrow("THREE_REVIEWS_REQUIRED");
    f.bumpRevision();
    await expect(f.call("submit_review", { ...review, persona: "technical", reviewerId: "b" })).rejects.toThrow();
    expect(f.dispatchCommand).not.toHaveBeenCalled();
  });
  it("accepts explicit grading controls and intent without mutating or approving", async () => {
    const f = fixture(1);
    const candidate = { ...f.candidates[0], videoFilter: { ...filter, exposure: 2, temperature: -1, tint: 1, shadows: -1, highlights: 1, toneCurve: "filmic" } };
    const result = await f.call("propose", { candidates: [candidate], creativeIntent: "Warm evening light" });
    expect(result.proposal.changes[0].after.videoFilter).toEqual(candidate.videoFilter);
    expect(result.creativeIntent).toBe("Warm evening light");
    expect(result).toMatchObject({ candidateOnly: true, requiresPreview: true, requiresApproval: true });
    expect(result.approvalId).toBeUndefined();
    expect(f.dispatchCommand).not.toHaveBeenCalled();
  });

  it.each([{ exposure: 2.01 }, { temperature: -1.01 }, { tint: 1.01 }, { shadows: -1.01 }, { highlights: 1.01 }, { toneCurve: "unknown" }])("rejects invalid controls %j", async (patch) => {
    const f = fixture(1);
    await expect(f.call("propose", { candidates: [{ ...f.candidates[0], videoFilter: { ...filter, ...patch } }] })).rejects.toThrow();
  });

  it("rejects duplicate, missing, out-of-scope, and oversized candidate lists", async () => {
    const f = fixture(13);
    await expect(f.propose()).rejects.toThrow();
    await expect(f.call("propose", { candidates: [f.candidates[0], f.candidates[0]] })).rejects.toThrow("DUPLICATE_CANDIDATE");
    await expect(f.call("propose", { candidates: [{ ...f.candidates[0], clipId: "missing" }] })).rejects.toThrow("CLIP_NOT_FOUND");
    await expect(f.call("propose", { candidates: [f.candidates[0]], clipIds: ["shot-1"] })).rejects.toThrow("CANDIDATE_SCOPE_MISMATCH");
  });

  it("returns actual paired images for every shot and preserves per-change decisions on apply", async () => {
    const f = fixture();
    const proposal = await f.propose();
    const preview = await f.call("preview", { proposalId: proposal.proposalId, includeImages: true });
    expect(preview.evidenceScope).toBe("source-only");
    expect(preview.evidence).toHaveLength(2);
    for (const comparison of preview.evidence) {
      expect(comparison.samples).toHaveLength(3);
      for (const sample of comparison.samples) expect(sample.before.dataUrl).not.toBe(sample.after.dataUrl);
    }
    expect(f.capture).toHaveBeenCalledWith(f.aspect, "shot-0", expect.objectContaining({ brightness: 1 }), filter, expect.any(AbortSignal));
    expect(f.dispatchCommand).not.toHaveBeenCalled();
    const approval = await f.call("approve", { proposalId: proposal.proposalId, previewId: preview.previewId, confirmed: true, decisions: preview.reviewedChangeIds.map((changeId: string, index: number) => ({ changeId, decision: index ? "worse" : "improves" })) });
    expect(approval.approvedChangeIds).toEqual(["color-change-shot-0"]);
    expect(approval.rejectedChangeIds).toEqual(["color-change-shot-1"]);
    const input = { proposalId: proposal.proposalId, approvalId: approval.approvalId, expectedRevision: proposal.revision, operationId: "apply-evidence" };
    const applied = await f.call("apply", input);
    expect(applied.ok).toBe(true);
    expect(f.dispatchCommand.mock.calls[0][0].actions).toHaveLength(1);
    expect(f.state().present.versions[f.aspect].clips[0].videoFilter).toMatchObject(filter);
    expect((await f.call("apply", input)).idempotent).toBe(true);
    expect(f.dispatchCommand).toHaveBeenCalledTimes(1);
  });

  it("never approves metadata-only previews", async () => {
    const f = fixture(1);
    const proposal = await f.propose();
    const preview = await f.call("preview", { proposalId: proposal.proposalId });
    expect(preview.visualEvidenceAvailable).toBe(false);
    await expect(f.call("approve", { proposalId: proposal.proposalId, previewId: preview.previewId, confirmed: true, decisions: [{ changeId: preview.reviewedChangeIds[0], decision: "improves" }] })).rejects.toThrow("VISUAL_EVIDENCE_REQUIRED");
    expect(f.capture).not.toHaveBeenCalled();
  });

  it("requires the paired callback even when baseline capture exists", async () => {
    const f = fixture(1);
    f.context.captureColorComparison = undefined;
    f.context.captureFrame = vi.fn(async (frame) => image(frame));
    const proposal = await f.propose();
    await expect(f.call("preview", { proposalId: proposal.proposalId, includeImages: true })).rejects.toThrow("PREVIEW_UNAVAILABLE");
    expect(f.context.captureFrame).not.toHaveBeenCalled();
  });

  it.each(["missing-after", "image-error", "duplicate", "wrong-clip", "wrong-frame"])("rejects incomplete evidence: %s", async (failure) => {
    const f = fixture(1);
    f.capture.mockImplementation(async () => ({ clipId: failure === "wrong-clip" ? "other" : "shot-0", scope: "source-clip", warnings: [], samples: [0, 10, 20].map((frame) => ({
      frame: failure === "duplicate" ? 0 : frame, sourceTimeSeconds: frame / 30,
      before: image(frame), after: { ...image(failure === "wrong-frame" ? 99 : frame, true), ...(failure === "missing-after" ? { dataUrl: undefined } : {}), ...(failure === "image-error" ? { imageError: "Decode failed" } : {}) },
    })) }));
    const proposal = await f.propose();
    await expect(f.call("preview", { proposalId: proposal.proposalId, includeImages: true })).rejects.toThrow("VISUAL_EVIDENCE_FAILED");
  });

  it.each([1, 2])("allows all unique frames of a %i-frame clip", async (duration) => {
    const f = fixture(1, duration);
    const proposal = await f.propose();
    const preview = await f.call("preview", { proposalId: proposal.proposalId, includeImages: true });
    expect(preview.evidence[0].samples).toHaveLength(duration);
  });

  it("requires decisions to exactly cover the evidence", async () => {
    const f = fixture();
    const proposal = await f.propose();
    const preview = await f.call("preview", { proposalId: proposal.proposalId, includeImages: true });
    await expect(f.call("approve", { proposalId: proposal.proposalId, previewId: preview.previewId, confirmed: true, decisions: [{ changeId: preview.reviewedChangeIds[0], decision: "improves" }] })).rejects.toThrow("VISUAL_DECISIONS_INCOMPLETE");
    await expect(f.call("approve", { proposalId: proposal.proposalId, previewId: preview.previewId, confirmed: true, decisions: preview.reviewedChangeIds.map((changeId: string) => ({ changeId, decision: "neutral" })) })).rejects.toThrow("EMPTY_APPROVAL");
  });

  it("invalidates capture when the revision changes while awaiting images", async () => {
    const f = fixture(1);
    const capture = f.capture.getMockImplementation()!;
    f.capture.mockImplementation(async (...args) => { const evidence = await capture(...args); f.bumpRevision(); return evidence; });
    const proposal = await f.propose();
    await expect(f.call("preview", { proposalId: proposal.proposalId, includeImages: true })).rejects.toThrow("STALE_PROPOSAL");
  });

  it("rejects approval after revision changes", async () => {
    const f = fixture(1);
    const proposal = await f.propose();
    const preview = await f.call("preview", { proposalId: proposal.proposalId, includeImages: true });
    f.bumpRevision();
    await expect(f.call("approve", { proposalId: proposal.proposalId, previewId: preview.previewId, confirmed: true, decisions: [{ changeId: preview.reviewedChangeIds[0], decision: "improves" }] })).rejects.toThrow("STALE_PROPOSAL");
  });

  it("does not persist evidence after cancellation", async () => {
    const f = fixture(1);
    const controller = new AbortController();
    const capture = f.capture.getMockImplementation()!;
    f.capture.mockImplementation(async (...args) => { const evidence = await capture(...args); controller.abort(); return evidence; });
    const proposal = await f.propose();
    await expect(f.call("preview", { proposalId: proposal.proposalId, includeImages: true }, controller.signal)).rejects.toThrow();
    expect(f.dispatchCommand).not.toHaveBeenCalled();
  });

  it("bounds 12-candidate proposals and four-candidate image previews", async () => {
    const f = fixture(12);
    const proposal = await f.call("propose", { candidates: f.candidates.map((candidate) => ({ ...candidate, rationale: "x".repeat(1000) })) });
    expect(proposal.ok).toBe(true);
    expect(JSON.stringify(proposal).length).toBeLessThan(100_000);
    await expect(f.call("preview", { proposalId: proposal.proposalId, includeImages: true })).rejects.toThrow("PREVIEW_BATCH_LIMIT");
    expect(f.capture).not.toHaveBeenCalled();
    const preview = await f.call("preview", { proposalId: proposal.proposalId, changeIds: proposal.proposal.changes.slice(0, 4).map((change: { changeId: string }) => change.changeId), includeImages: true });
    expect(preview.evidence).toHaveLength(4);
    expect(JSON.stringify(preview).length).toBeLessThan(1_500_000);
  });

  it("fails oversized evidence explicitly before creating a review", async () => {
    const f = fixture(1);
    const capture = f.capture.getMockImplementation()!;
    f.capture.mockImplementation(async (...args) => {
      const evidence = await capture(...args);
      for (const sample of evidence.samples) sample.after.dataUrl = `data:image/jpeg;base64,${"A".repeat(600_000)}`;
      return evidence;
    });
    const proposal = await f.propose();
    await expect(f.call("preview", { proposalId: proposal.proposalId, includeImages: true })).rejects.toThrow("COLOR_RESPONSE_LIMIT");
  });

  it("paginates all 19 detailed clips without oversized responses or skipped items", async () => {
    const f = fixture(19);
    for (const clip of f.state().present.versions[f.aspect].clips) clip.keyframes = { x: Array.from({ length: 25 }, (_, frame) => ({ id: `${clip.id}-point-${frame}`, frame, value: 0.5, interpolation: "linear" })) };
    const ids: string[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page = await f.project({ aspect: f.aspect, offset, maxItems: 25 });
      expect(page.ok).toBe(true);
      expect(JSON.stringify(page).length).toBeLessThanOrEqual(12_000);
      ids.push(...page.versions[f.aspect].clips.items.map((clip: { id: string }) => clip.id));
      expect(page.nextOffset === null || page.nextOffset > offset).toBe(true);
      offset = page.nextOffset;
    }
    expect(ids).toEqual(f.candidates.map((candidate) => candidate.clipId));
  });
});
