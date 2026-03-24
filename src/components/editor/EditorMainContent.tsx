"use client";

import type { VersionTimeline, Clip, TextOverlay } from "@/lib/editor/types";
import { PreviewPane } from "@/components/editor/PreviewPane";
import { Timeline } from "@/components/editor/Timeline";

interface EditorMainContentProps {
  aspect: "reel_9_16" | "widescreen_16_9";
  version: VersionTimeline;
  assetNames: Record<string, string>;
  previewAssetSources: Record<string, string>;
  selectedClipId: string | null;
  selectedTextId: string | null;
  selectedAudioId: string | null;
  isExporting: boolean;
  onSelectClip: (clipId: string | null) => void;
  onSelectText: (textId: string | null) => void;
  onSelectAudio: (audioId: string | null) => void;
  onAddText: () => void;
  onUpdateClip: (clipId: string, patch: Partial<Omit<Clip, "id">>) => void;
  onMoveClip: (clipId: string, offset: -1 | 1) => void;
  onRemoveClip: (clipId: string) => void;
  onSetTransition: (
    fromClipId: string,
    toClipId: string,
    durationInFrames: number
  ) => void;
  onRemoveTransition: (fromClipId: string, toClipId: string) => void;
  onUpdateText: (overlayId: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  onRemoveText: (overlayId: string) => void;
  showPreview?: boolean;
}

export const EditorMainContent = ({
  aspect,
  version,
  assetNames,
  previewAssetSources,
  selectedClipId,
  selectedTextId,
  selectedAudioId,
  isExporting,
  onSelectClip,
  onSelectText,
  onSelectAudio,
  onAddText,
  onUpdateClip,
  onMoveClip,
  onRemoveClip,
  onSetTransition,
  onRemoveTransition,
  onUpdateText,
  onRemoveText,
  showPreview = true,
}: EditorMainContentProps) => {
  return (
    <section className="space-y-4 xl:min-h-0">
      {showPreview ? (
        <PreviewPane
          aspect={aspect}
          version={version}
          assetSources={previewAssetSources}
        />
      ) : null}

      <Timeline
        version={version}
        assetNames={assetNames}
        selectedClipId={selectedClipId}
        selectedTextId={selectedTextId}
        selectedAudioId={selectedAudioId}
        disabled={isExporting}
        onSelectClip={onSelectClip}
        onSelectText={onSelectText}
        onSelectAudio={onSelectAudio}
        onUpdateClip={onUpdateClip}
        onMoveClip={onMoveClip}
        onRemoveClip={onRemoveClip}
        onSetTransition={onSetTransition}
        onRemoveTransition={onRemoveTransition}
        onAddText={onAddText}
        onUpdateText={onUpdateText}
        onRemoveText={onRemoveText}
      />
    </section>
  );
};
