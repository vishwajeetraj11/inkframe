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

const MIN_BLOCK_WIDTH_PERCENT = 4;

const framesToSeconds = (frames: number): number => {
  return Number((frames / FPS).toFixed(2));
};

const secondsToFrames = (seconds: number): number => {
  return Math.max(1, Math.round(seconds * FPS));
};

const parseNumber = (value: string, fallback: number): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatSeconds = (frames: number): string => {
  const seconds = frames / FPS;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
};

const truncateLabel = (value: string, limit = 42): string => {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 1)}…`;
};

const getTimelineBlockStyle = (
  startFrame: number,
  endFrame: number,
  totalFrames: number,
): React.CSSProperties => {
  const safeTotalFrames = Math.max(1, totalFrames);
  const safeStartFrame = Math.max(0, startFrame);
  const safeEndFrame = Math.max(safeStartFrame + 1, endFrame);
  const leftPercent = (safeStartFrame / safeTotalFrames) * 100;
  const naturalWidthPercent = ((safeEndFrame - safeStartFrame) / safeTotalFrames) * 100;
  const widthPercent = Math.max(
    Math.min(100 - leftPercent, naturalWidthPercent),
    Math.min(MIN_BLOCK_WIDTH_PERCENT, 100 - leftPercent),
  );

  return {
    left: `${leftPercent}%`,
    width: `${widthPercent}%`,
  };
};

const getTickStepInSeconds = (totalFrames: number): number => {
  const totalSeconds = totalFrames / FPS;

  if (totalSeconds <= 12) {
    return 1;
  }

  if (totalSeconds <= 24) {
    return 2;
  }

  if (totalSeconds <= 45) {
    return 5;
  }

  return 10;
};

const buildTicks = (totalFrames: number): number[] => {
  const stepFrames = getTickStepInSeconds(totalFrames) * FPS;
  const ticks: number[] = [];

  for (let frame = 0; frame <= totalFrames; frame += stepFrames) {
    ticks.push(frame);
  }

  if (ticks[ticks.length - 1] !== totalFrames) {
    ticks.push(totalFrames);
  }

  return ticks;
};

const packLaneRows = <T,>(
  items: readonly T[],
  getStartFrame: (item: T) => number,
  getEndFrame: (item: T) => number,
): T[][] => {
  const rows: T[][] = [];
  const rowEndFrames: number[] = [];
  const sortedItems = [...items].sort((left, right) => {
    return getStartFrame(left) - getStartFrame(right);
  });

  for (const item of sortedItems) {
    const startFrame = Math.max(0, getStartFrame(item));
    const endFrame = Math.max(startFrame + 1, getEndFrame(item));
    let targetRow = rowEndFrames.findIndex((rowEndFrame) => startFrame >= rowEndFrame);

    if (targetRow === -1) {
      targetRow = rows.length;
      rows.push([]);
      rowEndFrames.push(endFrame);
    } else {
      rowEndFrames[targetRow] = endFrame;
    }

    rows[targetRow].push(item);
  }

  return rows;
};

const activateOnEnterOrSpace = (
  event: React.KeyboardEvent<HTMLElement>,
  callback: () => void,
): void => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    callback();
  }
};

const getClipBlockClassName = (kind: Clip["kind"], selected: boolean): string => {
  const baseClassName =
    kind === "video"
      ? "border-sky-400/45 bg-sky-400/18 text-sky-50"
      : "border-amber-400/45 bg-amber-400/18 text-amber-50";

  return [
    "group absolute top-1/2 h-14 -translate-y-1/2 overflow-hidden rounded-xl border px-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition",
    baseClassName,
    selected ? "ring-2 ring-cyan-300/80" : "hover:border-neutral-400",
  ].join(" ");
};

const getTextBlockClassName = (selected: boolean): string => {
  return [
    "group absolute top-1/2 h-11 -translate-y-1/2 overflow-hidden rounded-lg border border-fuchsia-300/35 bg-fuchsia-300/14 px-3 text-left text-fuchsia-50 shadow-[0_8px_20px_rgba(0,0,0,0.2)] transition",
    selected ? "ring-2 ring-cyan-300/80" : "hover:border-fuchsia-200/55",
  ].join(" ");
};

const getAudioBlockClassName = (selected: boolean): string => {
  return [
    "group absolute top-1/2 h-11 -translate-y-1/2 overflow-hidden rounded-lg border border-emerald-300/35 bg-emerald-300/14 px-3 text-left text-emerald-50 shadow-[0_8px_20px_rgba(0,0,0,0.2)] transition",
    selected ? "ring-2 ring-cyan-300/80" : "hover:border-emerald-200/55",
  ].join(" ");
};

const TimelineGuides = ({
  ticks,
  totalFrames,
}: {
  ticks: number[];
  totalFrames: number;
}) => {
  return (
    <>
      {ticks.map((frame) => {
        const leftPercent = (frame / Math.max(1, totalFrames)) * 100;

        return (
          <div
            key={frame}
            aria-hidden="true"
            className="absolute inset-y-0 w-px bg-white/6"
            style={{ left: `${leftPercent}%` }}
          />
        );
      })}
    </>
  );
};

const TimelineLane = ({
  title,
  subtitle,
  count,
  totalFrames,
  ticks,
  rows,
}: {
  title: string;
  subtitle: string;
  count: string;
  totalFrames: number;
  ticks: number[];
  rows: React.ReactNode[];
}) => {
  return (
    <div className="grid gap-3 md:grid-cols-[8rem_minmax(0,1fr)] md:items-start">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-300">
          {title}
        </p>
        <p className="text-xs text-neutral-500">{subtitle}</p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-600">{count}</p>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={`${title}-${index}`}
            className="relative h-16 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/75"
          >
            <TimelineGuides ticks={ticks} totalFrames={totalFrames} />
            {row}
          </div>
        ))}
      </div>
    </div>
  );
};

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
    <section className="space-y-4 rounded-2xl border border-neutral-700/60 bg-neutral-900/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="app-panel-label text-sm font-semibold uppercase tracking-wide text-neutral-300">
            Timeline
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Visual lanes mirror the actual render order and overlaps.
          </p>
        </div>

        <div className="rounded-full border border-neutral-700 bg-neutral-900/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">
          {totalSeconds}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-700/70 bg-neutral-950/55 p-3">
        {!hasTimelineItems ? (
          <div className="rounded-xl border border-dashed border-neutral-700 px-3 py-6 text-sm text-neutral-400">
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

                <TimelineLane
                  title="Clips"
                  subtitle="Render track"
                  count={`${clipTrack.entries.length} blocks`}
                  totalFrames={totalFrames}
                  ticks={ticks}
                  rows={[
                    clipTrack.entries.map((entry: ClipTrackEntry) => {
                      const endFrame = entry.startFrame + entry.durationInFrames;
                      const blockStyle = getTimelineBlockStyle(
                        entry.startFrame,
                        endFrame,
                        totalFrames,
                      );
                      const fadeInPercent =
                        entry.fadeInFrames > 0
                          ? Math.min(60, (entry.fadeInFrames / entry.durationInFrames) * 100)
                          : 0;
                      const fadeOutPercent =
                        entry.fadeOutFrames > 0
                          ? Math.min(60, (entry.fadeOutFrames / entry.durationInFrames) * 100)
                          : 0;

                      return (
                        <button
                          key={entry.clip.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => onSelectClip(entry.clip.id)}
                          className={getClipBlockClassName(
                            entry.clip.kind,
                            selectedClipId === entry.clip.id,
                          )}
                          style={blockStyle}
                          title={`${assetNames[entry.clip.assetId] ?? entry.clip.assetId} • ${formatSeconds(
                            entry.durationInFrames,
                          )}`}
                        >
                          {fadeInPercent > 0 ? (
                            <div
                              aria-hidden="true"
                              className="absolute inset-y-0 left-0 bg-white/12"
                              style={{ width: `${fadeInPercent}%` }}
                            />
                          ) : null}

                          {fadeOutPercent > 0 ? (
                            <div
                              aria-hidden="true"
                              className="absolute inset-y-0 right-0 bg-black/16"
                              style={{ width: `${fadeOutPercent}%` }}
                            />
                          ) : null}

                          <div className="relative flex h-full items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold uppercase tracking-[0.18em]">
                                {entry.clip.kind}
                              </p>
                              <p className="truncate text-sm font-medium text-white">
                                {assetNames[entry.clip.assetId] ?? entry.clip.assetId}
                              </p>
                            </div>

                            <span className="shrink-0 rounded-full border border-white/12 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85">
                              {formatSeconds(entry.durationInFrames)}
                            </span>
                          </div>
                        </button>
                      );
                    }),
                  ]}
                />

                <TimelineLane
                  title="Text"
                  subtitle="Overlay layers"
                  count={`${version.textOverlays.length} overlays`}
                  totalFrames={totalFrames}
                  ticks={ticks}
                  rows={
                    textRows.length > 0
                      ? textRows.map((row) =>
                          row.map((overlay) => (
                            <button
                              key={overlay.id}
                              type="button"
                              disabled={disabled}
                              onClick={() => onSelectText(overlay.id)}
                              className={getTextBlockClassName(selectedTextId === overlay.id)}
                              style={getTimelineBlockStyle(
                                overlay.startFrame,
                                overlay.endFrame,
                                totalFrames,
                              )}
                              title={`${overlay.text} • ${TEXT_OVERLAY_STYLE_PRESET_LABELS[
                                overlay.stylePreset
                              ]}`}
                            >
                              <div className="flex h-full items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-white">
                                    {truncateLabel(overlay.text.replace(/\s+/g, " ").trim() || "Text overlay")}
                                  </p>
                                  <p className="truncate text-[10px] uppercase tracking-[0.16em] text-fuchsia-100/75">
                                    {TEXT_OVERLAY_STYLE_PRESET_LABELS[overlay.stylePreset]}
                                  </p>
                                </div>

                                <span className="shrink-0 rounded-full border border-white/12 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85">
                                  {formatSeconds(overlay.endFrame - overlay.startFrame)}
                                </span>
                              </div>
                            </button>
                          )),
                        )
                      : [
                          <div
                            key="text-empty"
                            className="flex h-full items-center px-3 text-xs text-neutral-500"
                          >
                            No text overlays on the timeline.
                          </div>,
                        ]
                  }
                />

                <TimelineLane
                  title="Audio"
                  subtitle="Playback layers"
                  count={`${version.audioTracks.length} tracks`}
                  totalFrames={totalFrames}
                  ticks={ticks}
                  rows={
                    audioRows.length > 0
                      ? audioRows.map((row) =>
                          row.map((track) => (
                            <button
                              key={track.id}
                              type="button"
                              disabled={disabled}
                              onClick={() => onSelectAudio(track.id)}
                              className={getAudioBlockClassName(selectedAudioId === track.id)}
                              style={getTimelineBlockStyle(
                                track.startFrame,
                                track.endFrame,
                                totalFrames,
                              )}
                              title={`${assetNames[track.assetId] ?? track.assetId} • ${formatSeconds(
                                track.endFrame - track.startFrame,
                              )}`}
                            >
                              <div className="flex h-full items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-white">
                                    {assetNames[track.assetId] ?? track.assetId}
                                  </p>
                                  <p className="truncate text-[10px] uppercase tracking-[0.16em] text-emerald-100/75">
                                    Volume {Math.round(track.volume * 100)}%
                                  </p>
                                </div>

                                <span className="shrink-0 rounded-full border border-white/12 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85">
                                  {formatSeconds(track.endFrame - track.startFrame)}
                                </span>
                              </div>
                            </button>
                          )),
                        )
                      : [
                          <div
                            key="audio-empty"
                            className="flex h-full items-center px-3 text-xs text-neutral-500"
                          >
                            No audio tracks on the timeline.
                          </div>,
                        ]
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {version.clips.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-700 px-3 py-4 text-sm text-neutral-400">
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

      <div className="space-y-3 rounded-lg border border-neutral-700/70 bg-neutral-800/30 p-3">
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

      <div className="space-y-3 rounded-lg border border-neutral-700/70 bg-neutral-800/30 p-3">
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
