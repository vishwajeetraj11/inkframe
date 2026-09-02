"use client";

import {
  Preview as ElahPreview,
  createDefaultDemuxerFactory,
  usePlaybackStore,
  type PreviewHandle,
} from "@elah/editor";
import { ASPECT_PRESETS } from "@/lib/editor/constants";
import { getVersionRenderDurationInFrames } from "@/lib/editor/timeline";
import type { AspectPreset, VersionTimeline } from "@/lib/editor/types";
import { Pause, Play, Redo2, Square, Undo2 } from "lucide-react";
import { useMemo, type RefObject } from "react";

interface PreviewPaneProps {
  aspect: AspectPreset;
  version: VersionTimeline;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  previewRef?: RefObject<PreviewHandle | null>;
}

export const PreviewPane = ({
  aspect,
  version,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  previewRef,
}: PreviewPaneProps) => {
  const preset = ASPECT_PRESETS[aspect] ?? ASPECT_PRESETS.reel_9_16;
  const demuxerFactory = useMemo(() => createDefaultDemuxerFactory(), []);
  const currentFrame = usePlaybackStore((state) => state.currentFrame);
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const play = usePlaybackStore((state) => state.play);
  const pause = usePlaybackStore((state) => state.pause);
  const setCurrentFrame = usePlaybackStore((state) => state.setCurrentFrame);

  const stop = () => {
    pause();
    setCurrentFrame(0);
  };

  const toPositiveInt = (value: unknown, fallback: number): number => {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return Math.max(1, Math.round(fallback));
    }

    return Math.max(1, Math.round(numeric));
  };

  const safeWidth = toPositiveInt(preset.width, 1080);
  const safeHeight = toPositiveInt(preset.height, 1920);
  const safeFps = toPositiveInt(preset.fps, 30);
  const hasRenderableVisual =
    version.clips.length > 0 || version.textOverlays.length > 0;

  let computedDurationInFrames = 1;
  try {
    computedDurationInFrames = getVersionRenderDurationInFrames(version);
  } catch {
    computedDurationInFrames = 1;
  }

  const safeDurationInFrames = Math.max(1, toPositiveInt(computedDurationInFrames, 1));
  const previewDurationSeconds = hasRenderableVisual
    ? (safeDurationInFrames / safeFps).toFixed(2)
    : "0.00";
  const previewAspectLabel = aspect === "reel_9_16" ? "9:16" : "16:9";
  const stageMaxWidth = aspect === "reel_9_16" ? "min(30vh, 280px)" : "min(72vw, 860px)";

  return (
    <section className="flex h-full min-h-[320px] flex-col bg-[#0b0a08] xl:min-h-0">
      <div className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-white/10 px-4 py-1">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 bg-cyan-300" />
          <div>
            <p className="app-eyebrow text-[9px] uppercase tracking-[0.18em] text-neutral-400">
              Program monitor
            </p>
            <h2 className="sr-only">Preview stage</h2>
          </div>
        </div>

        <div
          aria-label="Edit history"
          className="flex items-center border-x border-white/10 px-1"
        >
          <button
            type="button"
            aria-label="Undo"
            title="Undo"
            disabled={!canUndo}
            onClick={onUndo}
            className="grid h-10 w-10 place-items-center text-neutral-300 outline-none transition hover:bg-white/[0.05] hover:text-neutral-50 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Undo2 aria-hidden="true" size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Redo"
            title="Redo"
            disabled={!canRedo}
            onClick={onRedo}
            className="grid h-10 w-10 place-items-center text-neutral-300 outline-none transition hover:bg-white/[0.05] hover:text-neutral-50 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Redo2 aria-hidden="true" size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex items-center justify-end gap-3">
          <span className="app-data text-[10px] uppercase tracking-[0.08em] text-neutral-300">
            {previewAspectLabel}
          </span>
          <span className="app-data hidden text-[10px] uppercase tracking-[0.08em] text-neutral-400 sm:inline">
            {safeWidth}x{safeHeight}
          </span>
          <span className="app-data text-[10px] uppercase tracking-[0.08em] text-neutral-400">
            {previewDurationSeconds}s
          </span>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(242,237,227,0.055),transparent_64%)] p-3 md:p-5">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/[0.035]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-white/[0.035]" />
        <div
          className="relative w-full overflow-hidden border border-white/15 bg-black shadow-[0_20px_56px_rgba(0,0,0,0.48)]"
          style={{
            width: "100%",
            maxWidth: stageMaxWidth,
          }}
        >
          <div className="relative w-full" style={{ aspectRatio: `${safeWidth} / ${safeHeight}` }}>
            <div className="absolute inset-0">
              {hasRenderableVisual ? (
                <>
                  <ElahPreview
                    ref={previewRef}
                    demuxerFactory={demuxerFactory}
                    clearColor={[0.02, 0.02, 0.025, 1]}
                    preserveDrawingBuffer
                    className="h-full w-full"
                    style={{ width: "100%", height: "100%" }}
                  />
                  <div className="absolute inset-x-0 bottom-0 z-20 flex min-h-10 items-center gap-2 border-t border-white/10 bg-black/75 px-2 backdrop-blur-sm">
                    <button
                      type="button"
                      aria-label="Play"
                      title="Play"
                      disabled={isPlaying}
                      onClick={play}
                      className="grid h-10 w-10 place-items-center text-neutral-100 outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Play aria-hidden="true" className="translate-x-px" size={17} fill="currentColor" />
                    </button>
                    <button
                      type="button"
                      aria-label="Pause"
                      title="Pause"
                      disabled={!isPlaying}
                      onClick={pause}
                      className="grid h-10 w-10 place-items-center text-neutral-100 outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Pause aria-hidden="true" size={17} fill="currentColor" />
                    </button>
                    <button
                      type="button"
                      aria-label="Stop"
                      title="Stop"
                      disabled={!isPlaying && currentFrame === 0}
                      onClick={stop}
                      className="grid h-10 w-10 place-items-center text-neutral-100 outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Square aria-hidden="true" size={14} fill="currentColor" />
                    </button>
                    <span className="app-data text-[10px] text-neutral-300">
                      {(currentFrame / safeFps).toFixed(2)} / {(safeDurationInFrames / safeFps).toFixed(2)}s
                    </span>
                    <span className="ml-auto app-data text-[9px] uppercase tracking-[0.1em] text-cyan-200">
                      Browser preview
                    </span>
                  </div>
                </>
              ) : (
                <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_38%,#263047,#111827_72%)] px-6 text-center">
                  <div>
                    <p className="app-panel-label text-sm font-semibold text-neutral-100">
                      Your monitor is ready
                    </p>
                    <p className="mt-2 max-w-52 text-xs leading-relaxed text-neutral-300">
                      Import footage in the source rail above, or add a text layer to begin.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
