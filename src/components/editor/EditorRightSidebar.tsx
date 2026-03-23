"use client";

import type { Clip, TextOverlay, AudioTrack } from "@/lib/editor/types";
import { Inspector } from "@/components/editor/Inspector";
import { bytesToLabel } from "@/components/editor/hooks/editor-session-config";

interface EditorRightSidebarProps {
  selectedClip: Clip | null;
  selectedTextOverlay: TextOverlay | null;
  selectedAudioTrack: AudioTrack | null;
  isExporting: boolean;
  activeMediaFootprintBytes: number;
  onUpdateClip: (clipId: string, patch: Partial<Omit<Clip, "id">>) => void;
  onUpdateText: (overlayId: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  onUpdateAudio: (trackId: string, patch: Partial<Omit<AudioTrack, "id">>) => void;
}

export const EditorRightSidebar = ({
  selectedClip,
  selectedTextOverlay,
  selectedAudioTrack,
  isExporting,
  activeMediaFootprintBytes,
  onUpdateClip,
  onUpdateText,
  onUpdateAudio,
}: EditorRightSidebarProps) => {
  return (
    <aside className="space-y-4 xl:min-h-0">
      <Inspector
        clip={selectedClip}
        textOverlay={selectedTextOverlay}
        audioTrack={selectedAudioTrack}
        disabled={isExporting}
        onUpdateClip={onUpdateClip}
        onUpdateText={onUpdateText}
        onUpdateAudio={onUpdateAudio}
      />

      <section className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,33,45,0.9),rgba(12,15,23,0.88))] p-4">
        <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-neutral-500">
          Session Memory
        </p>
        <p className="mt-2 text-lg font-semibold text-white">
          {activeMediaFootprintBytes > 0 ? bytesToLabel(activeMediaFootprintBytes) : "0 B"}
        </p>
        <p className="mt-2 text-sm leading-6 text-neutral-400">
          Assets live only in browser memory and temporary server folders during export.
        </p>
      </section>
    </aside>
  );
};
