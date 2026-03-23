"use client";

import { Player } from "@remotion/player";
import { ASPECT_PRESETS } from "@/lib/editor/constants";
import { getVersionRenderDurationInFrames } from "@/lib/editor/timeline";
import type { AspectPreset, VersionTimeline } from "@/lib/editor/types";
import {
  EditorComposition,
  type EditorCompositionProps,
} from "@/remotion/EditorComposition";
import { useMemo } from "react";

interface PreviewPaneProps {
  aspect: AspectPreset;
  version: VersionTimeline;
  assetSources: Record<string, string>;
}

export const PreviewPane = ({
  aspect,
  version,
  assetSources,
}: PreviewPaneProps) => {
  const preset = ASPECT_PRESETS[aspect] ?? ASPECT_PRESETS.reel_9_16;

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

  let computedDurationInFrames = 1;
  try {
    computedDurationInFrames = getVersionRenderDurationInFrames(version);
  } catch {
    computedDurationInFrames = 1;
  }

  const safeDurationInFrames = toPositiveInt(computedDurationInFrames, 1);

  const aspectRatioCandidate = safeWidth / safeHeight;
  const safeAspectRatio = Number.isFinite(aspectRatioCandidate) && aspectRatioCandidate > 0
    ? aspectRatioCandidate
    : 1080 / 1920;
  const safePaddingTopPercent = Number.isFinite(safeAspectRatio) && safeAspectRatio > 0
    ? `${(1 / safeAspectRatio) * 100}%`
    : `${(1920 / 1080) * 100}%`;

  const inputProps = useMemo<EditorCompositionProps>(
    () => ({
      version,
      assetSources,
      renderMode: "preview",
    }),
    [version, assetSources],
  );
  const previewDurationSeconds = (safeDurationInFrames / safeFps).toFixed(2);
  const previewAspectLabel = aspect === "reel_9_16" ? "9:16" : "16:9";

  return (
    <section className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(28,33,45,0.92),rgba(13,17,27,0.88))] p-4 shadow-[0_20px_58px_rgba(0,0,0,0.28)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-neutral-500">
            Program Monitor
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">Preview Stage</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Live Remotion player for the active aspect ratio.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            {previewAspectLabel}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            {safeWidth}x{safeHeight}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            {previewDurationSeconds}s
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-[22px] border border-white/8 bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div
          style={{
            position: "relative",
            width: "100%",
            paddingTop: safePaddingTopPercent,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
            }}
          >
            <Player
              key={`${safeWidth}x${safeHeight}@${safeFps}`}
              component={EditorComposition}
              inputProps={inputProps}
              durationInFrames={safeDurationInFrames}
              compositionWidth={safeWidth}
              compositionHeight={safeHeight}
              fps={safeFps}
              acknowledgeRemotionLicense
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: "black",
              }}
              controls
              autoPlay={false}
              loop
            />
          </div>
        </div>
      </div>
    </section>
  );
};
