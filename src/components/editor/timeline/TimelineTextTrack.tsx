"use client";

import type { TextOverlay } from "@/lib/editor/types";
import { TEXT_OVERLAY_STYLE_PRESET_LABELS } from "@/lib/editor/types";
import {
  formatSeconds,
  getTextBlockClassName,
  getTimelineBlockStyle,
  truncateLabel,
} from "./timeline-utils";
import { TimelineLane } from "./TimelineLane";

interface TimelineTextTrackProps {
  overlays: TextOverlay[];
  textRows: TextOverlay[][];
  totalFrames: number;
  ticks: number[];
  selectedTextId: string | null;
  disabled?: boolean;
  onSelectText: (textId: string) => void;
}

export const TimelineTextTrack = ({
  overlays,
  textRows,
  totalFrames,
  ticks,
  selectedTextId,
  disabled,
  onSelectText,
}: TimelineTextTrackProps) => {
  return (
    <TimelineLane
      title="Text"
      subtitle="Overlay layers"
      count={`${overlays.length} overlays`}
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
  );
};
