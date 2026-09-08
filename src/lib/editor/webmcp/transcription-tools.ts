import { z } from "zod";
import { getWebMCPExecuteSignal, type WebMcpTool } from "@/lib/webmcp/types";
import { transcriptToCaptionCues, transcriptionClipFingerprint } from "../local-transcription";
import { ensureEditorTracks } from "../tracks";
import type { CaptionCue } from "../captions";
import type { AspectPreset, Clip } from "../types";
import type { EditorAction } from "../reducer";
import type { EditorWebMcpToolContext } from "./tools";

const id = z.string().trim().min(1).max(128);
const aspect = z.enum(["reel_9_16", "widescreen_16_9"]);
type Command = (input: { aspect: AspectPreset; expectedRevision: number; operationId: string }, action: () => EditorAction | EditorAction[]) => string;
function tool<T extends z.ZodType>(name: string, description: string, schema: T, readOnly: boolean,
  execute: (input: z.infer<T>, signal: AbortSignal) => unknown | Promise<unknown>): WebMcpTool {
  return { name, description, inputSchema: z.toJSONSchema(schema), annotations: { readOnlyHint: readOnly, untrustedContentHint: true },
    execute: async (input, options) => {
      const signal = getWebMCPExecuteSignal(options);
      signal.throwIfAborted();
      const result = await execute(schema.parse(input), signal);
      signal.throwIfAborted();
      return typeof result === "string" ? result : JSON.stringify(result);
    } };
}

/** Page-scoped handoff tickets prevent applying a transcript to a changed source. */
export function createTranscriptionTools(context: EditorWebMcpToolContext, command: Command): WebMcpTool[] {
  const tickets = new Map<string, { aspect: AspectPreset; clipId: string; fingerprint: string; revision: number; expires: number; cues?: CaptionCue[]; previewId?: string; trackId: string }>();
  let sequence = 0;
  const token = () => `transcript-${Date.now().toString(36)}-${++sequence}`;
  const version = (value: AspectPreset) => {
    if (context.getState().present.activeCutdownId) throw new Error("Select an aspect master for local transcription.");
    return context.getState().present.versions[value];
  };
  const requireClip = (value: AspectPreset, clipId: string): Clip => {
    const clip = version(value).clips.find((entry) => entry.id === clipId);
    if (!clip || clip.kind !== "video") throw new Error("Select an existing video clip.");
    if (clip.timeMapping && clip.timeMapping.kind !== "normal") throw new Error("Restore normal speed before transcribing.");
    return clip;
  };
  const requireTicket = (ticketId: string) => {
    const ticket = tickets.get(ticketId);
    if (!ticket || ticket.expires <= Date.now()) throw new Error("TRANSCRIPT_EXPIRED: Prepare audio again.");
    if (ticket.revision !== (context.getState().revision ?? 0) || transcriptionClipFingerprint(requireClip(ticket.aspect, ticket.clipId)) !== ticket.fingerprint) throw new Error("STALE_TRANSCRIPT: Project changed; prepare audio again.");
    return ticket;
  };
  return [
    tool("editor_prepare_transcription", "Download trimmed WAV for desktop Whisper; returns a ticket. Does not run native software. Normal-speed master video only. Follow returned handoff instructions.",
      z.object({ aspect, clipId: id, confirmed: z.literal(true) }).strict(), false, async (input, signal) => {
        const clip = requireClip(input.aspect, input.clipId);
        const revision = context.getState().revision ?? 0;
        const fingerprint = transcriptionClipFingerprint(clip);
        if (!context.prepareTranscription) throw new Error("Audio handoff is unavailable.");
        const prepared = await context.prepareTranscription(input.aspect, clip.id, signal);
        if (revision !== (context.getState().revision ?? 0) || transcriptionClipFingerprint(requireClip(input.aspect, clip.id)) !== fingerprint) throw new Error("STALE_TRANSCRIPT: Project changed during audio preparation; discard the downloaded audio and prepare again.");
        signal.throwIfAborted();
        const ticketId = token();
        for (const [key, entry] of tickets) if (entry.expires <= Date.now()) tickets.delete(key);
        if (tickets.size >= 8) tickets.delete(tickets.keys().next().value!);
        tickets.set(ticketId, { aspect: input.aspect, clipId: clip.id, fingerprint, revision, expires: Date.now() + 60 * 60_000, trackId: `${ticketId}-captions` });
        return { ok: true, ticketId, revision, ...prepared, timestampOrigin: "trimmed-audio-start", transcriptionExecuted: false, next: "Run local Whisper on the downloaded WAV; submit standard Whisper JSON to editor_preview_transcript. Review the text and timing before applying." };
      }),
    tool("editor_preview_transcript", "Preview untrusted Whisper JSON segments {start,end,text}, in trimmed-WAV seconds, using a handoff ticket. Returns cues and previewId; no edits.",
      z.object({ ticketId: id, content: z.string().min(1).max(200000) }).strict(), true, (input) => {
        const ticket = requireTicket(input.ticketId);
        // Invalidate prior preview even when replacement content is invalid.
        ticket.cues = undefined; ticket.previewId = undefined;
        const cues = transcriptToCaptionCues({ content: input.content, clip: requireClip(ticket.aspect, ticket.clipId), trackId: ticket.trackId, idPrefix: input.ticketId });
        const previewId = token();
        ticket.cues = cues; ticket.previewId = previewId;
        return { ok: true, ticketId: input.ticketId, previewId, aspect: ticket.aspect, revision: ticket.revision, cues, warning: "Speech recognition can mishear words and timing. Review against the audio; applying adds captions only, not video cuts." };
      }),
    tool("editor_apply_transcript", "Apply reviewed previewId to a new caption lane; preserves captions. Confirmed, revision-checked, undoable and retry-safe by operationId.",
      z.object({ aspect, ticketId: id, previewId: id, expectedRevision: z.number().int().nonnegative(), operationId: id, confirmed: z.literal(true) }).strict(), false, (input) => command(input, () => {
        const ticket = requireTicket(input.ticketId);
        if (ticket.aspect !== input.aspect || ticket.previewId !== input.previewId || !ticket.cues) throw new Error("TRANSCRIPT_NOT_REVIEWED: Preview this transcript first.");
        const current = version(input.aspect);
        return [
          { type: "add-track", aspect: input.aspect, track: { id: ticket.trackId, kind: "caption", name: "Local transcript", order: ensureEditorTracks(current).length } },
          { type: "upsert-caption-cues", aspect: input.aspect, cues: ticket.cues },
        ];
      })),
  ];
}
