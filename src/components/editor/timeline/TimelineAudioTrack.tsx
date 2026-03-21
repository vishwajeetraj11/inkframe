"use client";

import type { AudioTrack } from "@/lib/editor/types";
import {
  formatSeconds,
  getAudioBlockClassName,
  getTimelineBlockStyle,
  truncateLabel,
} from "./timeline-utils";
import { TimelineLane } from "./TimelineLane";

interface TimelineAudioTrackProps {
  tracks: AudioTrack[];
  audioRows: AudioTrack[][];
  totalFrames: number;
  ticks: number[];
  selectedAudioId: string | null;
  disabled?: boolean;
  assetNames: Record<string, string>;
  onSelectAudio: (audioId: string) => void;
}

export const TimelineAudioTrack = ({
  tracks,
  audioRows,
  totalFrames,
  ticks,
  selectedAudioId,
  disabled,
  assetNames,
  onSelectAudio,
}: TimelineAudioTrackProps) => {
  return (
    <TimelineLane
      title="Audio"
      subtitle="Playback layers"
      count={`${tracks.length} tracks`}
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
                  )} • ${Math.round(track.volume * 100)}%`}
                >
                  <div className="flex h-full items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {truncateLabel(assetNames[track.assetId] ?? track.assetId)}
                      </p>
                      <p className="truncate text-[10px] uppercase tracking-[0.16em] text-emerald-100/75">
                        {Math.round(track.volume * 100)}% volume
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
  );
};
