"use client";

import {
  REMOTION_SFX_LIBRARY,
  type RemotionSfxId,
} from "@/lib/editor/remotion-sfx";
import type { AssetKind } from "@/lib/editor/types";

interface MediaLibraryAsset {
  assetId: string;
  kind: AssetKind;
  name: string;
  size: number;
  externalUrl?: string;
}

interface MediaLibraryProps {
  assets: MediaLibraryAsset[];
  onFilesSelected: (files: FileList | null) => void;
  onAddRemotionSfx: (effectId: RemotionSfxId) => void;
  onRemoveAsset: (assetId: string) => void;
  disabled?: boolean;
}

const bytesToLabel = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const kindLabel: Record<AssetKind, string> = {
  video: "Video",
  image: "Image",
  audio: "Audio",
};

export const MediaLibrary = ({
  assets,
  onFilesSelected,
  onAddRemotionSfx,
  onRemoveAsset,
  disabled,
}: MediaLibraryProps) => {
  return (
    <section className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,33,45,0.9),rgba(12,15,23,0.88))] p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-neutral-500">
            Media Bin
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">Assets</h2>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            {assets.length} items
          </span>

          <label
            htmlFor="media-upload"
            className={`cursor-pointer rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/16 ${
              disabled ? "pointer-events-none opacity-60" : ""
            }`}
          >
            Add Media
          </label>
        </div>
      </div>

      <input
        id="media-upload"
        type="file"
        multiple
        accept="video/*,image/jpeg,image/png,image/webp,audio/*"
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          onFilesSelected(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />

      <p className="mb-3 text-sm leading-6 text-neutral-400">
        Upload images, video, and audio to populate the timeline and monitor.
      </p>

      <div className="mb-4 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="app-eyebrow text-[9px] uppercase tracking-[0.16em] text-neutral-500">
              Remotion SFX
            </p>
            <p className="mt-1 text-[11px] leading-4 text-neutral-400">
              Drop in quick editorial sounds without uploading files.
            </p>
          </div>

          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[9px] uppercase tracking-[0.16em] text-neutral-400">
            built-in
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {REMOTION_SFX_LIBRARY.map((effect) => (
            <button
              key={effect.id}
              type="button"
              disabled={disabled}
              onClick={() => onAddRemotionSfx(effect.id)}
              className="rounded-md border border-amber-300/20 bg-amber-300/10 px-1.5 py-0.5 text-[7px] font-medium text-amber-100 transition hover:bg-amber-300/16 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {effect.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {assets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/8 bg-white/[0.03] px-4 py-5 text-sm text-neutral-400">
            Upload JPG/PNG/WEBP images, videos, or audio files.
          </div>
        ) : (
          assets.map((asset) => (
            <div
              key={asset.assetId}
              className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium text-neutral-100">
                  {asset.name}
                </p>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-300">
                    {kindLabel[asset.kind]}
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRemoveAsset(asset.assetId)}
                    aria-label={`Delete ${asset.name}`}
                    title={`Delete ${asset.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-400/35 text-rose-200 transition hover:bg-rose-500/12 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4.8c0-.66.54-1.2 1.2-1.2h5.6c.66 0 1.2.54 1.2 1.2V6" />
                      <path d="M6.5 6l.9 12.1A2 2 0 0 0 9.39 20h5.22a2 2 0 0 0 1.99-1.9L17.5 6" />
                      <path d="M10 10.2v5.6" />
                      <path d="M14 10.2v5.6" />
                    </svg>
                  </button>
                </div>
              </div>

              <p className="app-data mt-2 text-xs text-neutral-500">
                {asset.externalUrl ? "Remotion SFX" : bytesToLabel(asset.size)}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
