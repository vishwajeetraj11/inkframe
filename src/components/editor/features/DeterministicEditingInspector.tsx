"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import type { AssetRef, Clip, VersionTimeline } from "@/lib/editor/types";
import type { EditorAction } from "@/lib/editor/reducer";
import type { KeyframeProperty } from "@/lib/editor/keyframes";
import type { SpeedPoint } from "@/lib/editor/time-mapping";
import type { AudioItemRef } from "@/lib/editor/audio-ducking";
import { CaptionInspector } from "@/components/editor/inspector/CaptionInspector";
import { LabeledControl } from "@/components/editor/controls/LabeledControl";
import { AudioBalancePanel } from "@/components/editor/features/AudioBalancePanel";
import { ObjectTrackingPanel } from "@/components/editor/features/ObjectTrackingPanel";
import { SelectiveGradingPanel } from "@/components/editor/features/SelectiveGradingPanel";

const fieldClass = "min-h-9 w-full border border-white/20 bg-[#100e0b] px-2 py-1 text-xs text-neutral-100 outline-none disabled:opacity-40";
const buttonClass = `${fieldClass} text-[10px] tracking-wide hover:border-[#ff4f1f]`;
const sectionClass = "border-t border-white/10 pt-3";
const summaryClass = "cursor-pointer text-xs font-semibold text-neutral-100";
type Edit = (action: EditorAction) => boolean;
const propertyLabels: Record<KeyframeProperty, string> = {
  x: "Position X (%)", y: "Position Y (%)", scale: "Source scale", rotation: "Rotation (degrees)", opacity: "Opacity (%)",
};
const fromDisplay = (property: KeyframeProperty, value: number) => property === "rotation" ? value * Math.PI / 180 : property === "scale" ? value : value / 100;
const toDisplay = (property: KeyframeProperty, value: number) => Number((property === "rotation" ? value * 180 / Math.PI : property === "scale" ? value : value * 100).toFixed(4));

const KeyframesInspector = ({ clip, aspect, onEdit }: { clip: Clip; aspect: VersionTimeline["aspect"]; onEdit: Edit }) => {
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [property, setProperty] = useState<KeyframeProperty>("opacity");
  const [frame, setFrame] = useState(0);
  const [value, setValue] = useState(100);
  const [interpolation, setInterpolation] = useState<"linear" | "hold">("linear");
  const points = clip.keyframes?.[property] ?? [];
  const duration = clip.endFrame - clip.startFrame;
  return <details className={sectionClass}>
    <summary className={summaryClass}>Keyframes</summary>
    <form className="mt-3 space-y-2 text-xs" onSubmit={(event) => {
      event.preventDefault();
      const previous = points.find((point) => point.id === editingKeyId) ?? points.find((point) => point.frame === frame);
      const keyframes = { ...clip.keyframes, [property]: [...points.filter((point) => point.frame !== frame && point.id !== editingKeyId), { id: previous?.id ?? `key-${nanoid(8)}`, frame, value: fromDisplay(property, value), interpolation }].sort((left, right) => left.frame - right.frame) };
      if (onEdit({ type: "set-clip-keyframes", aspect, clipId: clip.id, keyframes })) setEditingKeyId(null);
    }}>
      <p className="text-[11px] leading-5 text-neutral-400">Frames start at zero within this clip. A point at the same frame replaces its value.</p>
      <LabeledControl label="Keyframe property"><select aria-label="Keyframe property" className={fieldClass} value={property} onChange={(event) => {
        const next = event.target.value as KeyframeProperty; setProperty(next); setEditingKeyId(null);
        setValue(next === "opacity" ? 100 : next === "scale" ? 1 : next === "rotation" ? 0 : 50);
      }}>{Object.entries(propertyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></LabeledControl>
      <div className="grid grid-cols-2 gap-2">
        <LabeledControl label="Keyframe frame"><input aria-label="Keyframe frame" className={fieldClass} type="number" required min={0} max={duration} step={1} value={frame} onChange={(event) => setFrame(Number(event.target.value))} /></LabeledControl>
        <LabeledControl label="Keyframe value"><input aria-label="Keyframe value" className={fieldClass} type="number" required step="any" min={property === "opacity" ? 0 : property === "scale" ? 0.0001 : undefined} max={property === "opacity" ? 100 : undefined} value={value} onChange={(event) => setValue(Number(event.target.value))} /></LabeledControl>
      </div>
      <LabeledControl label="Keyframe interpolation"><select aria-label="Keyframe interpolation" className={fieldClass} value={interpolation} onChange={(event) => setInterpolation(event.target.value as "linear" | "hold")}><option value="linear">Linear</option><option value="hold">Hold</option></select></LabeledControl>
      <button type="submit" className={buttonClass}>Save keyframe</button>
      <ul aria-label="Keyframe points" className="space-y-2">{points.map((point) => <li key={point.id} className="border-t border-white/10 pt-2">
        <p className="app-data text-[10px] text-neutral-300">Frame {point.frame}: {toDisplay(property, point.value)} · {point.interpolation}</p>
        <div className="mt-1 flex gap-2"><button type="button" className={buttonClass} aria-label={`Edit keyframe at ${point.frame}`} onClick={() => { setEditingKeyId(point.id); setFrame(point.frame); setValue(toDisplay(property, point.value)); setInterpolation(point.interpolation); }}>Edit</button><button type="button" className={buttonClass} aria-label={`Delete keyframe at ${point.frame}`} onClick={() => onEdit({ type: "set-clip-keyframes", aspect, clipId: clip.id, keyframes: { ...clip.keyframes, [property]: points.filter((item) => item.id !== point.id) } })}>Delete</button></div>
      </li>)}</ul>
    </form>
  </details>;
};

const TimeMappingInspector = ({ clip, aspect, asset, onEdit }: { clip: Clip; aspect: VersionTimeline["aspect"]; asset?: AssetRef; onEdit: Edit }) => {
  const existingPoints = clip.timeMapping?.kind === "speed" ? clip.timeMapping.points : [{ frame: 0, speed: 1, interpolation: "linear" as const }];
  const [points, setPoints] = useState<SpeedPoint[]>(existingPoints);
  const [start, setStart] = useState(clip.startFrame);
  const [end, setEnd] = useState(clip.endFrame);
  const [sourceSeconds, setSourceSeconds] = useState(clip.trimStartFrame / 30);
  const sourceDurationUs = asset?.mediaMetadata?.durationUs ?? clip.sourceDurationUs;
  const canRetime = Number.isFinite(sourceDurationUs) && (sourceDurationUs ?? 0) > 0;
  const duration = clip.endFrame - clip.startFrame;
  return <details className={sectionClass}>
    <summary className={summaryClass}>Speed & freeze</summary>
    <div className="mt-3 space-y-3 text-xs">
      <p className="text-[11px] leading-5 text-neutral-400">Retiming keeps the clip’s timeline length. Embedded video audio is muted while a speed map or freeze is active.</p>
      {!canRetime ? <p role="status" className="text-[#ff9b7d]">Source duration is not available yet. Load the video before applying speed or freeze edits.</p> : null}
      {clip.timeMapping && clip.timeMapping.kind !== "normal" ? <button type="button" className={buttonClass} onClick={() => onEdit({ type: "set-clip-time-mapping", aspect, clipId: clip.id, mapping: { kind: "normal" } })}>Restore normal playback</button> : null}
      <fieldset disabled={!canRetime} className="space-y-3 disabled:opacity-40">
        <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); onEdit({ type: "set-clip-time-mapping", aspect, clipId: clip.id, mapping: { kind: "speed", points, ...(clip.timeMapping?.kind === "speed" && clip.timeMapping.sourceStartTimeUs !== undefined ? { sourceStartTimeUs: clip.timeMapping.sourceStartTimeUs } : {}) }, sourceDurationUs }); }}>
          <p className="text-neutral-300">Speed points · clip-local frames</p>
          {points.map((point, index) => <div key={index} className="space-y-2 border-t border-white/10 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <LabeledControl label={`Speed frame ${index + 1}`}><input aria-label={`Speed frame ${index + 1}`} className={fieldClass} type="number" required min={0} max={duration} step={1} value={point.frame} onChange={(event) => setPoints(points.map((item, i) => i === index ? { ...item, frame: Number(event.target.value) } : item))} /></LabeledControl>
              <LabeledControl label={`Speed multiplier ${index + 1}`}><input aria-label={`Speed multiplier ${index + 1}`} className={fieldClass} type="number" required min={0.01} step={0.01} value={point.speed} onChange={(event) => setPoints(points.map((item, i) => i === index ? { ...item, speed: Number(event.target.value) } : item))} /></LabeledControl>
            </div>
            <LabeledControl label={`Speed interpolation ${index + 1}`}><select aria-label={`Speed interpolation ${index + 1}`} className={fieldClass} value={point.interpolation} onChange={(event) => setPoints(points.map((item, i) => i === index ? { ...item, interpolation: event.target.value as "linear" | "hold" } : item))}><option value="linear">Linear ramp</option><option value="hold">Hold speed</option></select></LabeledControl>
            {index > 0 ? <button type="button" className={buttonClass} onClick={() => setPoints(points.filter((_, i) => i !== index))}>Remove speed point {index + 1}</button> : null}
          </div>)}
          <button type="button" className={buttonClass} disabled={(points.at(-1)?.frame ?? 0) >= duration} onClick={() => setPoints([...points, { frame: Math.min(duration, (points.at(-1)?.frame ?? 0) + 30), speed: points.at(-1)?.speed ?? 1, interpolation: "linear" }])}>Add speed point</button>
          <button type="submit" className={buttonClass}>Apply speed map</button>
        </form>
        <form className="space-y-2 border-t border-white/10 pt-3" onSubmit={(event) => {
          event.preventDefault();
          onEdit({ type: "freeze-clip-range", aspect, clipId: clip.id, startFrame: start, endFrame: end, sourceTimeUs: Math.round(sourceSeconds * 1_000_000), sourceDurationUs, segmentIds: Array.from({ length: 1 + Number(start > clip.startFrame) + Number(end < clip.endFrame) }, () => `freeze-${nanoid(8)}`) });
        }}>
          <p className="text-neutral-300">Freeze a timeline range</p>
          <div className="grid grid-cols-2 gap-2">
            <LabeledControl label="Freeze start frame"><input aria-label="Freeze start frame" className={fieldClass} type="number" min={clip.startFrame} max={clip.endFrame - 1} step={1} required value={start} onChange={(event) => setStart(Number(event.target.value))} /></LabeledControl>
            <LabeledControl label="Freeze end frame"><input aria-label="Freeze end frame" className={fieldClass} type="number" min={start + 1} max={clip.endFrame} step={1} required value={end} onChange={(event) => setEnd(Number(event.target.value))} /></LabeledControl>
          </div>
          <LabeledControl label="Freeze source time (seconds)"><input aria-label="Freeze source time (seconds)" className={fieldClass} type="number" min={0} max={canRetime ? (sourceDurationUs! - 1) / 1_000_000 : undefined} step="any" required value={sourceSeconds} onChange={(event) => setSourceSeconds(Number(event.target.value))} /></LabeledControl>
          <button type="submit" className={buttonClass}>Freeze range</button>
        </form>
      </fieldset>
    </div>
  </details>;
};

const DuckingInspector = ({ version, assetNames, onEdit }: { version: VersionTimeline; assetNames: Record<string, string>; onEdit: Edit }) => {
  const items = [...version.audioTracks.map((item) => ({ ref: { kind: "audio" as const, id: item.id }, label: `Audio: ${assetNames[item.assetId] ?? item.assetId} · ${item.startFrame}–${item.endFrame} frames` })), ...version.clips.filter((clip) => clip.kind === "video").map((clip) => ({ ref: { kind: "video" as const, id: clip.id }, label: `Video sound: ${assetNames[clip.assetId] ?? clip.assetId} · ${clip.startFrame}–${clip.endFrame} frames` }))];
  const key = (ref: AudioItemRef) => `${ref.kind}:${ref.id}`;
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [targetKey, setTargetKey] = useState("");
  const [triggerKey, setTriggerKey] = useState("");
  const [additionalTriggers, setAdditionalTriggers] = useState<AudioItemRef[]>([]);
  const [attenuationDb, setAttenuationDb] = useState(-12);
  const [attackFrames, setAttackFrames] = useState(6);
  const [releaseFrames, setReleaseFrames] = useState(15);
  const target = items.find((item) => key(item.ref) === targetKey) ?? items[0];
  const choices = items.filter((item) => key(item.ref) !== (target && key(target.ref)));
  const trigger = choices.find((item) => key(item.ref) === triggerKey) ?? choices[0];
  if (items.length < 2) return <details className={sectionClass}>
    <summary className={summaryClass}>Audio ducking</summary>
    <div className="mt-3 border border-dashed border-white/15 bg-white/[0.02] p-3">
      <p className="text-sm font-medium text-neutral-200">Add two audio sources</p>
      <p className="mt-1 text-[11px] leading-5 text-neutral-400">Choose one soundtrack and one narration source to create a ducking rule.</p>
    </div>
  </details>;
  return <details className={sectionClass}>
    <summary className={summaryClass}>Audio ducking</summary>
    <form className="mt-3 space-y-3 text-xs" onSubmit={(event) => {
      event.preventDefault(); if (!target || !trigger) return;
      if (onEdit({ type: "set-ducking-rule", aspect: version.aspect, rule: { id: editingRuleId ?? `duck-${nanoid(8)}`, target: target.ref, triggers: [trigger.ref, ...additionalTriggers.filter((ref) => key(ref) !== key(trigger.ref) && key(ref) !== key(target.ref))], attenuationDb, attackFrames, releaseFrames } })) { setEditingRuleId(null); setAdditionalTriggers([]); }
    }}>
      <p className="text-[11px] leading-5 text-neutral-400">Lower one soundtrack during a selected narration clip’s timeline interval.</p>
      <LabeledControl label="Ducking target"><select aria-label="Ducking target" className={fieldClass} value={target ? key(target.ref) : ""} disabled={!items.length} onChange={(event) => setTargetKey(event.target.value)}>{items.map((item) => <option key={key(item.ref)} value={key(item.ref)}>{item.label}</option>)}</select></LabeledControl>
      <LabeledControl label="Narration source"><select aria-label="Narration source" className={fieldClass} value={trigger ? key(trigger.ref) : ""} disabled={!choices.length} onChange={(event) => setTriggerKey(event.target.value)}>{choices.map((item) => <option key={key(item.ref)} value={key(item.ref)}>{item.label}</option>)}</select></LabeledControl>
      {additionalTriggers.length ? <p className="text-neutral-400">Also includes {additionalTriggers.length} additional narration source(s) from this rule.</p> : null}
      <LabeledControl label="Ducking attenuation (dB)"><input aria-label="Ducking attenuation (dB)" className={fieldClass} type="number" min={-60} max={0} required value={attenuationDb} onChange={(event) => setAttenuationDb(Number(event.target.value))} /></LabeledControl>
      <div className="grid grid-cols-2 gap-2"><LabeledControl label="Attack frames"><input aria-label="Attack frames" className={fieldClass} type="number" min={0} max={1800} step={1} required value={attackFrames} onChange={(event) => setAttackFrames(Number(event.target.value))} /></LabeledControl><LabeledControl label="Release frames"><input aria-label="Release frames" className={fieldClass} type="number" min={0} max={1800} step={1} required value={releaseFrames} onChange={(event) => setReleaseFrames(Number(event.target.value))} /></LabeledControl></div>
      <button type="submit" className={buttonClass} disabled={!target || !trigger}>{editingRuleId ? "Save ducking rule" : "Add ducking rule"}</button>
      {editingRuleId ? <button type="button" className={buttonClass} onClick={() => { setEditingRuleId(null); setAdditionalTriggers([]); }}>Cancel ducking edit</button> : null}
      {!trigger ? <p className="text-neutral-400">Add two audio sources to choose music and narration.</p> : null}
      <ul aria-label="Ducking rules" className="space-y-2">{(version.duckingRules ?? []).map((rule, index) => <li key={rule.id} className="border-t border-white/10 pt-2">
        <p className="text-neutral-300">{items.find((item) => key(item.ref) === key(rule.target))?.label ?? "Missing source"}: {rule.attenuationDb} dB</p>
        <p className="text-[10px] text-neutral-400">Attack {rule.attackFrames} · release {rule.releaseFrames} frames</p>
        <button type="button" className={buttonClass} aria-label={`Edit ducking rule ${index + 1}`} onClick={() => { setEditingRuleId(rule.id); setTargetKey(key(rule.target)); setTriggerKey(key(rule.triggers[0])); setAdditionalTriggers(rule.triggers.slice(1)); setAttenuationDb(rule.attenuationDb); setAttackFrames(rule.attackFrames); setReleaseFrames(rule.releaseFrames); }}>Edit rule</button>
        <button type="button" className={buttonClass} aria-label={`Remove ducking rule ${index + 1}`} onClick={() => onEdit({ type: "remove-ducking-rule", aspect: version.aspect, ruleId: rule.id })}>Remove rule</button>
      </li>)}</ul>
    </form>
  </details>;
};

export const DeterministicEditingInspector = ({ version, clip, assets, assetNames, assetSources = {}, revision = 0, disabled, onEdit, selectedCaptionId }: {
  selectedCaptionId?: string | null;
  version: VersionTimeline; clip: Clip | null; assets: readonly AssetRef[]; assetNames: Record<string, string>; assetSources?: Readonly<Record<string, string>>; revision?: number; disabled?: boolean; onEdit: Edit;
}) => <fieldset disabled={disabled} className="space-y-3 bg-[#15120e] p-3 pt-0 disabled:opacity-40">
  {clip ? <SelectiveGradingPanel key={`regions-${version.aspect}-${clip.id}`} clip={clip} aspect={version.aspect} onEdit={onEdit} /> : null}
  {clip?.kind === "video" ? <ObjectTrackingPanel key={`tracking-${revision}-${version.aspect}-${clip.id}-${clip.startFrame}-${clip.endFrame}-${clip.trimStartFrame}-${JSON.stringify(clip.timeMapping)}-${JSON.stringify(clip.transform)}-${JSON.stringify(clip.keyframes)}-${assetSources[clip.assetId]}`} clip={clip} version={version} sourceUrl={assetSources[clip.assetId]} assetNames={assetNames} onEdit={onEdit} /> : null}
  {clip ? <KeyframesInspector key={`${version.aspect}-${clip.id}`} clip={clip} aspect={version.aspect} onEdit={onEdit} /> : null}
  {clip?.kind === "video" ? <TimeMappingInspector key={`${version.aspect}-${clip.id}-${clip.startFrame}-${clip.endFrame}-${JSON.stringify(clip.timeMapping)}`} clip={clip} aspect={version.aspect} asset={assets.find((asset) => asset.assetId === clip.assetId)} onEdit={onEdit} /> : null}
  <CaptionInspector key={`captions-${version.aspect}-${selectedCaptionId ?? ""}`} selectedCueId={selectedCaptionId} version={version} disabled={disabled} onEdit={onEdit} />
  <AudioBalancePanel version={version} assetNames={assetNames} onEdit={onEdit} />
  <DuckingInspector key={`ducking-${version.aspect}`} version={version} assetNames={assetNames} onEdit={onEdit} />
</fieldset>;
