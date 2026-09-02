"use client";

import {
  usePlaybackStore,
  useSelectionStore,
  useTimelineEngine,
} from "@elah/editor";
import {
  ChevronDown,
  Copy,
  Film,
  Magnet,
  Music2,
  Plus,
  Scissors,
  Trash2,
  Type,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { EditorTrackKind } from "@/lib/editor/types";

interface TimelineActionBarProps {
  disabled?: boolean;
  onAddText: (trackId?: string) => void;
  onAddTrack: (kind: EditorTrackKind) => string | void;
}

const actionClass =
  "grid h-[44px] w-[44px] shrink-0 place-items-center border-l border-white/10 text-neutral-300 outline-none transition hover:bg-white/[0.05] hover:text-neutral-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ff4f1f] disabled:cursor-not-allowed disabled:opacity-30 xl:h-9 xl:w-9";

const trackOptions: Array<{
  kind: EditorTrackKind;
  label: string;
  icon: typeof Film;
}> = [
  { kind: "video", label: "Video track", icon: Film },
  { kind: "text", label: "Text track", icon: Type },
  { kind: "audio", label: "Audio track", icon: Music2 },
];

export const TimelineActionBar = ({
  disabled,
  onAddText,
  onAddTrack,
}: TimelineActionBarProps) => {
  const engine = useTimelineEngine();
  const [trackMenuOpen, setTrackMenuOpen] = useState(false);
  const trackMenuRef = useRef<HTMLDivElement>(null);
  const selectedClipIds = useSelectionStore((state) => state.selectedClipIds);
  const activeTrackId = useSelectionStore((state) => state.activeTrackId);
  const setActiveTrack = useSelectionStore((state) => state.setActiveTrack);
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

  useEffect(() => {
    if (!trackMenuOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!trackMenuRef.current?.contains(event.target as Node)) {
        setTrackMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTrackMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [trackMenuOpen]);

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
    <div className="ml-auto flex shrink-0 items-center border-r border-white/10" aria-label="Timeline actions">
      <div className="relative" ref={trackMenuRef}>
        <button
          type="button"
          className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center gap-1.5 border-l border-white/10 px-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-200 outline-none transition hover:bg-white/[0.05] hover:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ff4f1f] disabled:opacity-30 sm:w-auto sm:px-3 xl:h-9"
          disabled={disabled}
          onClick={() => setTrackMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={trackMenuOpen}
          title="Add timeline track"
        >
          <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
          <span className="hidden sm:inline">Track</span>
          <ChevronDown aria-hidden="true" className="hidden sm:block" size={11} strokeWidth={1.8} />
        </button>
        {trackMenuOpen ? (
          <div
            className="absolute left-0 top-full z-50 min-w-40 border border-white/15 bg-[#171410] py-1 shadow-2xl xl:left-auto xl:right-0"
            role="menu"
            aria-label="Add track"
          >
            {trackOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.kind}
                  type="button"
                  className="flex h-[44px] w-full items-center gap-2 px-3 text-left text-[10px] font-medium text-neutral-200 outline-none hover:bg-white/[0.06] focus-visible:bg-white/[0.06] focus-visible:text-white xl:h-9"
                  role="menuitem"
                  onClick={() => {
                    const trackId = onAddTrack(option.kind);
                    if (trackId) setActiveTrack(trackId);
                    setTrackMenuOpen(false);
                  }}
                >
                  <Icon aria-hidden="true" size={14} strokeWidth={1.8} />
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center gap-2 border-l border-white/10 px-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-200 outline-none transition hover:bg-white/[0.05] hover:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ff4f1f] disabled:opacity-30 sm:w-auto sm:px-3 xl:h-9"
        disabled={disabled}
        onClick={() => {
          const activeTrack = activeTrackId ? engine.getTrack(activeTrackId) : undefined;
          onAddText(activeTrack?.kind === "elements" ? activeTrack.id : undefined);
        }}
        title="Add text layer"
      >
        <Type aria-hidden="true" size={14} strokeWidth={1.8} />
        <span className="hidden sm:inline">Text</span>
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
