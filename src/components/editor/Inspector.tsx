"use client";

import { AudioInspector } from "@/components/editor/inspector/AudioInspector";
import { ClipInspector } from "@/components/editor/inspector/ClipInspector";
import { TextOverlayInspector } from "@/components/editor/inspector/TextOverlayInspector";
import type { AudioTrack, Clip, TextOverlay, EditorTrack } from "@/lib/editor/types";

interface InspectorProps {
  captionSelected?: boolean;
  clip: Clip | null;
  textOverlay: TextOverlay | null;
  audioTrack: AudioTrack | null;
  assetNames?: Record<string, string>;
  disabled?: boolean;
  tracks?: readonly EditorTrack[];
  onPlaceClip?: (clipId: string, trackId: string, startFrame: number) => void;
  onReorderTracks?: (trackIds: string[]) => void;
  onUpdateClip: (clipId: string, patch: Partial<Omit<Clip, "id" | "assetId" | "kind">>) => void;
  onDetachAudio?: (clipId: string) => void;
  onUpdateText: (overlayId: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  onUpdateAudio: (audioId: string, patch: Partial<Omit<AudioTrack, "id" | "assetId">>) => void;
  onRemoveAudio?: (audioId: string) => void;
}

export const Inspector = ({
  captionSelected = false,
  clip,
  textOverlay,
  audioTrack,
  assetNames = {},
  disabled,
  tracks,
  onPlaceClip,
  onReorderTracks,
  onUpdateClip,
  onDetachAudio,
  onUpdateText,
  onUpdateAudio,
  onRemoveAudio,
}: InspectorProps) => {
  const activeKind = clip ? "Clip" : textOverlay ? "Text Overlay" : audioTrack ? "Audio Track" : captionSelected ? "Caption" : null;

  return (
    <section className="space-y-3 bg-[#15120e] p-3">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
        <div>
          <p className="app-eyebrow text-[9px] uppercase tracking-[0.18em] text-neutral-400">
            Properties
          </p>
          <h2 className="app-title text-sm font-semibold uppercase text-neutral-50">
            Inspector
          </h2>
        </div>

        {activeKind ? (
          <span className="app-data border border-white/10 px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-neutral-300">
            {activeKind}
          </span>
        ) : null}
      </div>

      {!clip && !textOverlay && !audioTrack && !captionSelected ? (
        <div className="border border-dashed border-white/15 bg-white/[0.02] px-3 py-4">
          <p className="app-title text-sm font-semibold uppercase text-neutral-100">
            Nothing selected
          </p>
          <p className="mt-1 text-xs leading-5 text-neutral-400">
            Select a clip, text overlay, or audio track in the timeline to reveal its controls here.
          </p>
        </div>
      ) : null}

      {clip ? (
        <ClipInspector
          clip={clip}
          disabled={disabled}
          tracks={tracks}
          onPlaceClip={onPlaceClip}
          onReorderTracks={onReorderTracks}
          onUpdateClip={onUpdateClip}
          onDetachAudio={onDetachAudio}
        />
      ) : null}

      {textOverlay ? (
        <TextOverlayInspector
          overlay={textOverlay}
          disabled={disabled}
          onUpdateText={onUpdateText}
        />
      ) : null}

      {audioTrack ? (
        <AudioInspector
          audioTrack={audioTrack}
          audioLabel={assetNames[audioTrack.assetId] ?? audioTrack.assetId}
          disabled={disabled}
          onUpdateAudio={onUpdateAudio}
          onRemoveAudio={onRemoveAudio}
        />
      ) : null}
    </section>
  );
};
