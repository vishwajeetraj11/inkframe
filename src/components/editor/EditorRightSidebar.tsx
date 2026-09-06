"use client";

import type { Clip, TextOverlay, AudioTrack, EditorTrack, AssetRef, VersionTimeline } from "@/lib/editor/types";
import { DeterministicEditingInspector } from "@/components/editor/features/DeterministicEditingInspector";
import type { EditorAction } from "@/lib/editor/reducer";
import { Inspector } from "@/components/editor/Inspector";

interface EditorRightSidebarProps {
  version?: VersionTimeline;
  selectedCaptionId?: string | null;
  assets?: readonly AssetRef[];
  onEdit?: (action: EditorAction) => boolean;
  selectedClip: Clip | null;
  selectedTextOverlay: TextOverlay | null;
  selectedAudioTrack: AudioTrack | null;
  assetNames: Record<string, string>;
  isExporting: boolean;
  tracks?: readonly EditorTrack[];
  onPlaceClip?: (clipId: string, trackId: string, startFrame: number) => void;
  onReorderTracks?: (trackIds: string[]) => void;
  onUpdateClip: (clipId: string, patch: Partial<Omit<Clip, "id">>) => void;
  onDetachAudio?: (clipId: string) => void;
  onUpdateText: (overlayId: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  onUpdateAudio: (trackId: string, patch: Partial<Omit<AudioTrack, "id">>) => void;
  onRemoveAudio: (trackId: string) => void;
}

export const EditorRightSidebar = ({
  version,
  selectedCaptionId,
  assets = [],
  onEdit,
  selectedClip,
  selectedTextOverlay,
  selectedAudioTrack,
  assetNames,
  isExporting,
  tracks,
  onPlaceClip,
  onReorderTracks,
  onUpdateClip,
  onDetachAudio,
  onUpdateText,
  onUpdateAudio,
  onRemoveAudio,
}: EditorRightSidebarProps) => {
  return (
    <aside
      aria-label="Inspector"
      className="editor-inspector h-full min-h-0 overflow-y-auto border-t border-white/10 bg-[#15120e] xl:border-l xl:border-t-0"
    >
      <Inspector
        captionSelected={Boolean(version?.captionCues?.some((cue) => cue.id === selectedCaptionId))}
        clip={selectedClip}
        textOverlay={selectedTextOverlay}
        audioTrack={selectedAudioTrack}
        assetNames={assetNames}
        disabled={isExporting}
        tracks={tracks}
        onPlaceClip={onPlaceClip}
        onReorderTracks={onReorderTracks}
        onUpdateClip={onUpdateClip}
        onDetachAudio={onDetachAudio}
        onUpdateText={onUpdateText}
        onUpdateAudio={onUpdateAudio}
        onRemoveAudio={onRemoveAudio}
      />
      {version && onEdit ? <DeterministicEditingInspector selectedCaptionId={selectedCaptionId} version={version} clip={selectedClip} assets={assets} assetNames={assetNames} disabled={isExporting} onEdit={onEdit} /> : null}
    </aside>
  );
};
