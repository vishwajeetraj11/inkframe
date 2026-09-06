import { InspectorCard } from "@/components/editor/controls/InspectorCard";
import { LabeledControl } from "@/components/editor/controls/LabeledControl";
import { ChevronDown, Palette } from "lucide-react";
import { useRef, useState } from "react";
import type { Clip, EditorTrack, VideoFilter, VideoFilterPreset } from "@/lib/editor/types";
import { cloneVideoFilterPreset, VIDEO_FILTER_PRESETS } from "@/lib/editor/video-filters";
import { framesToSeconds, parseNumber, secondsToFrames } from "./utils";

const inputClass = "app-data min-h-9 w-full border border-white/15 bg-[#100e0b] px-2 py-1 text-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f] disabled:opacity-40";

/** Draft locally so a numeric edit creates one history entry, including Enter + blur. */
const CommitNumber = ({ label, value, disabled, min, max, step = 1, onCommit }: {
  label: string; value: number; disabled?: boolean; min?: number; max?: number; step?: number; onCommit: (value: number) => void;
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelBlur = useRef(false);
  const commit = () => {
    if (cancelBlur.current) { cancelBlur.current = false; return; }
    if (draft === null) return;
    const parsed = draft.trim() === "" ? NaN : Number(draft);
    setDraft(null);
    if (Number.isFinite(parsed) && (min === undefined || parsed >= min) && (max === undefined || parsed <= max) && parsed !== value) onCommit(parsed);
  };
  return <LabeledControl label={label}><input aria-label={label} type="number" min={min} max={max} step={step} disabled={disabled} value={draft ?? value} onChange={(event) => setDraft(event.currentTarget.value)} onBlur={commit} onKeyDown={(event) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") { cancelBlur.current = true; setDraft(null); event.currentTarget.blur(); }
  }} className={inputClass} /></LabeledControl>;
};

interface ClipInspectorProps {
  clip: Clip;
  tracks?: readonly EditorTrack[];
  onPlaceClip?: (clipId: string, trackId: string, startFrame: number) => void;
  onReorderTracks?: (trackIds: string[]) => void;
  disabled?: boolean;
  onUpdateClip: (clipId: string, patch: Partial<Omit<Clip, "id" | "assetId" | "kind">>) => void;
  onDetachAudio?: (clipId: string) => void;
}

export const ClipInspector = ({
  clip,
  tracks = [],
  onPlaceClip,
  onReorderTracks,
  disabled,
  onUpdateClip,
  onDetachAudio,
}: ClipInspectorProps) => {
  const orderedTracks = [...tracks].sort((left, right) => left.order - right.order);
  const videoTracks = orderedTracks.filter((track) => track.kind === "video");
  const trackId = clip.trackId ?? "inkframe-video";
  const laneIndex = videoTracks.findIndex((track) => track.id === trackId);
  const moveLayer = (offset: number) => {
    const other = videoTracks[laneIndex + offset];
    if (!other || !onReorderTracks) return;
    const ids = orderedTracks.map((track) => track.id);
    const from = ids.indexOf(trackId);
    const to = ids.indexOf(other.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    onReorderTracks(ids);
  };
  const transform = clip.transform;
  const videoFilter = clip.videoFilter ?? VIDEO_FILTER_PRESETS.none;
  const setFilterValue = (
    key: keyof Omit<VideoFilter, "preset">,
    value: number,
  ) => onUpdateClip(clip.id, { videoFilter: { ...videoFilter, preset: "custom", [key]: value } });
  const setTransform = (patch: Partial<NonNullable<Clip["transform"]>>) => {
    if (transform) onUpdateClip(clip.id, { transform: { ...transform, ...patch } });
  };
  return (
    <InspectorCard title="Clip">
      {onPlaceClip ? <div className="space-y-2 border-b border-white/10 pb-3 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <CommitNumber key={`${clip.id}-start-${clip.startFrame}`} label="Start frame" value={clip.startFrame} min={0} step={1} disabled={disabled} onCommit={(frame) => onPlaceClip(clip.id, trackId, Math.round(frame))} />
          <LabeledControl label="Video track"><select aria-label="Video track" value={trackId} disabled={disabled} className={inputClass} onChange={(event) => onPlaceClip(clip.id, event.currentTarget.value, clip.startFrame)}>{videoTracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select></LabeledControl>
        </div>
        {onReorderTracks ? <div className="flex gap-2">
          <button className={`${inputClass} text-[10px]`} type="button" disabled={disabled || laneIndex <= 0} onClick={() => moveLayer(-1)}>Raise video track</button>
          <button className={`${inputClass} text-[10px]`} type="button" disabled={disabled || laneIndex < 0 || laneIndex >= videoTracks.length - 1} onClick={() => moveLayer(1)}>Lower video track</button>
        </div> : null}
      </div> : null}
      <div className="space-y-2 border-b border-white/10 pb-3 text-xs">
        <p className="app-eyebrow text-[10px] uppercase tracking-[0.16em] text-neutral-400">Transform</p>
        {!transform ? <>
          <p className="text-[11px] leading-5 text-neutral-400">Auto fit. Enable source-size controls to position and scale this clip.</p>
          <button type="button" disabled={disabled} className={`${inputClass} text-[10px]`} onClick={() => onUpdateClip(clip.id, { transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, anchor: { x: 0.5, y: 0.5 } } })}>Use source-size transform</button>
        </> : <>
          <div className="grid grid-cols-2 gap-2">
            <CommitNumber key={`${clip.id}-x-${transform.x}`} label="Position X (%)" value={Number((transform.x * 100).toFixed(4))} step={0.1} disabled={disabled} onCommit={(x) => setTransform({ x: x / 100 })} />
            <CommitNumber key={`${clip.id}-y-${transform.y}`} label="Position Y (%)" value={Number((transform.y * 100).toFixed(4))} step={0.1} disabled={disabled} onCommit={(y) => setTransform({ y: y / 100 })} />
            <CommitNumber key={`${clip.id}-scale-${transform.scale}`} label="Source scale" value={transform.scale} min={0.0001} step={0.01} disabled={disabled} onCommit={(scale) => setTransform({ scale })} />
            <CommitNumber key={`${clip.id}-rotation-${transform.rotation}`} label="Rotation (degrees)" value={Number((transform.rotation * 180 / Math.PI).toFixed(4))} step={1} disabled={disabled} onCommit={(degrees) => setTransform({ rotation: degrees * Math.PI / 180 })} />
          </div>
          <button type="button" disabled={disabled} className={`${inputClass} text-[10px]`} onClick={() => onUpdateClip(clip.id, { transform: undefined })}>Reset to auto fit</button>
        </>}
        <CommitNumber key={`${clip.id}-opacity-${clip.opacity}`} label="Opacity (%)" value={(clip.opacity ?? 1) * 100} min={0} max={100} disabled={disabled} onCommit={(opacity) => onUpdateClip(clip.id, { opacity: opacity / 100 })} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-neutral-200">
        <LabeledControl label="Trim Start (s)">
          <input
            type="number"
            min={0}
            step={0.1}
            disabled={disabled}
            value={framesToSeconds(clip.trimStartFrame)}
            onChange={(event) => {
              const seconds = parseNumber(
                event.currentTarget.value,
                framesToSeconds(clip.trimStartFrame),
              );

              onUpdateClip(clip.id, {
                trimStartFrame: Math.max(0, secondsToFrames(seconds)),
              });
            }}
            className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
          />
        </LabeledControl>

        <LabeledControl label="Trim End (s)">
          <input
            type="number"
            min={0.1}
            step={0.1}
            disabled={disabled}
            value={framesToSeconds(clip.trimEndFrame)}
            onChange={(event) => {
              const seconds = parseNumber(
                event.currentTarget.value,
                framesToSeconds(clip.trimEndFrame),
              );

              onUpdateClip(clip.id, {
                trimEndFrame: Math.max(1, secondsToFrames(seconds)),
              });
            }}
            className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
          />
        </LabeledControl>
      </div>

      {clip.kind === "video" ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="app-eyebrow text-[10px] uppercase tracking-[0.16em] text-neutral-400">
              Color grade
            </p>
            <span className="app-data text-[9px] uppercase tracking-[0.08em] text-neutral-500">
              Preview + export
            </span>
          </div>
          <div className="relative">
            <Palette
              aria-hidden="true"
              size={15}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#ff7955]"
            />
            <select
              aria-label="Color grade preset"
              disabled={disabled}
              value={videoFilter.preset}
              onChange={(event) => {
                const preset = event.currentTarget.value as VideoFilterPreset;
                onUpdateClip(clip.id, { videoFilter: cloneVideoFilterPreset(preset) });
              }}
              className="app-data min-h-10 w-full appearance-none border border-white/15 bg-[#100e0b] py-2 pl-9 pr-9 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#f2ede3] outline-none transition hover:border-white/30 focus-visible:border-[#ff4f1f] focus-visible:ring-2 focus-visible:ring-[#ff4f1f]/35 disabled:opacity-40"
            >
              {videoFilter.preset === "custom" ? (
                <option value="custom" disabled>Custom adjustments</option>
              ) : null}
              {(Object.keys(VIDEO_FILTER_PRESETS) as VideoFilterPreset[]).map((preset) => (
                <option key={preset} value={preset}>
                  {preset === "none" ? "Original" : preset}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              size={15}
              strokeWidth={1.75}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500"
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <CommitNumber label="Exposure (%)" value={Math.round(videoFilter.brightness * 100)} min={50} max={150} disabled={disabled} onCommit={(value) => setFilterValue("brightness", value / 100)} />
            <CommitNumber label="Contrast (%)" value={Math.round(videoFilter.contrast * 100)} min={50} max={150} disabled={disabled} onCommit={(value) => setFilterValue("contrast", value / 100)} />
            <CommitNumber label="Saturation (%)" value={Math.round(videoFilter.saturation * 100)} min={0} max={200} disabled={disabled} onCommit={(value) => setFilterValue("saturation", value / 100)} />
            <CommitNumber label="Temperature" value={videoFilter.hueRotate} min={-30} max={30} disabled={disabled} onCommit={(value) => setFilterValue("hueRotate", value)} />
            <CommitNumber label="Sepia (%)" value={Math.round(videoFilter.sepia * 100)} min={0} max={100} disabled={disabled} onCommit={(value) => setFilterValue("sepia", value / 100)} />
            <CommitNumber label="B&W (%)" value={Math.round(videoFilter.grayscale * 100)} min={0} max={100} disabled={disabled} onCommit={(value) => setFilterValue("grayscale", value / 100)} />
          </div>
        </div>
      ) : null}

      {clip.kind === "video" ? (
        <div className="border-t border-white/10 pt-3">
          <div className="mb-2 flex items-center justify-between text-[10px] text-neutral-400">
            <span className="app-eyebrow uppercase tracking-[0.16em]">Clip audio</span>
            <span className="app-data">{Math.round(clip.volume * 100)}%</span>
          </div>
          <input
            aria-label="Clip audio volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            disabled={disabled}
            value={clip.volume}
            onChange={(event) =>
              onUpdateClip(clip.id, { volume: Number(event.currentTarget.value) })
            }
            className="w-full accent-[#ff4f1f]"
          />
          {onDetachAudio ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onDetachAudio(clip.id)}
              className="mt-3 h-9 w-full border border-white/15 px-3 text-[9px] font-semibold uppercase tracking-[0.13em] text-neutral-200 outline-none transition hover:border-[#ff4f1f] hover:text-[#ff9b7d] focus-visible:ring-2 focus-visible:ring-[#ff4f1f] disabled:opacity-40"
            >
              Detach audio
            </button>
          ) : null}
        </div>
      ) : null}
    </InspectorCard>
  );
};
