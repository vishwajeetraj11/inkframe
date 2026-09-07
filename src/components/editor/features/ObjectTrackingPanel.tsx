"use client";

import { useEffect, useRef, useState } from "react";
import type { Clip, VersionTimeline } from "@/lib/editor/types";
import type { EditorAction } from "@/lib/editor/reducer";
import { ASPECT_PRESETS } from "@/lib/editor/constants";
import { correctTrackingPoint, trackingToKeyframes, type TrackingResult } from "@/lib/editor/object-tracking";
import { trackVideoObject } from "@/lib/export/object-tracking-browser";
import { LabeledControl } from "@/components/editor/controls/LabeledControl";

const field = "min-h-9 w-full border border-white/20 bg-[#100e0b] px-2 py-1 text-xs text-neutral-100 outline-none focus-visible:border-[#ff4f1f] disabled:opacity-40";
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function ObjectTrackingPanel({ clip, version, sourceUrl, assetNames, onEdit }: { clip: Clip; version: VersionTimeline; sourceUrl?: string; assetNames: Record<string, string>; onEdit: (action: EditorAction) => boolean }) {
  const [box, setBox] = useState({ x: .35, y: .35, width: .3, height: .3 });
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [targetId, setTargetId] = useState("");
  const [correction, setCorrection] = useState({ frame: 0, x: .5, y: .5 });
  const controller = useRef<AbortController | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const images = version.clips.filter((item) => item.kind === "image");
  const target = images.find((item) => item.id === targetId) ?? images[0];
  const unsupported = clip.timeMapping && clip.timeMapping.kind !== "normal";
  useEffect(() => () => controller.current?.abort(), []);
  const seekFrame = (frame: number) => { if (video.current && video.current.readyState >= 1) video.current.currentTime = (clip.trimStartFrame + frame) / 30; };
  const changeBox = (next: typeof box) => { setBox(next); setResult(null); setNotice(null); };
  return <details className="border-t border-white/10 pt-3">
    <summary className="cursor-pointer text-xs font-semibold text-neutral-100">Object tracking</summary>
    <div className="mt-3 space-y-3 text-xs">
      <p className="text-[11px] leading-5 text-neutral-400">Draw a box around a textured object in the first clip frame, then analyze its motion locally. This tracks a small patch; cuts, occlusion and large changes can lose it.</p>
      {!sourceUrl ? <p className="text-[#ff9b7d]">Load the source video to analyze motion.</p> : null}
      {unsupported ? <p className="text-[#ff9b7d]">Restore normal playback before tracking this clip.</p> : null}
      {sourceUrl ? <div className="relative touch-none overflow-hidden border border-white/20" onPointerDown={(event) => {
        if (busy || result) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        dragStart.current = { x: clamp((event.clientX - bounds.left) / bounds.width), y: clamp((event.clientY - bounds.top) / bounds.height) };
        event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={(event) => {
        if (!dragStart.current || busy || result) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = clamp((event.clientX - bounds.left) / bounds.width), y = clamp((event.clientY - bounds.top) / bounds.height);
        changeBox({ x: Math.min(x, dragStart.current.x), y: Math.min(y, dragStart.current.y), width: Math.max(.01, Math.abs(x - dragStart.current.x)), height: Math.max(.01, Math.abs(y - dragStart.current.y)) });
      }} onPointerUp={() => { dragStart.current = null; }} onPointerCancel={() => { dragStart.current = null; }}>
        <video ref={video} src={sourceUrl} muted playsInline preload="auto" className="block h-auto w-full" aria-label="Tracking source frame" onLoadedMetadata={() => seekFrame(result ? correction.frame : 0)} />
        {!result ? <div className="pointer-events-none absolute border-2 border-[#ff4f1f] bg-[#ff4f1f]/10" style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }} /> : <div aria-hidden="true" className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#ff4f1f] bg-[#100e0b]" style={{ left: `${correction.x * 100}%`, top: `${correction.y * 100}%` }} />}
      </div> : null}
      <form className="space-y-2" onSubmit={async (event) => {
        event.preventDefault(); if (!sourceUrl || busy) return;
        setError(null); setNotice(null); setResult(null); setBusy(true); setProgress("Preparing source frames…"); seekFrame(0);
        const active = new AbortController(); controller.current = active;
        try {
          const tracked = await trackVideoObject({ url: sourceUrl, clip, box, transitions: version.transitions, signal: active.signal, onProgress: (done, total) => { if (!active.signal.aborted) setProgress(`Analyzed ${done} of ${total} frames`); } });
          if (active.signal.aborted) return;
          setResult(tracked); const first = tracked.points[0]; if (first) setCorrection({ frame: first.frame, x: first.x, y: first.y });
          setProgress("");
        } catch (cause) { if (!active.signal.aborted) setError(cause instanceof Error ? cause.message : "Tracking failed. Try a smaller textured area."); }
        finally { if (!active.signal.aborted) setBusy(false); }
      }}>
        <fieldset disabled={busy} className="grid grid-cols-2 gap-2">{(["x", "y", "width", "height"] as const).map((key) => {
          const label = `Tracking box ${key === "x" ? "left" : key === "y" ? "top" : key} (%)`;
          return <LabeledControl key={key} label={label}><input aria-label={label} className={field} type="number" required min={key === "width" || key === "height" ? 1 : 0} max={100} step="any" value={Number((box[key] * 100).toFixed(3))} onChange={(event) => { changeBox({ ...box, [key]: Number(event.target.value) / 100 }); seekFrame(0); }} /></LabeledControl>;
        })}</fieldset>
        <button type="submit" className={field} disabled={busy || !sourceUrl || !!unsupported}>{busy ? "Analyzing motion…" : "Analyze object motion"}</button>
      </form>
      {busy ? <button type="button" className={field} onClick={() => { controller.current?.abort(); setBusy(false); setProgress(""); setNotice("Tracking canceled."); }}>Cancel tracking</button> : null}
      {progress ? <p role="status" className="text-neutral-300">{progress}</p> : null}
      {result ? <div className="space-y-3 border-t border-white/10 pt-3">
        <p role="status" className={result.status === "lost" ? "text-[#ff9b7d]" : "text-neutral-300"}>{result.status === "lost" ? "Tracking lost" : "Analysis complete"} · {result.points.length} points. {result.message}</p>
        {result.status === "lost" ? <p className="text-[#ff9b7d]">Shorten the source clip to the reliable interval and analyze again before attaching. Manual corrections do not recover an incomplete track.</p> : null}
        <p className="text-[11px] leading-5 text-neutral-400">Review sampled points and correct drift below. Attach replaces the graphic’s X/Y keyframes and follows its anchor. The graphic must cover the tracked interval.</p>
        <LabeledControl label="Review tracking point"><select className={field} aria-label="Review tracking point" value={result.points.some((point) => point.frame === correction.frame) ? correction.frame : ""} onChange={(event) => { const point = result.points.find((item) => item.frame === Number(event.target.value)); if (point) { setCorrection({ frame: point.frame, x: point.x, y: point.y }); seekFrame(point.frame); } }}>
          <option value="" disabled>Choose a sampled point</option>{result.points.map((point) => <option key={point.frame} value={point.frame}>Frame {point.frame} · {point.manual ? "manual" : `${Math.round(point.confidence * 100)}% confidence`}</option>)}
        </select></LabeledControl>
        <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); try { setResult({ ...result, points: correctTrackingPoint(result.points, correction) }); setError(null); setNotice("Correction saved. Attach the path to apply it."); } catch (cause) { setError(cause instanceof Error ? cause.message : "Invalid correction."); } }}>
          <LabeledControl label="Correction frame"><input aria-label="Correction frame" className={field} type="number" required min={0} max={clip.endFrame - clip.startFrame - 1} step={1} value={correction.frame} onChange={(event) => { const frame = Number(event.target.value); setCorrection({ ...correction, frame }); seekFrame(frame); }} /></LabeledControl>
          <div className="grid grid-cols-2 gap-2">{(["x", "y"] as const).map((axis) => <LabeledControl key={axis} label={`Correction ${axis.toUpperCase()} (%)`}><input aria-label={`Correction ${axis.toUpperCase()} (%)`} className={field} type="number" required min={0} max={100} step="any" value={Number((correction[axis] * 100).toFixed(3))} onChange={(event) => setCorrection({ ...correction, [axis]: Number(event.target.value) / 100 })} /></LabeledControl>)}</div>
          <button type="submit" className={field}>Save point correction</button>
        </form>
        {images.length ? <LabeledControl label="Graphic to attach"><select className={field} aria-label="Graphic to attach" value={target?.id ?? ""} onChange={(event) => setTargetId(event.target.value)}>{images.map((image) => <option key={image.id} value={image.id}>{assetNames[image.assetId] ?? image.assetId} · {image.startFrame}–{image.endFrame} frames</option>)}</select></LabeledControl> : <p className="text-neutral-400">Add an image graphic on another track, covering this clip’s interval, to attach it to the path.</p>}
        <button type="button" className={field} disabled={!target || result.points.length < 2 || result.status === "lost"} onClick={() => {
          if (!target || result.status !== "complete") return;
          try {
            const stage = ASPECT_PRESETS[version.aspect];
            const keyframes = trackingToKeyframes({ points: result.points, sourceClip: clip, targetClip: target, sourceWidth: result.sourceWidth, sourceHeight: result.sourceHeight, stageWidth: stage.width, stageHeight: stage.height, transitions: version.transitions });
            if (onEdit({ type: "set-clip-keyframes", aspect: version.aspect, clipId: target.id, keyframes })) { setError(null); setNotice("Motion attached. Play the main preview to review the graphic."); } else setError("The path could not be applied to this graphic.");
          } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not attach this path."); }
        }}>Attach path to graphic</button>
      </div> : null}
      {error ? <p role="alert" className="text-[#ff9b7d]">{error}</p> : null}
      {notice ? <p role="status" className="text-neutral-300">{notice}</p> : null}
    </div>
  </details>;
}
