"use client";

import type { Clip, TextOverlay, AudioTrack } from "@/lib/editor/types";
import { Inspector } from "@/components/editor/Inspector";

interface EditorRightSidebarProps {
  selectedClip: Clip | null;
  selectedTextOverlay: TextOverlay | null;
  selectedAudioTrack: AudioTrack | null;
  assetNames: Record<string, string>;
  isExporting: boolean;
  onUpdateClip: (clipId: string, patch: Partial<Omit<Clip, "id">>) => void;
  onUpdateText: (overlayId: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  onUpdateAudio: (trackId: string, patch: Partial<Omit<AudioTrack, "id">>) => void;
  onRemoveAudio: (trackId: string) => void;
}

export const EditorRightSidebar = ({
  selectedClip,
  selectedTextOverlay,
  selectedAudioTrack,
  assetNames,
  isExporting,
  onUpdateClip,
  onUpdateText,
  onUpdateAudio,
  onRemoveAudio,
}: EditorRightSidebarProps) => {
  return (
    <aside
      aria-label="Inspector"
      className="h-full min-h-0 overflow-y-auto border-t border-white/10 bg-[#15120e] xl:border-l xl:border-t-0"
    >
      <Inspector
        clip={selectedClip}
        textOverlay={selectedTextOverlay}
        audioTrack={selectedAudioTrack}
        assetNames={assetNames}
        disabled={isExporting}
        onUpdateClip={onUpdateClip}
        onUpdateText={onUpdateText}
        onUpdateAudio={onUpdateAudio}
        onRemoveAudio={onRemoveAudio}
      />
    </aside>
  );
};
