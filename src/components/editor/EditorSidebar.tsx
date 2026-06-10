"use client";

import type { RemotionSfxId } from "@/lib/editor/remotion-sfx";
import type { Clip, TextOverlay, AudioTrack, AssetKind } from "@/lib/editor/types";
import { TEXT_OVERLAY_STYLE_PRESET_LABELS } from "@/lib/editor/types";
import { MediaLibrary } from "@/components/editor/MediaLibrary";
import { nanoid } from "nanoid";
import { createDefaultTextOverlay } from "@/lib/editor/defaults";

interface MediaLibraryAsset {
  assetId: string;
  kind: AssetKind;
  name: string;
  size: number;
}

interface EditorSidebarProps {
  clips: Clip[];
  textOverlays: TextOverlay[];
  audioTracks: AudioTrack[];
  selectedClipId: string | null;
  selectedTextId: string | null;
  selectedAudioId: string | null;
  isExporting: boolean;
  assetNames: Record<string, string>;
  assets: MediaLibraryAsset[];
  onSelectClip: (clipId: string | null) => void;
  onSelectText: (textId: string | null) => void;
  onSelectAudio: (audioId: string | null) => void;
  onAddText: () => void;
  onFilesSelected: (files: FileList | null) => void;
  onAddRemotionSfx: (effectId: RemotionSfxId) => void;
  onRemoveAsset: (assetId: string) => void;
}

const kindPillClassName = (kind: "clip" | "text" | "audio"): string =>
  kind === "clip"
    ? "border-emerald-300/20 bg-emerald-300/12 text-emerald-100"
    : kind === "text"
      ? "border-cyan-300/20 bg-cyan-300/12 text-cyan-100"
      : "border-amber-300/20 bg-amber-300/12 text-amber-100";

export const EditorSidebar = ({
  clips,
  textOverlays,
  audioTracks,
  selectedClipId,
  selectedTextId,
  selectedAudioId,
  isExporting,
  assetNames,
  assets,
  onSelectClip,
  onSelectText,
  onSelectAudio,
  onAddText,
  onFilesSelected,
  onAddRemotionSfx,
  onRemoveAsset,
}: EditorSidebarProps) => {
  return (
    <aside className="space-y-4 xl:min-h-0">
      <MediaLibrary
        assets={assets}
        disabled={isExporting}
        onFilesSelected={onFilesSelected}
        onAddRemotionSfx={onAddRemotionSfx}
        onRemoveAsset={onRemoveAsset}
      />

      <section className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(33,30,24,0.9),rgba(18,16,12,0.88))] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-neutral-500">
              Layers
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">Active Timeline Items</h2>
          </div>

          <button
            type="button"
            disabled={isExporting}
            onClick={onAddText}
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/16 disabled:opacity-60"
          >
            Add Text
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="app-eyebrow text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                Clips
              </p>
              <span className="text-xs text-neutral-500">{clips.length}</span>
            </div>

            {clips.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/8 px-3 py-3 text-sm text-neutral-500">
                No clips yet.
              </p>
            ) : (
              <div className="space-y-2">
                {clips.map((clip, index) => (
                  <button
                    key={clip.id}
                    type="button"
                    onClick={() => onSelectClip(clip.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      selectedClipId === clip.id
                        ? "border-emerald-300/35 bg-emerald-300/10 ring-1 ring-emerald-300/15"
                        : "border-white/8 bg-white/[0.03] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {assetNames[clip.assetId] ?? `Clip ${index + 1}`}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {clip.kind} • {((clip.endFrame - clip.startFrame) / 30).toFixed(2)}s
                        </p>
                      </div>

                      <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${kindPillClassName("clip")}`}>
                        clip
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="app-eyebrow text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                Text Overlays
              </p>
              <span className="text-xs text-neutral-500">{textOverlays.length}</span>
            </div>

            {textOverlays.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/8 px-3 py-3 text-sm text-neutral-500">
                No text overlays.
              </p>
            ) : (
              <div className="space-y-2">
                {textOverlays.map((overlay, index) => (
                  <button
                    key={overlay.id}
                    type="button"
                    onClick={() => onSelectText(overlay.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      selectedTextId === overlay.id
                        ? "border-cyan-300/35 bg-cyan-300/10 ring-1 ring-cyan-300/15"
                        : "border-white/8 bg-white/[0.03] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {overlay.text.split("\n")[0] || `Text ${index + 1}`}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {TEXT_OVERLAY_STYLE_PRESET_LABELS[overlay.stylePreset]}
                        </p>
                      </div>

                      <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${kindPillClassName("text")}`}>
                        text
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="app-eyebrow text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                Audio
              </p>
              <span className="text-xs text-neutral-500">{audioTracks.length}</span>
            </div>

            {audioTracks.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/8 px-3 py-3 text-sm text-neutral-500">
                No audio tracks.
              </p>
            ) : (
              <div className="space-y-2">
                {audioTracks.map((track, index) => (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => onSelectAudio(track.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      selectedAudioId === track.id
                        ? "border-amber-300/35 bg-amber-300/10 ring-1 ring-amber-300/15"
                        : "border-white/8 bg-white/[0.03] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {assetNames[track.assetId] ?? `Audio ${index + 1}`}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {((track.endFrame - track.startFrame) / 30).toFixed(2)}s
                        </p>
                      </div>

                      <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${kindPillClassName("audio")}`}>
                        audio
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </aside>
  );
};
