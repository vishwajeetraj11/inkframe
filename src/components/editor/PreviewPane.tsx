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

  return (
    <section className="rounded-2xl border border-neutral-700/60 bg-neutral-900/50 p-4">
      <h2 className="app-panel-label mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-300">
        Preview
      </h2>

      <div className="overflow-hidden rounded-xl border border-neutral-700 bg-black">
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
