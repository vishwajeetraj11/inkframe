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
    <section className="rounded-2xl border border-neutral-700/60 bg-neutral-900/50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="app-panel-label text-sm font-semibold uppercase tracking-wide text-neutral-300">
          Media Library
        </h2>

        <label
          htmlFor="media-upload"
          className={`cursor-pointer rounded-lg bg-cyan-300 px-3 py-1 text-sm font-semibold text-neutral-950 ${
            disabled ? "pointer-events-none opacity-60" : ""
          }`}
        >
          Add Media
        </label>
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

      <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
        {assets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-700 px-4 py-5 text-sm text-neutral-400">
            Upload JPG/PNG/WEBP images, videos, or audio files.
          </div>
        ) : (
          assets.map((asset) => (
            <div
              key={asset.assetId}
              className="rounded-lg border border-neutral-700/70 bg-neutral-800/60 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium text-neutral-100">
                  {asset.name}
                </p>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-neutral-700 px-2 py-0.5 text-xs font-semibold text-neutral-200">
                    {kindLabel[asset.kind]}
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRemoveAsset(asset.assetId)}
                    className="rounded-md border border-rose-400/70 px-2 py-0.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <p className="app-data mt-1 text-xs text-neutral-400">{bytesToLabel(asset.size)}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
