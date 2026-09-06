"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import { Captions, Plus } from "lucide-react";
import { importCaptions, type CaptionCue } from "@/lib/editor/captions";
import type { EditorAction } from "@/lib/editor/reducer";
import type { VersionTimeline } from "@/lib/editor/types";
import { ensureEditorTracks } from "@/lib/editor/tracks";
import { LabeledControl } from "@/components/editor/controls/LabeledControl";

const fieldClass = "min-h-9 w-full border border-white/15 bg-[#100e0b] px-2 py-1 text-xs text-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f] disabled:opacity-40";
const buttonClass = `${fieldClass} text-[10px] tracking-wide hover:border-[#ff4f1f]`;

export const CaptionInspector = ({ version, disabled, onEdit, selectedCueId }: {
  version: VersionTimeline;
  selectedCueId?: string | null;
  disabled?: boolean;
  onEdit: (action: EditorAction) => boolean;
}) => {
  const selectedCue = version.captionCues?.find((cue) => cue.id === selectedCueId);
  const tracks = ensureEditorTracks(version).filter((track) => track.kind === "caption");
  const [chosenTrack, setChosenTrack] = useState(selectedCue?.trackId ?? "");
  const trackId = tracks.some((track) => track.id === chosenTrack) ? chosenTrack : tracks[0]?.id ?? "";
  const [editingId, setEditingId] = useState<string | null>(selectedCue?.id ?? null);
  const [text, setText] = useState(selectedCue?.text ?? "");
  const [start, setStart] = useState(selectedCue?.startFrame ?? 0);
  const [end, setEnd] = useState(selectedCue?.endFrame ?? 90);
  const [content, setContent] = useState("");
  const [format, setFormat] = useState<"srt" | "vtt">("srt");
  const [error, setError] = useState("");
  const cues = (version.captionCues ?? []).filter((cue) => cue.trackId === trackId);
  const reset = () => { setEditingId(null); setText(""); setError(""); };
  const editCue = (cue: CaptionCue) => {
    setEditingId(cue.id); setChosenTrack(cue.trackId); setText(cue.text);
    setStart(cue.startFrame); setEnd(cue.endFrame); setError("");
  };
  const addTrack = () => {
    const id = `captions-${nanoid(8)}`;
    if (onEdit({ type: "add-track", aspect: version.aspect, track: {
      id, kind: "caption", name: `Captions ${tracks.length + 1}`, order: ensureEditorTracks(version).length,
    } })) setChosenTrack(id);
  };

  return <details open={selectedCue ? true : undefined} className="border-t border-white/10 pt-3">
    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold tracking-wide text-neutral-200 marker:hidden">
      <Captions aria-hidden="true" className="h-4 w-4 text-neutral-400" strokeWidth={1.8} />
      Captions
    </summary>
    <fieldset disabled={disabled} className="mt-3 space-y-3 text-xs disabled:opacity-40">
      <button type="button" className={`${buttonClass} inline-flex items-center justify-center gap-1.5`} onClick={addTrack}>
        <Plus aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
        Add caption track
      </button>
      {tracks.length > 0 ? <>
        <LabeledControl label="Caption track"><select aria-label="Caption track" className={fieldClass} value={trackId} onChange={(event) => { setChosenTrack(event.target.value); reset(); }}>{tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select></LabeledControl>
        <form className="space-y-2" onSubmit={(event) => {
          event.preventDefault(); setError("");
          if (onEdit({ type: "upsert-caption-cues", aspect: version.aspect, cues: [{ id: editingId ?? `caption-${nanoid(8)}`, trackId, startFrame: start, endFrame: end, text: text.trim() }] })) reset();
          else setError("Caption not saved. Use a nonempty caption and a valid range that does not overlap another cue.");
        }}>
          <div className="grid grid-cols-2 gap-2">
            <LabeledControl label="Caption start frame"><input aria-label="Caption start frame" className={fieldClass} type="number" min={0} max={1799} step={1} required value={start} onChange={(event) => setStart(Number(event.target.value))} /></LabeledControl>
            <LabeledControl label="Caption end frame"><input aria-label="Caption end frame" className={fieldClass} type="number" min={start + 1} max={1800} step={1} required value={end} onChange={(event) => setEnd(Number(event.target.value))} /></LabeledControl>
          </div>
          <LabeledControl label="Caption text"><textarea aria-label="Caption text" className={fieldClass} rows={3} required value={text} onChange={(event) => setText(event.target.value)} /></LabeledControl>
          <button type="submit" className={buttonClass}>{editingId ? "Save caption" : "Add caption"}</button>
          {editingId ? <button type="button" className={buttonClass} onClick={reset}>Cancel caption edit</button> : null}
        </form>
        <ul className="space-y-2" aria-label="Caption cues">{cues.map((cue) => <li key={cue.id} className="border-t border-white/10 pt-2">
          <p className="break-words text-neutral-200">{cue.text}</p><p className="app-data text-[10px] text-neutral-400">{cue.startFrame}–{cue.endFrame} frames</p>
          <div className="mt-1 flex gap-2"><button type="button" className={buttonClass} aria-label={`Edit caption ${cue.text}`} onClick={() => editCue(cue)}>Edit</button><button type="button" className={buttonClass} aria-label={`Delete caption ${cue.text}`} onClick={() => { if (onEdit({ type: "remove-caption-cue", aspect: version.aspect, cueId: cue.id }) && editingId === cue.id) reset(); }}>Delete</button></div>
        </li>)}</ul>
        <details className="border-t border-white/10 pt-2"><summary className="cursor-pointer text-neutral-300">Import subtitles</summary>
          <div className="mt-2 space-y-2">
            <LabeledControl label="Subtitle format"><select aria-label="Subtitle format" className={fieldClass} value={format} onChange={(event) => setFormat(event.target.value as "srt" | "vtt")}><option value="srt">SRT</option><option value="vtt">WebVTT</option></select></LabeledControl>
            <LabeledControl label="Subtitle content"><textarea aria-label="Subtitle content" className={fieldClass} rows={5} value={content} onChange={(event) => setContent(event.target.value)} /></LabeledControl>
            <button type="button" disabled={!content.trim()} className={buttonClass} onClick={() => {
              const result = importCaptions({ format, content, trackId, idPrefix: `import-${nanoid(8)}` });
              if (!result.ok) { setError(result.issues.map((issue) => issue.message).join(" ")); return; }
              if (onEdit({ type: "upsert-caption-cues", aspect: version.aspect, cues: result.cues })) { setContent(""); setError(""); }
              else setError("Import not applied. Check for overlapping cues on this track.");
            }}>Import captions</button>
          </div>
        </details>
      </> : <p className="text-neutral-400">Add a caption track to enter cues or import SRT / WebVTT subtitles.</p>}
      {error ? <p role="alert" className="text-[#ff9b7d]">{error}</p> : null}
    </fieldset>
  </details>;
};
