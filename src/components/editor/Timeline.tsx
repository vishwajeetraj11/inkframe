"use client";

import { FPS } from "@/lib/editor/constants";
import {
  buildRenderTrack,
  getTransitionBetween,
  getVersionRenderDurationInFrames,
} from "@/lib/editor/timeline";
import {
  TEXT_OVERLAY_STYLE_PRESET_LABELS,
  type AudioTrack,
  type Clip,
  type TextOverlay,
  type VersionTimeline,
} from "@/lib/editor/types";
import {
  MIN_BLOCK_WIDTH_PERCENT,
  activateOnEnterOrSpace,
  buildTicks,
  formatSeconds,
  framesToSeconds,
  getAudioBlockClassName,
  getClipBlockClassName,
  getTextBlockClassName,
  getTickStepInSeconds,
  getTimelineBlockStyle,
  packLaneRows,
  parseNumber,
  secondsToFrames,
  truncateLabel,
} from "./timeline/timeline-utils";
import { TimelineClipTrack } from "./timeline/TimelineClipTrack";
import { TimelineTextTrack } from "./timeline/TimelineTextTrack";
import { TimelineAudioTrack } from "./timeline/TimelineAudioTrack";
import { TimelineGuides } from "./timeline/TimelineGuides";

interface TimelineProps {
  version: VersionTimeline;
  assetNames: Record<string, string>;
  selectedClipId: string | null;
  selectedTextId: string | null;
  selectedAudioId: string | null;
  disabled?: boolean;
  onSelectClip: (clipId: string | null) => void;
  onSelectText: (textId: string | null) => void;
  onSelectAudio: (audioId: string | null) => void;
  onUpdateClip: (clipId: string, patch: Partial<Omit<Clip, "id" | "assetId" | "kind">>) => void;
  onMoveClip: (clipId: string, offset: -1 | 1) => void;
  onRemoveClip: (clipId: string) => void;
  onSetTransition: (fromClipId: string, toClipId: string, durationInFrames: number) => void;
  onRemoveTransition: (fromClipId: string, toClipId: string) => void;
  onAddText: () => void;
  onUpdateText: (textId: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  onRemoveText: (textId: string) => void;
  onUpdateAudio: (audioId: string, patch: Partial<Omit<AudioTrack, "id" | "assetId">>) => void;
  onRemoveAudio: (audioId: string) => void;
}

type ClipTrackEntry = ReturnType<typeof buildRenderTrack>["entries"][number];

export const Timeline = ({
  version,
  assetNames,
  selectedClipId,
  selectedTextId,
  selectedAudioId,
  disabled,
  onSelectClip,
  onSelectText,
  onSelectAudio,
  onUpdateClip,
  onMoveClip,
  onRemoveClip,
  onSetTransition,
  onRemoveTransition,
  onAddText,
  onUpdateText,
  onRemoveText,
  onUpdateAudio,
  onRemoveAudio,
}: TimelineProps) => {
  const clipTrack = buildRenderTrack(version);
  const totalFrames = getVersionRenderDurationInFrames(version);
  const totalSeconds = formatSeconds(totalFrames);
  const timelineWidth = Math.max(720, Math.round((totalFrames / FPS) * 64));
  const ticks = buildTicks(totalFrames);
  const textRows = packLaneRows(
    version.textOverlays,
    (overlay) => overlay.startFrame,
    (overlay) => overlay.endFrame,
  );
  const audioRows = packLaneRows(
    version.audioTracks,
    (track) => track.startFrame,
    (track) => track.endFrame,
  );
  const hasTimelineItems =
    clipTrack.entries.length > 0 ||
    version.textOverlays.length > 0 ||
    version.audioTracks.length > 0;

  return (
    <section className="space-y-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,33,45,0.92),rgba(13,17,27,0.88))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-neutral-500">
            Sequence Dock
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Timeline
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            Visual lanes mirror the actual render order and overlaps.
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">
          {totalSeconds}
        </div>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-[#090d15]/80 p-3">
        {!hasTimelineItems ? (
          <div className="rounded-2xl border border-dashed border-white/8 bg-white/[0.03] px-3 py-6 text-sm text-neutral-400">
            Upload media or add overlays to build the timeline.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              <span>{clipTrack.entries.length} clips</span>
              <span>{version.textOverlays.length} text layers</span>
              <span>{version.audioTracks.length} audio layers</span>
              <span>{version.transitions.length} transitions</span>
              <span className="text-neutral-600">Scroll for long sequences</span>
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="space-y-3" style={{ width: `${timelineWidth}px` }}>
                <div className="relative h-8 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/75 px-3">
                  <TimelineGuides ticks={ticks} totalFrames={totalFrames} />
                  {ticks.map((frame) => {
                    const leftPercent = (frame / Math.max(1, totalFrames)) * 100;

                    return (
                      <div
                        key={`label-${frame}`}
                        aria-hidden="true"
                        className="absolute top-1.5 -translate-x-1/2 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500"
                        style={{ left: `${leftPercent}%` }}
                      >
                        {formatSeconds(frame)}
                      </div>
                    );
                  })}
                </div>

                <TimelineClipTrack
                  entries={clipTrack.entries}
                  totalFrames={totalFrames}
                  ticks={ticks}
                  selectedClipId={selectedClipId}
                  disabled={disabled}
                  assetNames={assetNames}
                  onSelectClip={onSelectClip}
                />

                <TimelineTextTrack
                  overlays={version.textOverlays}
                  textRows={textRows}
                  totalFrames={totalFrames}
                  ticks={ticks}
                  selectedTextId={selectedTextId}
                  disabled={disabled}
                  onSelectText={onSelectText}
                />

                <TimelineAudioTrack
                  tracks={version.audioTracks}
                  audioRows={audioRows}
                  totalFrames={totalFrames}
                  ticks={ticks}
                  selectedAudioId={selectedAudioId}
                  disabled={disabled}
                  assetNames={assetNames}
                  onSelectAudio={onSelectAudio}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {version.clips.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/8 bg-white/[0.03] px-3 py-4 text-sm text-neutral-400">
            Upload an image or video to create clips.
          </div>
        ) : (
          version.clips.map((clip, index) => {
            const durationFrames = Math.max(1, clip.endFrame - clip.startFrame);
            const nextClip = version.clips[index + 1];
            const transition = nextClip
              ? getTransitionBetween(version.transitions, clip.id, nextClip.id)
              : undefined;

            return (
              <div key={clip.id} className="space-y-2">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectClip(clip.id)}
                  onKeyDown={(event) =>
                    activateOnEnterOrSpace(event, () => onSelectClip(clip.id))
                  }
                  className={`w-full rounded-lg border px-3 py-2 text-left ${
                    selectedClipId === clip.id
                      ? "border-cyan-300 bg-cyan-300/10"
                      : "border-neutral-700 bg-neutral-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-neutral-100">
                      {assetNames[clip.assetId] ?? clip.assetId}
                    </p>
                    <span className="rounded bg-neutral-700 px-2 py-0.5 text-xs text-neutral-200">
                      {clip.kind}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-neutral-200 md:grid-cols-4">
                    <label className="space-y-1">
                      <span className="block text-neutral-400">Duration (s)</span>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        disabled={disabled}
                        value={framesToSeconds(durationFrames)}
                        onChange={(event) => {
                          const nextSeconds = parseNumber(
                            event.currentTarget.value,
                            framesToSeconds(durationFrames),
                          );
                          const nextDuration = secondsToFrames(nextSeconds);

                          onUpdateClip(clip.id, {
                            endFrame: clip.startFrame + nextDuration,
                            trimEndFrame: clip.trimStartFrame + nextDuration,
                          });
                        }}
                        className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="block text-neutral-400">Volume</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        disabled={disabled}
                        value={clip.volume}
                        onChange={(event) => {
                          onUpdateClip(clip.id, {
                            volume: Number.parseFloat(event.currentTarget.value),
                          });
                        }}
                        className="w-full"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={disabled || index === 0}
                      onClick={() => onMoveClip(clip.id, -1)}
                      className="rounded border border-neutral-600 px-2 py-1 text-xs font-semibold text-neutral-200 disabled:opacity-40"
                    >
                      Move Up
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={disabled || index === version.clips.length - 1}
                        onClick={() => onMoveClip(clip.id, 1)}
                        className="flex-1 rounded border border-neutral-600 px-2 py-1 text-xs font-semibold text-neutral-200 disabled:opacity-40"
                      >
                        Move Down
                      </button>

                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onRemoveClip(clip.id)}
                        className="rounded border border-rose-500/70 px-2 py-1 text-xs font-semibold text-rose-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                {nextClip ? (
                  <div className="rounded-lg border border-neutral-700/80 bg-neutral-800/30 px-3 py-2 text-xs">
                    <label className="flex items-center justify-between gap-3 text-neutral-200">
                      <span>
                        Crossfade between clip {index + 1} and {index + 2} (seconds)
                      </span>

                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        disabled={disabled}
                        value={transition ? framesToSeconds(transition.durationInFrames) : 0}
                        onChange={(event) => {
                          const seconds = parseNumber(event.currentTarget.value, 0);
                          if (seconds <= 0) {
                            onRemoveTransition(clip.id, nextClip.id);
                            return;
                          }

                          onSetTransition(
                            clip.id,
                            nextClip.id,
                            secondsToFrames(seconds),
                          );
                        }}
                        className="w-24 rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-3 rounded-[22px] border border-white/8 bg-white/[0.04] p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-200">Text Overlays</h3>
          <button
            type="button"
            disabled={disabled}
            onClick={onAddText}
            className="rounded border border-neutral-600 px-2 py-1 text-xs font-semibold text-neutral-100"
          >
            Add Text
          </button>
        </div>

        <div className="space-y-2">
          {version.textOverlays.length === 0 ? (
            <p className="text-xs text-neutral-400">No text overlays added.</p>
          ) : (
            version.textOverlays.map((overlay) => (
              <div
                key={overlay.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectText(overlay.id)}
                onKeyDown={(event) =>
                  activateOnEnterOrSpace(event, () => onSelectText(overlay.id))
                }
                className={`w-full rounded-lg border px-3 py-2 text-left ${
                  selectedTextId === overlay.id
                    ? "border-cyan-300 bg-cyan-300/10"
                    : "border-neutral-700 bg-neutral-800/60"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="max-w-[calc(100%-5rem)] whitespace-pre-wrap break-words text-sm leading-snug font-medium text-neutral-100">
                    {overlay.text}
                  </p>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveText(overlay.id);
                    }}
                    className="rounded border border-rose-500/70 px-2 py-0.5 text-xs font-semibold text-rose-200"
                  >
                    Delete
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-neutral-200">
                  <label className="space-y-1">
                    <span className="block text-neutral-400">Start (s)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      disabled={disabled}
                      value={framesToSeconds(overlay.startFrame)}
                      onChange={(event) => {
                        const seconds = parseNumber(
                          event.currentTarget.value,
                          framesToSeconds(overlay.startFrame),
                        );

                        onUpdateText(overlay.id, {
                          startFrame: Math.max(0, secondsToFrames(seconds)),
                        });
                      }}
                      className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="block text-neutral-400">End (s)</span>
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      disabled={disabled}
                      value={framesToSeconds(overlay.endFrame)}
                      onChange={(event) => {
                        const seconds = parseNumber(
                          event.currentTarget.value,
                          framesToSeconds(overlay.endFrame),
                        );

                        onUpdateText(overlay.id, {
                          endFrame: Math.max(1, secondsToFrames(seconds)),
                        });
                      }}
                      className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
                    />
                  </label>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-[22px] border border-white/8 bg-white/[0.04] p-3">
        <h3 className="text-sm font-semibold text-neutral-200">Audio Tracks</h3>

        <div className="space-y-2">
          {version.audioTracks.length === 0 ? (
            <p className="text-xs text-neutral-400">Upload audio files to add tracks.</p>
          ) : (
            version.audioTracks.map((track) => (
              <div
                key={track.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectAudio(track.id)}
                onKeyDown={(event) =>
                  activateOnEnterOrSpace(event, () => onSelectAudio(track.id))
                }
                className={`w-full rounded-lg border px-3 py-2 text-left ${
                  selectedAudioId === track.id
                    ? "border-cyan-300 bg-cyan-300/10"
                    : "border-neutral-700 bg-neutral-800/60"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-neutral-100">
                    {assetNames[track.assetId] ?? track.assetId}
                  </p>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveAudio(track.id);
                    }}
                    className="rounded border border-rose-500/70 px-2 py-0.5 text-xs font-semibold text-rose-200"
                  >
                    Delete
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-neutral-200">
                  <label className="space-y-1">
                    <span className="block text-neutral-400">Start (s)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      disabled={disabled}
                      value={framesToSeconds(track.startFrame)}
                      onChange={(event) => {
                        const seconds = parseNumber(
                          event.currentTarget.value,
                          framesToSeconds(track.startFrame),
                        );

                        onUpdateAudio(track.id, {
                          startFrame: Math.max(0, secondsToFrames(seconds)),
                        });
                      }}
                      className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="block text-neutral-400">End (s)</span>
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      disabled={disabled}
                      value={framesToSeconds(track.endFrame)}
                      onChange={(event) => {
                        const seconds = parseNumber(
                          event.currentTarget.value,
                          framesToSeconds(track.endFrame),
                        );

                        onUpdateAudio(track.id, {
                          endFrame: Math.max(1, secondsToFrames(seconds)),
                        });
                      }}
                      className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="block text-neutral-400">Volume</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      disabled={disabled}
                      value={track.volume}
                      onChange={(event) => {
                        onUpdateAudio(track.id, {
                          volume: Number.parseFloat(event.currentTarget.value),
                        });
                      }}
                      className="w-full"
                    />
                  </label>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
