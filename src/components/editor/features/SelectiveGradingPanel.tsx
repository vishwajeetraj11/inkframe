"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import type { Clip, SelectiveColorRegion, VersionTimeline } from "@/lib/editor/types";
import type { EditorAction } from "@/lib/editor/reducer";
import { cloneVideoFilterPreset } from "@/lib/editor/video-filters";
import { LabeledControl } from "@/components/editor/controls/LabeledControl";

const field = "min-h-9 w-full border border-white/20 bg-[#100e0b] px-2 py-1 text-xs text-neutral-100 outline-none focus-visible:border-[#ff4f1f] disabled:opacity-40";
const freshRegion = (): SelectiveColorRegion => ({ id: `region-${nanoid(8)}`, shape: "ellipse", x: .5, y: .5, width: .5, height: .5, feather: .3, exposure: 0, temperature: 0, tint: 0, saturation: 1 });

export function SelectiveGradingPanel({ clip, aspect, onEdit }: { clip: Clip; aspect: VersionTimeline["aspect"]; onEdit: (action: EditorAction) => boolean }) {
  const [draft, setDraft] = useState<SelectiveColorRegion>(freshRegion);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const regions = clip.videoFilter?.selectiveRegions ?? [];
  const saveRegions = (next: SelectiveColorRegion[]) => onEdit({ type: "update-clip", aspect, clipId: clip.id, patch: { videoFilter: { ...(clip.videoFilter ?? cloneVideoFilterPreset("none")), selectiveRegions: next } } });
  const numberFields: { key: "x" | "y" | "width" | "height" | "feather" | "exposure" | "temperature" | "tint" | "saturation"; label: string; min: number; max: number; step: number; factor?: number }[] = [
    { key: "x", label: "Region center X (%)", min: 0, max: 100, step: 1, factor: 100 },
    { key: "y", label: "Region center Y (%)", min: 0, max: 100, step: 1, factor: 100 },
    { key: "width", label: "Region width (%)", min: 1, max: 100, step: 1, factor: 100 },
    { key: "height", label: "Region height (%)", min: 1, max: 100, step: 1, factor: 100 },
    { key: "feather", label: "Region feather (%)", min: 0, max: 100, step: 1, factor: 100 },
    { key: "exposure", label: "Region exposure (stops)", min: -2, max: 2, step: .1 },
    { key: "temperature", label: "Region temperature", min: -1, max: 1, step: .05 },
    { key: "tint", label: "Region tint", min: -1, max: 1, step: .05 },
    { key: "saturation", label: "Region saturation", min: 0, max: 2, step: .05 },
  ];
  return <details className="border-t border-white/10 pt-3">
    <summary className="cursor-pointer text-xs font-semibold text-neutral-100">Selective grading</summary>
    <div className="mt-3 space-y-3 text-xs">
      <p className="text-[11px] leading-5 text-neutral-400">Grade a fixed area of this source image. Regions stay in source coordinates as the clip moves. Save to see the result in the main preview and export.</p>
      <ul aria-label="Grading regions" className="space-y-2">{regions.map((region, index) => <li key={region.id} className="border-b border-white/10 pb-2">
        <p className="mb-1 text-neutral-300">Region {index + 1} · {region.shape} · {region.exposure > 0 ? "+" : ""}{region.exposure} stops</p>
        <div className="flex gap-2"><button type="button" className={field} aria-label={`Edit region ${index + 1}`} onClick={() => { setDraft({ ...region }); setEditing(true); setError(null); }}>Edit</button><button type="button" className={field} aria-label={`Remove region ${index + 1}`} onClick={() => {
          if (saveRegions(regions.filter((item) => item.id !== region.id))) { if (draft.id === region.id) { setDraft(freshRegion()); setEditing(false); } setError(null); } else setError("This region could not be removed. Try again.");
        }}>Remove</button></div>
      </li>)}</ul>
      <form className="space-y-3" onSubmit={(event) => {
        event.preventDefault();
        if (editing && !regions.some((item) => item.id === draft.id)) { setError("This region changed. Choose it again before saving."); return; }
        const next = editing ? regions.map((item) => item.id === draft.id ? draft : item) : [...regions, draft];
        if (saveRegions(next)) { setDraft(freshRegion()); setEditing(false); setError(null); } else setError("The region could not be saved. Check its values and try again.");
      }}>
        <LabeledControl label="Region shape"><select aria-label="Region shape" className={field} value={draft.shape} onChange={(event) => setDraft({ ...draft, shape: event.target.value as SelectiveColorRegion["shape"] })}><option value="ellipse">Ellipse</option><option value="rectangle">Rectangle</option></select></LabeledControl>
        <div className="relative h-28 overflow-hidden border border-white/15 bg-white/[0.03]" role="img" aria-label="Region placement diagram; source coordinates">
          <div className="absolute border-2 border-[#ff4f1f] bg-[#ff4f1f]/15" style={{ left: `${(draft.x - draft.width / 2) * 100}%`, top: `${(draft.y - draft.height / 2) * 100}%`, width: `${draft.width * 100}%`, height: `${draft.height * 100}%`, borderRadius: draft.shape === "ellipse" ? "50%" : 0 }} />
        </div>
        <div className="grid grid-cols-2 gap-2">{numberFields.map(({ key, label, min, max, step, factor = 1 }) => <LabeledControl key={key} label={label}><input className={field} aria-label={label} type="number" required min={min} max={max} step={step} value={Number((draft[key] * factor).toFixed(4))} onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) / factor })} /></LabeledControl>)}</div>
        <label className="flex min-h-9 items-center gap-2 text-neutral-300"><input type="checkbox" checked={draft.inverted ?? false} onChange={(event) => setDraft({ ...draft, inverted: event.target.checked })} />Grade outside region</label>
        <button type="submit" className={field} disabled={!editing && regions.length >= 8}>{editing ? "Save region" : "Add grading region"}</button>
        {!editing && regions.length >= 8 ? <p className="text-neutral-400">Eight regions maximum. Edit or remove an existing region.</p> : null}
        {editing ? <button type="button" className={field} onClick={() => { setDraft(freshRegion()); setEditing(false); setError(null); }}>Cancel region edit</button> : null}
        {error ? <p role="alert" className="text-[#ff9b7d]">{error}</p> : null}
      </form>
    </div>
  </details>;
}
