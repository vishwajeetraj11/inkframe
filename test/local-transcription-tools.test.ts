import { describe, expect, it, vi } from "vitest";
import { createInitialEditorHistory, editorHistoryReducer } from "@/lib/editor/history";
import { createDefaultClip } from "@/lib/editor/defaults";
import { createEditorWebMcpTools, type EditorWebMcpToolContext } from "@/lib/editor/webmcp/tools";

const aspect = "reel_9_16" as const;
const runTool = async (tools: ReturnType<typeof createEditorWebMcpTools>, name: string, input: Record<string, unknown>) => JSON.parse(await tools.find((tool) => tool.name === name)!.execute(input));

const setup = (prepareTranscription?: EditorWebMcpToolContext["prepareTranscription"]) => {
  let state = createInitialEditorHistory();
  state = editorHistoryReducer(state, { type: "add-clip", aspect, clip: { ...createDefaultClip("video", "asset", "video"), id: "clip", startFrame: 0, endFrame: 90, trimEndFrame: 90 } });
  const context: EditorWebMcpToolContext = { getState: () => state, prepareTranscription, dispatchCommand: (command) => { state = editorHistoryReducer(state, command); } };
  return { tools: createEditorWebMcpTools(context), state: () => state, bump: () => { state = { ...state, revision: (state.revision ?? 0) + 1 }; } };
};

describe("local transcription WebMCP workflow", () => {
  it("prepares without mutating and previews clip-local cues", async () => {
    const f = setup(vi.fn(async () => ({ filename: "clip.wav", durationSeconds: 3 })));
    const before = f.state().present;
    const prepared = await runTool(f.tools, "editor_prepare_transcription", { aspect, clipId: "clip", confirmed: true });
    expect(prepared).toMatchObject({ ok: true, filename: "clip.wav", timestampOrigin: "trimmed-audio-start" });
    expect(f.state().present).toBe(before);
    const preview = await runTool(f.tools, "editor_preview_transcript", { ticketId: prepared.ticketId, content: JSON.stringify({ segments: [{ start: 0.05, end: 1, text: "Hello" }] }) });
    expect(preview.cues[0]).toMatchObject({ startFrame: 1, endFrame: 30, text: "Hello" });
  });

  it("applies one caption lane transaction and makes retries safe", async () => {
    const f = setup(async () => ({ filename: "x.wav", durationSeconds: 3 }));
    const ticket = await runTool(f.tools, "editor_prepare_transcription", { aspect, clipId: "clip", confirmed: true });
    const preview = await runTool(f.tools, "editor_preview_transcript", { ticketId: ticket.ticketId, content: JSON.stringify({ segments: [{ start: 0, end: 1, text: "Hello" }] }) });
    const input = { aspect, ticketId: ticket.ticketId, previewId: preview.previewId, expectedRevision: f.state().revision, operationId: "apply-1", confirmed: true };
    expect(await runTool(f.tools, "editor_apply_transcript", input)).toMatchObject({ ok: true });
    expect(await runTool(f.tools, "editor_apply_transcript", input)).toMatchObject({ ok: true });
    expect(f.state().present.versions[aspect].tracks?.filter((track) => track.kind === "caption")).toHaveLength(1);
    expect(f.state().present.versions[aspect].captionCues).toHaveLength(1);
  });

  it("invalidates an old preview when replacement JSON is invalid", async () => {
    const f = setup(async () => ({ filename: "x.wav", durationSeconds: 3 }));
    const ticket = await runTool(f.tools, "editor_prepare_transcription", { aspect, clipId: "clip", confirmed: true });
    const preview = await runTool(f.tools, "editor_preview_transcript", { ticketId: ticket.ticketId, content: JSON.stringify({ segments: [{ start: 0, end: 1, text: "Hello" }] }) });
    await expect(runTool(f.tools, "editor_preview_transcript", { ticketId: ticket.ticketId, content: "{}" })).rejects.toThrow();
    expect(await runTool(f.tools, "editor_apply_transcript", { aspect, ticketId: ticket.ticketId, previewId: preview.previewId, expectedRevision: f.state().revision, operationId: "apply-old", confirmed: true })).toMatchObject({ ok: false, code: "TRANSCRIPT_NOT_REVIEWED" });
  });

  it("rejects stale async preparation and aspect mismatch", async () => {
    let resolve!: (value: { filename: string; durationSeconds: number }) => void;
    const f = setup(() => new Promise((r) => { resolve = r; }));
    const pending = runTool(f.tools, "editor_prepare_transcription", { aspect, clipId: "clip", confirmed: true });
    f.bump(); resolve({ filename: "x.wav", durationSeconds: 3 });
    await expect(pending).rejects.toThrow(/STALE_TRANSCRIPT/);
    const g = setup(async () => ({ filename: "x.wav", durationSeconds: 3 }));
    const ticket = await runTool(g.tools, "editor_prepare_transcription", { aspect, clipId: "clip", confirmed: true });
    const preview = await runTool(g.tools, "editor_preview_transcript", { ticketId: ticket.ticketId, content: JSON.stringify({ segments: [{ start: 0, end: 1, text: "Hello" }] }) });
    expect(await runTool(g.tools, "editor_apply_transcript", { aspect: "widescreen_16_9", ticketId: ticket.ticketId, previewId: preview.previewId, expectedRevision: g.state().revision, operationId: "wrong-aspect", confirmed: true })).toMatchObject({ ok: false });
  });

  it("rejects transcription while a cutdown is active", async () => {
    const f = setup(async () => ({ filename: "x.wav", durationSeconds: 3 }));
    const state = f.state();
    state.present.activeCutdownId = "cutdown";
    await expect(runTool(f.tools, "editor_prepare_transcription", { aspect, clipId: "clip", confirmed: true })).rejects.toThrow(/aspect master/);
  });
});
