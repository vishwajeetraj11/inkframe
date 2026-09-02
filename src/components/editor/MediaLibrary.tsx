"use client";

import { useRef } from "react";
import type { AssetKind, AssetRef } from "@/lib/editor/types";

// Elah's public drag contract. Kept local so this light source-rail component
// does not pull the full editor runtime into isolated UI tests.
const MEDIA_DRAG_MIME = "application/x-elah-media";
const mediaDragKindMime = (kind: AssetKind) =>
  `application/x-elah-media-kind-${kind}`;

interface MediaLibraryAsset {
  assetId: string;
  kind: AssetKind;
  name: string;
  size: number;
  externalUrl?: string;
  attribution?: AssetRef["attribution"];
}

interface MediaLibraryProps {
  assets: MediaLibraryAsset[];
  onFilesSelected: (files: FileList | null) => void;
  onRemoveAsset: (assetId: string) => void;
  disabled?: boolean;
}

const bytesToLabel = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const kindLabel: Record<AssetKind, string> = {
  video: "Video",
  image: "Image",
  audio: "Audio",
};

const providerLabel: Record<
  NonNullable<AssetRef["attribution"]>["provider"],
  string
> = {
  pexels: "Pexels",
  mixkit: "Mixkit",
  jamendo: "Jamendo",
  freesound: "Freesound",
};

export const MediaLibrary = ({
  assets,
  onFilesSelected,
  onRemoveAsset,
  disabled,
}: MediaLibraryProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="p-3">
      <input
        ref={inputRef}
        id="media-upload"
        type="file"
        multiple
        accept="video/*,image/jpeg,image/png,image/webp,audio/*"
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          onFilesSelected(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="group flex min-h-20 w-full items-center gap-3 border border-dashed border-white/20 bg-white/[0.025] p-3 text-left outline-none transition hover:border-cyan-300/70 hover:bg-cyan-300/[0.04] focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0 flex-1">
          <span className="app-title block text-sm font-semibold uppercase text-neutral-50">
            Import footage
          </span>
          <span className="mt-0.5 block text-[10px] leading-4 text-neutral-300">
            Video, stills, or audio stay local.
          </span>
        </span>
        <span
          aria-hidden="true"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-white/15 text-lg text-cyan-300 transition group-hover:border-cyan-300"
        >
          +
        </span>
      </button>

      <div className="mt-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h3 className="app-eyebrow text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-300">
            Project media
          </h3>
          <span className="app-data text-[9px] text-neutral-400">{assets.length}</span>
        </div>

        {assets.length === 0 ? (
          <div className="py-4 text-[11px] leading-4 text-neutral-400">
            Imported media will appear here. Add one strong visual to begin.
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {assets.map((asset) => (
              <div
                key={asset.assetId}
                draggable={!disabled}
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    MEDIA_DRAG_MIME,
                    JSON.stringify({ kind: "media-asset", assetId: asset.assetId }),
                  );
                  event.dataTransfer.setData(mediaDragKindMime(asset.kind), "");
                  event.dataTransfer.effectAllowed = "copy";
                }}
                title={`Drag ${asset.name} to a compatible timeline track`}
                className="group flex min-h-12 cursor-grab items-center gap-2 py-1.5 active:cursor-grabbing"
              >
                <span
                  aria-hidden="true"
                  className="app-data inline-flex h-9 w-9 shrink-0 items-center justify-center bg-white/[0.06] text-[10px] font-semibold text-neutral-200"
                >
                  {asset.kind.slice(0, 3).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-neutral-100">{asset.name}</p>
                  <p className="app-data mt-1 text-[9px] uppercase tracking-[0.08em] text-neutral-400">
                    {kindLabel[asset.kind]} · {asset.attribution ? providerLabel[asset.attribution.provider] : asset.externalUrl ? "Built-in" : bytesToLabel(asset.size)}
                  </p>
                  {asset.attribution ? (
                    <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[9px]">
                      <a
                        href={asset.attribution.creatorUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 truncate text-[#ff9b7d] hover:underline"
                      >
                        {kindLabel[asset.kind]} by {asset.attribution.creatorName}
                      </a>
                      {asset.attribution.licenseName && asset.attribution.licenseUrl ? (
                        <>
                          <span aria-hidden="true" className="shrink-0 text-neutral-600">·</span>
                          <a
                            href={asset.attribution.licenseUrl}
                            target="_blank"
                            rel="noreferrer"
                            title={asset.attribution.attributionRequired ? "Credit required when publishing" : "No credit required"}
                            className="shrink-0 text-neutral-400 hover:text-neutral-100"
                          >
                            {asset.attribution.licenseName}
                            {asset.attribution.attributionRequired ? " · credit" : ""}
                          </a>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRemoveAsset(asset.assetId)}
                  aria-label={`Delete ${asset.name}`}
                  title={`Delete ${asset.name}`}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center text-neutral-400 opacity-70 outline-none transition hover:bg-rose-500/10 hover:text-rose-200 focus-visible:ring-2 focus-visible:ring-cyan-300 group-hover:opacity-100 disabled:opacity-40"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="square"
                    strokeLinejoin="round"
                  >
                    <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </section>
  );
};
