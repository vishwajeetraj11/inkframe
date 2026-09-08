"use client";

import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import type { Clip, VersionTimeline } from "@/lib/editor/types";
import type { EditorAction } from "@/lib/editor/reducer";
import type { CaptionCue } from "@/lib/editor/captions";
import { transcriptToCaptionCues } from "@/lib/editor/local-transcription";
import { ensureEditorTracks } from "@/lib/editor/tracks";
import { prepareTranscriptionAudio } from "@/lib/export/transcription-audio";
import { downloadTranscriptionAudio } from "@/lib/export/transcription-download";

const field = "min-h-9 w-full border border-white/15 bg-[#100e0b] px-2 py-1 text-xs text-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f] disabled:opacity-40";
const button = `${field} hover:border-[#ff4f1f]`;

export function LocalTranscriptionPanel({ clip, version, sourceUrl, onEdit }: {
  clip: Clip; version: VersionTimeline; sourceUrl?: string; onEdit: (action: EditorAction) => boolean;
}) {
  const [prepared, setPrepared] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState("");
  const [cues, setCues] = useState<CaptionCue[] | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const [trackId] = useState(() => `transcript-${nanoid(10)}`);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  const supported = !clip.timeMapping || clip.timeMapping.kind === "normal";
  const prepare = async () => {
    controller.current?.abort();
    const run = new AbortController(); controller.current = run;
    setBusy(true); setError(""); setPrepared(null); setCues(null); setReviewed(false);
    try {
      if (!sourceUrl) throw new Error("Import the source video first.");
      const result = await prepareTranscriptionAudio({ url: sourceUrl, clip, signal: run.signal });
      if (!alive.current || controller.current !== run || run.signal.aborted) return;
      downloadTranscriptionAudio(result.blob, result.filename);
      setPrepared(result.filename);
    } catch (cause) {
      if (alive.current && controller.current === run) setError(run.signal.aborted ? "Audio preparation cancelled." : cause instanceof Error ? cause.message : "Could not prepare audio.");
    } finally { if (alive.current && controller.current === run) setBusy(false); }
  };
  return <details className="border-t border-white/10 pt-3">
    <summary className="cursor-pointer text-xs font-semibold text-neutral-200">Local transcription</summary>
    <div className="mt-3 space-y-3 text-xs">
      <p className="leading-5 text-neutral-400">Use installed Whisper through your desktop agent. Audio stays local; this browser cannot launch Whisper or check whether it is installed.</p>
      {!supported ? <p role="status" className="text-[#ff9b7d]">Restore normal speed before transcribing this clip.</p> : null}
      <button type="button" className={button} disabled={busy || !sourceUrl || !supported} onClick={() => void prepare()}>{busy ? "Preparing audio…" : "1. Download audio for Whisper"}</button>
      {busy ? <button type="button" className={button} onClick={() => controller.current?.abort()}>Cancel audio preparation</button> : null}
      {prepared ? <>
        <p role="status" className="break-words leading-5 text-neutral-300">Audio download requested: {prepared}. Run scripts/transcribe-local.py on that WAV, then paste its JSON below. Its timestamps start at zero in the downloaded audio.</p>
        <label className="block space-y-1"><span>2. Whisper JSON</span><textarea aria-label="Whisper JSON" className={field} rows={5} maxLength={200000} value={content} onChange={(event) => { setContent(event.target.value); setCues(null); setReviewed(false); setError(""); }} placeholder={'{"segments":[{"start":0,"end":1,"text":"Hello"}]}'} /></label>
        <button type="button" className={button} disabled={!content.trim()} onClick={() => {
          setCues(null); setReviewed(false); setError("");
          try { setCues(transcriptToCaptionCues({ content, clip, trackId, idPrefix: trackId })); }
          catch (cause) { setError(cause instanceof Error ? cause.message : "Invalid transcript."); }
        }}>Preview caption timing</button>
      </> : null}
      {cues ? <>
        <p className="text-neutral-300">{cues.length} captions · new caption track · existing captions unchanged</p>
        <ol aria-label="Transcript preview" className="max-h-48 space-y-2 overflow-auto">{cues.map((cue) => <li key={cue.id} className="border-t border-white/10 pt-2"><span className="app-data text-[10px] text-neutral-400">{(cue.startFrame / 30).toFixed(2)}–{(cue.endFrame / 30).toFixed(2)}s</span><p className="break-words">{cue.text}</p></li>)}</ol>
        <label className="flex items-start gap-2 leading-5"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />I reviewed the words and timing against the audio.</label>
        <button type="button" className={button} disabled={!reviewed} onClick={() => {
          const tracks = ensureEditorTracks(version);
          if (tracks.some((track) => track.id === trackId)) { setError("This transcript was already applied. Prepare a new handoff to import another."); return; }
          const accepted = onEdit({ type: "replace-version", aspect: version.aspect, version: { ...version,
            tracks: [...tracks, { id: trackId, name: "Local transcript", kind: "caption", order: tracks.length }],
            captionCues: [...(version.captionCues ?? []), ...cues],
          } });
          if (accepted) { setCues(null); setPrepared(null); setContent(""); setReviewed(false); }
          else setError("Captions could not be applied. Prepare audio again after checking the timeline.");
        }}>3. Add reviewed captions</button>
        <p className="text-[11px] leading-5 text-neutral-400">Adds captions only. Transcript-driven video cuts are not included. Undo restores the previous timeline.</p>
      </> : null}
      {error ? <p role="alert" className="break-words text-[#ff9b7d]">{error}</p> : null}
    </div>
  </details>;
}
