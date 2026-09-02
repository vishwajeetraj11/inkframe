"use client";

import {
  Timeline as ElahTimeline,
  useSelectionStore,
} from "@elah/editor";
import { useEffect, useMemo } from "react";
import type { VersionTimeline } from "@/lib/editor/types";
import { detectElahBrowserCapabilities } from "@/lib/editor/elah-browser-capabilities";
import "./inkframe-elah.css";
import { TimelineActionBar } from "@/components/editor/timeline/TimelineActionBar";

interface ElahTimelineDockProps {
  version: VersionTimeline;
  onSelectClip: (clipId: string | null) => void;
  onSelectText: (overlayId: string | null) => void;
  onSelectAudio: (trackId: string | null) => void;
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

export const ElahTimelineDock = ({
  version,
  onSelectClip,
  onSelectText,
  onSelectAudio,
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
      <div className="flex min-h-10 items-center border-b border-white/10 pl-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 bg-cyan-300" />
          <span className="app-eyebrow text-[9px] uppercase tracking-[0.16em] text-neutral-300">
            Elah interactive timeline
          </span>
        </div>
        <TimelineActionBar onAddText={onAddTrack} />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <ElahTimeline compactSidebar sidebarWidth={136} />
      </div>
    </div>
  );
};
