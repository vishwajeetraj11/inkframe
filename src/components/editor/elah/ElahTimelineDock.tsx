"use client";

import {
  Timeline as ElahTimeline,
  useSelectionStore,
} from "@elah/editor";
import { useEffect, useMemo } from "react";
import type { VersionTimeline } from "@/lib/editor/types";
import { detectElahBrowserCapabilities } from "@/lib/editor/elah-browser-capabilities";
import "./inkframe-elah.css";

interface ElahTimelineDockProps {
  version: VersionTimeline;
  onSelectClip: (clipId: string | null) => void;
  onSelectText: (overlayId: string | null) => void;
  onSelectAudio: (trackId: string | null) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddTrack: () => void;
}

const SelectionBridge = ({
  version,
  onSelectClip,
  onSelectText,
  onSelectAudio,
}: Pick<
  ElahTimelineDockProps,
  "version" | "onSelectClip" | "onSelectText" | "onSelectAudio"
>) => {
  const selectedClipIds = useSelectionStore((state) => state.selectedClipIds);

  useEffect(() => {
    const selectedId = selectedClipIds.values().next().value as string | undefined;
    if (!selectedId) return;

    if (version.clips.some((clip) => clip.id === selectedId)) {
      onSelectClip(selectedId);
    } else if (version.textOverlays.some((overlay) => overlay.id === selectedId)) {
      onSelectText(selectedId);
    } else if (version.audioTracks.some((track) => track.id === selectedId)) {
      onSelectAudio(selectedId);
    }
  }, [onSelectAudio, onSelectClip, onSelectText, selectedClipIds, version]);

  return null;
};

const ElahHistoryControls = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Pick<ElahTimelineDockProps, "canUndo" | "canRedo" | "onUndo" | "onRedo">) => {
  return (
    <div className="flex items-center gap-1 border-l border-white/10 pl-2">
      <button
        type="button"
        disabled={!canUndo}
        onClick={onUndo}
        className="min-h-10 px-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-300 outline-none transition hover:bg-white/[0.05] hover:text-neutral-50 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-35"
      >
        Undo
      </button>
      <button
        type="button"
        disabled={!canRedo}
        onClick={onRedo}
        className="min-h-10 px-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-300 outline-none transition hover:bg-white/[0.05] hover:text-neutral-50 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-35"
      >
        Redo
      </button>
    </div>
  );
};

export const ElahTimelineDock = ({
  version,
  onSelectClip,
  onSelectText,
  onSelectAudio,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddTrack,
}: ElahTimelineDockProps) => {
  const capabilities = useMemo(() => detectElahBrowserCapabilities(), []);

  if (!capabilities.ready.timeline) {
    return (
      <div className="flex min-h-40 items-center justify-center border border-dashed border-white/15 p-6 text-center text-sm text-neutral-400">
        This browser cannot start the interactive Elah timeline.
      </div>
    );
  }

  return (
    <div className="inkframe-elah flex h-full min-h-[240px] flex-col xl:min-h-0">
      <SelectionBridge
        version={version}
        onSelectClip={onSelectClip}
        onSelectText={onSelectText}
        onSelectAudio={onSelectAudio}
      />
      <div className="flex min-h-12 items-center justify-between border-b border-white/10 px-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 bg-cyan-300" />
          <span className="app-eyebrow text-[9px] uppercase tracking-[0.16em] text-neutral-300">
            Elah interactive timeline
          </span>
          <button
            type="button"
            onClick={onAddTrack}
            className="ml-2 min-h-10 border-l border-white/10 px-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-200 outline-none transition hover:bg-white/[0.05] hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-35"
          >
            + Track
          </button>
        </div>
        <ElahHistoryControls
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <ElahTimeline compactSidebar sidebarWidth={136} />
      </div>
    </div>
  );
};
