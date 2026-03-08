"use client";

import { AudioInspector } from "@/components/editor/inspector/AudioInspector";
import { ClipInspector } from "@/components/editor/inspector/ClipInspector";
import { TextOverlayInspector } from "@/components/editor/inspector/TextOverlayInspector";
import type { AudioTrack, Clip, TextOverlay } from "@/lib/editor/types";

interface InspectorProps {
  clip: Clip | null;
  textOverlay: TextOverlay | null;
  audioTrack: AudioTrack | null;
  disabled?: boolean;
  onUpdateClip: (clipId: string, patch: Partial<Omit<Clip, "id" | "assetId" | "kind">>) => void;
  onUpdateText: (overlayId: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  onUpdateAudio: (audioId: string, patch: Partial<Omit<AudioTrack, "id" | "assetId">>) => void;
}

export const Inspector = ({
  clip,
  textOverlay,
  audioTrack,
  disabled,
  onUpdateClip,
  onUpdateText,
  onUpdateAudio,
}: InspectorProps) => {
  return (
    <section className="space-y-3 rounded-2xl border border-neutral-700/60 bg-neutral-900/50 p-4">
      <h2 className="app-panel-label text-sm font-semibold uppercase tracking-wide text-neutral-300">
        Inspector
      </h2>

      {!clip && !textOverlay && !audioTrack ? (
        <p className="rounded-lg border border-dashed border-neutral-700 px-3 py-4 text-sm text-neutral-400">
          Select a clip, text overlay, or audio track to edit details.
        </p>
      ) : null}

      {clip ? (
        <ClipInspector clip={clip} disabled={disabled} onUpdateClip={onUpdateClip} />
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
          disabled={disabled}
          onUpdateAudio={onUpdateAudio}
        />
      ) : null}
    </section>
  );
};
