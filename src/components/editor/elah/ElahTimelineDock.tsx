"use client";

import {
  Timeline as ElahTimeline,
  useSelectionStore,
} from "@elah/editor";
import { useEffect, useMemo } from "react";
import type { EditorTrackKind, VersionTimeline } from "@/lib/editor/types";
import { detectElahBrowserCapabilities } from "@/lib/editor/elah-browser-capabilities";
import "./inkframe-elah.css";
import { TimelineActionBar } from "@/components/editor/timeline/TimelineActionBar";

interface ElahTimelineDockProps {
  version: VersionTimeline;
  onSelectClip: (clipId: string | null) => void;
  onSelectText: (overlayId: string | null) => void;
  onSelectAudio: (trackId: string | null) => void;
  onAddText: (trackId?: string) => void;
  onAddTrack: (kind: EditorTrackKind) => string | void;
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

export const ElahTimelineDock = ({
  version,
  onSelectClip,
  onSelectText,
  onSelectAudio,
  onAddTrack,
  onAddText,
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
    <div className="inkframe-elah flex h-full min-h-0 flex-col">
      <SelectionBridge
        version={version}
        onSelectClip={onSelectClip}
        onSelectText={onSelectText}
        onSelectAudio={onSelectAudio}
      />
      <div className="flex min-h-11 items-center overflow-visible border-b border-white/10 sm:pl-3 xl:min-h-10">
        <div className="hidden items-center gap-2 sm:flex">
          <span className="h-2 w-2 bg-cyan-300" />
          <span className="app-eyebrow text-[9px] uppercase tracking-[0.16em] text-neutral-300">
            Elah interactive timeline
          </span>
        </div>
        <TimelineActionBar onAddText={onAddText} onAddTrack={onAddTrack} />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <ElahTimeline compactSidebar sidebarWidth={136} />
      </div>
    </div>
  );
};
