"use client";

import type { buildRenderTrack } from "@/lib/editor/timeline";
import { formatSeconds, getClipBlockClassName, getTimelineBlockStyle } from "./timeline-utils";
import { TimelineLane } from "./TimelineLane";

type ClipTrackEntry = ReturnType<typeof buildRenderTrack>["entries"][number];

interface TimelineClipTrackProps {
  entries: ClipTrackEntry[];
  totalFrames: number;
  ticks: number[];
  selectedClipId: string | null;
  disabled?: boolean;
  assetNames: Record<string, string>;
  onSelectClip: (clipId: string) => void;
}

export const TimelineClipTrack = ({
  entries,
  totalFrames,
  ticks,
  selectedClipId,
  disabled,
  assetNames,
  onSelectClip,
}: TimelineClipTrackProps) => {
  return (
    <TimelineLane
      title="Clips"
      subtitle="Render track"
      count={`${entries.length} blocks`}
      totalFrames={totalFrames}
      ticks={ticks}
      rows={[
        entries.map((entry) => {
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
  );
};
