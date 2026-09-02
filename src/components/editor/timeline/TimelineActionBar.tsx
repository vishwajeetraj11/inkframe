"use client";

import {
  usePlaybackStore,
  useSelectionStore,
  useTimelineEngine,
} from "@elah/editor";
import { Copy, Magnet, Scissors, Trash2, Type } from "lucide-react";

interface TimelineActionBarProps {
  disabled?: boolean;
  onAddText: () => void;
}

const actionClass =
  "grid h-9 w-9 place-items-center border-l border-white/10 text-neutral-300 outline-none transition hover:bg-white/[0.05] hover:text-neutral-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ff4f1f] disabled:cursor-not-allowed disabled:opacity-30";

export const TimelineActionBar = ({ disabled, onAddText }: TimelineActionBarProps) => {
  const engine = useTimelineEngine();
  const selectedClipIds = useSelectionStore((state) => state.selectedClipIds);
  const selectClips = useSelectionStore((state) => state.selectClips);
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const currentFrame = usePlaybackStore((state) => state.currentFrame);
  const snapEnabled = usePlaybackStore((state) => state.snapEnabled);
  const toggleSnap = usePlaybackStore((state) => state.toggleSnap);
  const selectedIds = Array.from(selectedClipIds);
  const selected = selectedIds
    .map((clipId) => engine.findClip(clipId))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const splitTarget = selected.length === 1 ? selected[0] : null;
  const canSplit = Boolean(
    splitTarget &&
      currentFrame > splitTarget.clip.startFrame &&
      currentFrame < splitTarget.clip.startFrame + splitTarget.clip.durationFrames,
  );

  const split = () => {
    if (!splitTarget || !canSplit) return;
    const result = engine.splitClip(splitTarget.clip.id, splitTarget.trackId, currentFrame);
    if (result) selectClips(result);
  };

  const duplicate = () => {
    if (selected.length === 0) return;
    const ordered = [...selected].sort(
      (left, right) => left.clip.startFrame - right.clip.startFrame,
    );
    let cursor = engine.getTotalFrames();
    const clonedIds: string[] = [];
    engine.batch(() => {
      for (const entry of ordered) {
        const clonedId = engine.cloneClip(entry.clip.id, entry.trackId, cursor);
        if (clonedId) clonedIds.push(clonedId);
        cursor += entry.clip.durationFrames;
      }
    }, "Duplicate clips");
    if (clonedIds.length > 0) selectClips(clonedIds);
  };

  const remove = () => {
    if (selected.length === 0) return;
    engine.batch(() => {
      for (const entry of selected) {
        engine.removeClip(entry.clip.id, entry.trackId);
      }
    }, "Delete clips");
    clearSelection();
  };

  return (
    <div className="ml-auto flex items-center border-r border-white/10" aria-label="Timeline actions">
      <button
        type="button"
        className="inline-flex h-9 items-center gap-2 border-l border-white/10 px-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-200 outline-none transition hover:bg-white/[0.05] hover:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ff4f1f] disabled:opacity-30"
        disabled={disabled}
        onClick={onAddText}
        title="Add text layer"
      >
        <Type aria-hidden="true" size={14} strokeWidth={1.8} />
        Text
      </button>
      <button
        type="button"
        className={actionClass}
        disabled={disabled || !canSplit}
        onClick={split}
        aria-label="Split at playhead"
        title="Split at playhead (S)"
      >
        <Scissors aria-hidden="true" size={14} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className={actionClass}
        disabled={disabled || selected.length === 0}
        onClick={duplicate}
        aria-label="Duplicate selected clips"
        title="Duplicate selected clips"
      >
        <Copy aria-hidden="true" size={14} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className={actionClass}
        disabled={disabled || selected.length === 0}
        onClick={remove}
        aria-label="Delete selected clips"
        title="Delete selected clips (Delete)"
      >
        <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className={`${actionClass} ${snapEnabled ? "bg-[#ff4f1f]/12 text-[#ff9b7d]" : ""}`}
        disabled={disabled}
        onClick={toggleSnap}
        aria-label={snapEnabled ? "Disable timeline snapping" : "Enable timeline snapping"}
        aria-pressed={snapEnabled}
        title={snapEnabled ? "Snapping on" : "Snapping off"}
      >
        <Magnet aria-hidden="true" size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
};
