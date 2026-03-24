"use client";

import { AudioInspector } from "@/components/editor/inspector/AudioInspector";
import { ClipInspector } from "@/components/editor/inspector/ClipInspector";
import { TextOverlayInspector } from "@/components/editor/inspector/TextOverlayInspector";
import type { AudioTrack, Clip, TextOverlay } from "@/lib/editor/types";

interface InspectorProps {
  clip: Clip | null;
  textOverlay: TextOverlay | null;
  audioTrack: AudioTrack | null;
  assetNames?: Record<string, string>;
  disabled?: boolean;
  onUpdateClip: (clipId: string, patch: Partial<Omit<Clip, "id" | "assetId" | "kind">>) => void;
  onUpdateText: (overlayId: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  onUpdateAudio: (audioId: string, patch: Partial<Omit<AudioTrack, "id" | "assetId">>) => void;
  onRemoveAudio?: (audioId: string) => void;
}

export const Inspector = ({
  clip,
  textOverlay,
  audioTrack,
  assetNames = {},
  disabled,
  onUpdateClip,
  onUpdateText,
  onUpdateAudio,
  onRemoveAudio,
}: InspectorProps) => {
  const activeKind = clip ? "Clip" : textOverlay ? "Text Overlay" : audioTrack ? "Audio Track" : null;

  return (
    <section className="space-y-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,38,0.96),rgba(11,13,20,0.88))] p-5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-neutral-500">
            Editor Sidebar
          </p>
          <h2 className="app-panel-label mt-2 text-sm font-semibold uppercase tracking-wide text-neutral-200">
            Inspector
          </h2>
        </div>

        {activeKind ? (
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            {activeKind}
          </span>
        ) : null}
      </div>

      {!clip && !textOverlay && !audioTrack ? (
        <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-neutral-400">
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
          audioLabel={assetNames[audioTrack.assetId] ?? audioTrack.assetId}
          disabled={disabled}
          onUpdateAudio={onUpdateAudio}
          onRemoveAudio={onRemoveAudio}
        />
      ) : null}
    </section>
  );
};
