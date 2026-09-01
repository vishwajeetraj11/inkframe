"use client";

import { FPS } from "@/lib/editor/constants";
import { parseCreatedaleyOpenerText } from "@/lib/editor/createdaley-opener";
import {
  formatEditorialStatRingValue,
  parseEditorialStatRingText,
} from "@/lib/editor/editorial-stat-ring";
import { parseFilmFrameGalleryText } from "@/lib/editor/film-frame-gallery";
import { parseChartCardText } from "@/lib/editor/parsers/chart-card";
import { parseRegionalMapFocusText } from "@/lib/editor/regional-map-focus";
import {
  buildRenderTrack,
  getTransitionBetween,
  getVersionRenderDurationInFrames,
} from "@/lib/editor/timeline";
import {
  TEXT_OVERLAY_STYLE_PRESET_LABELS,
  type Clip,
  type TextOverlay,
  type VersionTimeline,
} from "@/lib/editor/types";
import {
  buildTicks,
  formatSeconds,
  framesToSeconds,
  packLaneRows,
  parseNumber,
  secondsToFrames,
} from "./timeline/timeline-utils";
import { TimelineClipTrack } from "./timeline/TimelineClipTrack";
import { TimelineTextTrack } from "./timeline/TimelineTextTrack";
import { TimelineAudioTrack } from "./timeline/TimelineAudioTrack";
import { TimelineGuides } from "./timeline/TimelineGuides";
import { parseVoxTimelineText } from "@/lib/editor/vox-timeline";

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
}

const DeleteIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    fill="none"
    style={{ width: 14, height: 14 }}
  >
    <path
      d="M5.75 6.5v7.25m4.25-7.25v7.25m4.25-7.25v7.25M4.5 4.25h11m-8.5 0 .5-1.25h5l.5 1.25m-8.5 0L5 16.5h10L15.25 4.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const stripOverlayMarkup = (value: string): string =>
  value.replace(/\[\[/g, "").replace(/\]\]/g, "").replace(/\s+/g, " ").trim();

const truncateOverlayCopy = (value: string, limit: number = 120): string => {
  const normalized = stripOverlayMarkup(value);
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1).trimEnd()}…`;
};

const getWorldMapSummary = (text: string): { title: string; detail: string } => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const headline = stripOverlayMarkup(lines[0] ?? "World Map Focus");
  const subhead = lines.find((line, index) =>
    index > 0 && !line.toLowerCase().startsWith("country:"),
  );
  const countryLine = lines.find((line) => line.toLowerCase().startsWith("country:"));
  const country = countryLine ? countryLine.split(":").slice(1).join(":").trim() : "";

  return {
    title: headline || "World Map Focus",
    detail: [country, subhead ? truncateOverlayCopy(subhead, 90) : ""]
      .filter((part) => part.length > 0)
      .join(" • "),
  };
};

const getOverlaySummary = (
  overlay: TextOverlay,
): { title: string; detail: string } => {
  switch (overlay.stylePreset) {
    case "chart-card":
    case "editorial-seat-arc": {
      const parsed = parseChartCardText(overlay.text, { useFallbackRows: false });
      return {
        title: stripOverlayMarkup(parsed.headline) || TEXT_OVERLAY_STYLE_PRESET_LABELS[overlay.stylePreset],
        detail: `${parsed.rows.length} data row${parsed.rows.length === 1 ? "" : "s"}${parsed.subhead ? ` • ${truncateOverlayCopy(parsed.subhead, 82)}` : ""}`,
      };
    }
    case "editorial-stat-ring": {
      const parsed = parseEditorialStatRingText(overlay.text);
      return {
        title: stripOverlayMarkup(parsed.headline) || "Stat Ring Card",
        detail: `${formatEditorialStatRingValue(parsed.value, parsed.suffix)} • ${truncateOverlayCopy(parsed.subhead, 82)}`,
      };
    }
    case "regional-map-focus": {
      const parsed = parseRegionalMapFocusText(overlay.text);
      const geography = [parsed.primaryCountry, parsed.secondaryCountry, parsed.focusMode]
        .filter((part) => part.trim().length > 0)
        .join(" • ");
      return {
        title: stripOverlayMarkup(parsed.headline) || "Regional Map Focus",
        detail: geography || truncateOverlayCopy(parsed.subhead, 82),
      };
    }
    case "film-frame-gallery": {
      const parsed = parseFilmFrameGalleryText(overlay.text);
      const metadata = [parsed.location, parsed.year]
        .filter((part) => part.trim().length > 0)
        .join(" • ");
      return {
        title: stripOverlayMarkup(parsed.headline) || "Film Frame Gallery",
        detail: metadata || truncateOverlayCopy(parsed.subhead, 82),
      };
    }
    case "world-map-focus":
      return getWorldMapSummary(overlay.text);
    case "createdaley-opener": {
      const parsed = parseCreatedaleyOpenerText(overlay.text);
      return {
        title: stripOverlayMarkup(parsed.wordmark) || "Dictionary Animation",
        detail: `${parsed.partOfSpeech} • ${truncateOverlayCopy(parsed.definition, 82)}`,
      };
    }
    case "vox-timeline":
    case "vox-timeline-ribbon":
    case "vox-timeline-ledger": {
      const parsed = parseVoxTimelineText(overlay.text);
      return {
        title: stripOverlayMarkup(parsed.headline) || TEXT_OVERLAY_STYLE_PRESET_LABELS[overlay.stylePreset],
        detail: `${parsed.events.length} event${parsed.events.length === 1 ? "" : "s"} • ${parsed.kicker}`,
      };
    }
    default: {
      const lines = overlay.text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      return {
        title: stripOverlayMarkup(lines[0] ?? TEXT_OVERLAY_STYLE_PRESET_LABELS[overlay.stylePreset]),
        detail: truncateOverlayCopy(lines[1] ?? "", 82),
      };
    }
  }
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
    <section className="h-full min-h-[300px] overflow-y-auto bg-[#11100c] xl:min-h-0">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 bg-cyan-300" />
          <div>
            <p className="app-eyebrow text-[9px] uppercase tracking-[0.18em] text-neutral-400">
              Sequence / 30 fps
            </p>
            <h2 className="app-title mt-0.5 text-lg font-semibold uppercase text-neutral-50">
              Timeline
            </h2>
          </div>
        </div>

        <div className="app-data border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.08em] text-neutral-300">
          {totalSeconds}
        </div>
      </div>

      <div className="border-b border-white/10 bg-[#0a0907]/80 p-3">
        {!hasTimelineItems ? (
          <div className="flex min-h-28 items-center justify-center border border-dashed border-white/12 bg-white/[0.02] px-3 py-6 text-center text-sm text-neutral-400">
            Import footage or add a text layer to begin the sequence.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              <span>{clipTrack.entries.length} clips</span>
              <span>{version.textOverlays.length} text layers</span>
              <span>{version.audioTracks.length} audio layers</span>
              <span>{version.transitions.length} transitions</span>
              <span className="text-neutral-500">Scroll horizontally for long sequences</span>
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

      <details className="group border-b border-white/10">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300 outline-none transition hover:bg-white/[0.03] hover:text-neutral-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300">
          Fine timing &amp; transitions
          <span aria-hidden="true" className="text-lg text-cyan-300 transition group-open:rotate-45">
            +
          </span>
        </summary>

        <div className="grid gap-4 border-t border-white/10 p-4 xl:grid-cols-2">
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
                  className={`w-full border px-3 py-2 text-left ${
                    selectedClipId === clip.id
                      ? "border-cyan-300 bg-cyan-300/10"
                      : "border-neutral-700 bg-neutral-800/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectClip(clip.id)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  >
                    <p className="truncate text-sm font-medium text-neutral-100">
                      {assetNames[clip.assetId] ?? clip.assetId}
                    </p>
                    <span className="bg-neutral-700 px-2 py-1 text-xs text-neutral-200">
                      {clip.kind}
                    </span>
                  </button>

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
                        className="min-h-11 w-full border border-neutral-600 bg-neutral-900 px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
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
                      className="min-h-11 border border-neutral-600 px-2 py-2 text-xs font-semibold text-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-40"
                    >
                      Move Up
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={disabled || index === version.clips.length - 1}
                        onClick={() => onMoveClip(clip.id, 1)}
                        className="min-h-11 flex-1 border border-neutral-600 px-2 py-2 text-xs font-semibold text-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-40"
                      >
                        Move Down
                      </button>

                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onRemoveClip(clip.id)}
                        aria-label={`Delete ${assetNames[clip.assetId] ?? `clip ${index + 1}`}`}
                        title="Delete clip"
                        className="inline-flex h-11 w-11 items-center justify-center border border-rose-500/55 text-rose-200 outline-none transition hover:bg-rose-500/10 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-40"
                      >
                        <DeleteIcon />
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
                        className="min-h-11 w-24 border border-neutral-600 bg-neutral-900 px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-3 border border-white/8 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-200">Text Overlays</h3>
          <button
            type="button"
            disabled={disabled}
            onClick={onAddText}
            className="min-h-11 border border-neutral-600 px-3 py-2 text-xs font-semibold text-neutral-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            Add Text
          </button>
        </div>

        <div className="space-y-2">
          {version.textOverlays.length === 0 ? (
            <p className="text-xs text-neutral-400">No text overlays added.</p>
          ) : (
            version.textOverlays.map((overlay) => {
              const summary = getOverlaySummary(overlay);

              return (
                <div
                  key={overlay.id}
                  className={`w-full border px-3 py-2 text-left ${
                    selectedTextId === overlay.id
                      ? "border-cyan-300 bg-cyan-300/10"
                      : "border-neutral-700 bg-neutral-800/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectText(overlay.id)}
                      className="min-h-11 min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    >
                      <span className="inline-flex border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-neutral-300">
                        {TEXT_OVERLAY_STYLE_PRESET_LABELS[overlay.stylePreset]}
                      </span>
                      <p className="mt-2 text-sm font-medium leading-snug text-neutral-100">
                        {summary.title}
                      </p>
                      {summary.detail ? (
                        <p className="mt-1 text-xs leading-5 text-neutral-400">
                          {summary.detail}
                        </p>
                      ) : null}
                    </button>

                    <button
                      type="button"
                      disabled={disabled}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveText(overlay.id);
                      }}
                      aria-label="Delete text overlay"
                      title="Delete text overlay"
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-rose-500/55 text-rose-200 outline-none transition hover:bg-rose-500/10 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-40"
                    >
                      <DeleteIcon />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-200">
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
                        className="min-h-11 w-full border border-neutral-600 bg-neutral-900 px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
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
                        className="min-h-11 w-full border border-neutral-600 bg-neutral-900 px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                      />
                    </label>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
        </div>
      </details>
    </section>
  );
};
