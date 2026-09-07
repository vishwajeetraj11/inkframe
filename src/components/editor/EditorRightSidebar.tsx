"use client";

import type { Clip, TextOverlay, AudioTrack, EditorTrack, AssetRef, VersionTimeline, VideoFilter } from "@/lib/editor/types";
import type { ColorPreviewFilters } from "@/components/editor/ColorConsistencyPanel";
import { DeterministicEditingInspector } from "@/components/editor/features/DeterministicEditingInspector";
import type { EditorAction } from "@/lib/editor/reducer";
import { Inspector } from "@/components/editor/Inspector";
import { ColorConsistencyPanel } from "@/components/editor/ColorConsistencyPanel";

interface EditorRightSidebarProps {
  version?: VersionTimeline;
  selectedCaptionId?: string | null;
  assets?: readonly AssetRef[];
  assetSources?: Readonly<Record<string, string>>;
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
  revision: number;
  onPreviewFilters: (filters: ColorPreviewFilters | null) => void;
  onApplyColorCorrections: (changes: readonly { clipId: string; after: VideoFilter }[]) => void;
  onUndoColorPass: () => void;
  onDetachAudio?: (clipId: string) => void;
  onUpdateText: (overlayId: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  onUpdateAudio: (trackId: string, patch: Partial<Omit<AudioTrack, "id">>) => void;
  onRemoveAudio: (trackId: string) => void;
}

export const EditorRightSidebar = ({
  version,
  selectedCaptionId,
  assets = [],
  assetSources = {},
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
  revision,
  onPreviewFilters,
  onApplyColorCorrections,
  onUndoColorPass,
  onDetachAudio,
  onUpdateText,
  onUpdateAudio,
  onRemoveAudio,
}: EditorRightSidebarProps) => {
  const sourceMetadata = selectedClip
    ? assets.find((asset) => asset.assetId === selectedClip.assetId)?.mediaMetadata
    : undefined;
  const sourceDimensions = sourceMetadata?.width && sourceMetadata.height
    ? { width: sourceMetadata.width, height: sourceMetadata.height }
    : undefined;

  return (
    <aside
      aria-label="Inspector"
      className="editor-inspector h-full min-h-0 overflow-y-auto border-t border-white/10 bg-[#15120e] xl:border-l xl:border-t-0"
    >
      {version ? <ColorConsistencyPanel version={version} assets={assets} assetSources={assetSources} revision={revision} disabled={isExporting} onPreviewFilters={onPreviewFilters} onApplyCorrections={(changes) => onApplyColorCorrections(changes.map((change) => ({ clipId: change.clipId, after: change.after })))} onUndoColorPass={onUndoColorPass} /> : null}
      <Inspector
        captionSelected={Boolean(version?.captionCues?.some((cue) => cue.id === selectedCaptionId))}
        clip={selectedClip}
        textOverlay={selectedTextOverlay}
        audioTrack={selectedAudioTrack}
        assetNames={assetNames}
        sourceDimensions={sourceDimensions}
        targetAspect={version?.aspect}
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
      {version && onEdit ? <DeterministicEditingInspector selectedCaptionId={selectedCaptionId} version={version} clip={selectedClip} assets={assets} assetNames={assetNames} assetSources={assetSources} revision={revision} disabled={isExporting} onEdit={onEdit} /> : null}
    </aside>
  );
};
