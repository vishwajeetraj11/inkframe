"use client";

import type { AssetKind } from "@/lib/editor/types";

interface MediaLibraryAsset {
  assetId: string;
  kind: AssetKind;
  name: string;
  size: number;
}

interface MediaLibraryProps {
  assets: MediaLibraryAsset[];
  onFilesSelected: (files: FileList | null) => void;
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
                    className="rounded-xl border border-rose-400/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-200 hover:bg-rose-500/12 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <p className="app-data mt-2 text-xs text-neutral-500">{bytesToLabel(asset.size)}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
