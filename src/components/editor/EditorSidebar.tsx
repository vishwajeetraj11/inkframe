"use client";

import { useState } from "react";
import type { SoundEffectId } from "@/lib/editor/sound-effects";
import type { AspectPreset, AssetKind, AssetRef } from "@/lib/editor/types";
import { MediaLibrary } from "@/components/editor/MediaLibrary";
import { StockVideoPanel } from "@/components/editor/stock/StockVideoPanel";
import type { PexelsVideoRendition, PexelsVideoResult } from "@/lib/pexels";

interface MediaLibraryAsset {
  assetId: string;
  kind: AssetKind;
  name: string;
  size: number;
  externalUrl?: string;
  attribution?: AssetRef["attribution"];
}

interface EditorSidebarProps {
  activeAspect?: AspectPreset;
  isExporting: boolean;
  assets: MediaLibraryAsset[];
  onFilesSelected: (files: FileList | null) => void;
  onAddSoundEffect: (effectId: SoundEffectId) => void;
  onRemoveAsset: (assetId: string) => void;
  onAddStockVideo?: (
    video: PexelsVideoResult,
    rendition: PexelsVideoRendition,
  ) => void | Promise<void>;
}

export const EditorSidebar = ({
  activeAspect = "reel_9_16",
  isExporting,
  assets,
  onFilesSelected,
  onAddSoundEffect,
  onRemoveAsset,
  onAddStockVideo,
}: EditorSidebarProps) => {
  const [activeSource, setActiveSource] = useState<"project" | "stock">("project");

  return (
    <aside
      aria-label="Media and elements"
      className="flex h-full min-h-0 flex-col border-b border-white/10 bg-[#15120e] xl:border-b-0 xl:border-r"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div>
          <p className="app-eyebrow text-[9px] uppercase tracking-[0.18em] text-neutral-400">
            Source rail
          </p>
          <h2 className="app-title text-sm font-semibold uppercase text-neutral-50">
            Build the cut
          </h2>
        </div>
        <span className="app-data text-[10px] text-neutral-400">{assets.length} media</span>
      </div>

      <div className="grid grid-cols-2 border-b border-white/10" role="tablist" aria-label="Media source">
        {(["project", "stock"] as const).map((source) => (
          <button
            key={source}
            type="button"
            role="tab"
            aria-selected={activeSource === source}
            onClick={() => setActiveSource(source)}
            className={`h-9 border-r border-white/10 text-[9px] font-semibold uppercase tracking-[0.14em] outline-none transition last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ff4f1f] ${
              activeSource === source
                ? "bg-white/[0.05] text-[#ff9b7d]"
                : "text-neutral-400 hover:text-neutral-100"
            }`}
          >
            {source}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeSource === "project" ? (
          <MediaLibrary
            assets={assets}
            disabled={isExporting}
            onFilesSelected={onFilesSelected}
            onAddSoundEffect={onAddSoundEffect}
            onRemoveAsset={onRemoveAsset}
          />
        ) : (
          <StockVideoPanel
            orientation={activeAspect === "reel_9_16" ? "portrait" : "landscape"}
            disabled={isExporting}
            onAdd={onAddStockVideo}
          />
        )}
      </div>
    </aside>
  );
};
