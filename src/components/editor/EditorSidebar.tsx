"use client";

import { useState } from "react";
import { Film, FolderOpen, Volume2 } from "lucide-react";
import type { AspectPreset, AssetKind, AssetRef } from "@/lib/editor/types";
import { MediaLibrary } from "@/components/editor/MediaLibrary";
import { StockAudioPanel } from "@/components/editor/stock/StockAudioPanel";
import { StockVideoPanel } from "@/components/editor/stock/StockVideoPanel";
import type { PexelsVideoRendition, PexelsVideoResult } from "@/lib/pexels";
import type { LicensedAudioResult } from "@/lib/stock-audio";

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
  onRemoveAsset: (assetId: string) => void;
  onAddStockVideo?: (
    video: PexelsVideoResult,
    rendition: PexelsVideoRendition,
  ) => void | Promise<void>;
  onAddStockSoundEffect?: (
    query: string,
    audio: LicensedAudioResult,
  ) => { ok: boolean; message: string } | Promise<{ ok: boolean; message: string }>;
}

export const EditorSidebar = ({
  activeAspect = "reel_9_16",
  isExporting,
  assets,
  onFilesSelected,
  onRemoveAsset,
  onAddStockVideo,
  onAddStockSoundEffect,
}: EditorSidebarProps) => {
  const [activeSource, setActiveSource] = useState<
    "project" | "footage" | "sound-effects"
  >("project");

  return (
    <aside
      aria-label="Media and elements"
      className="editor-source-panel flex h-full min-h-0 flex-col bg-[#15120e] xl:border-r"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div>
          <p className="app-eyebrow text-[9px] tracking-[0.18em] text-neutral-400">
            Source rail
          </p>
          <h2 className="app-title text-sm font-semibold text-neutral-50">
            Build the cut
          </h2>
        </div>
        <span className="app-data text-[10px] text-neutral-400">{assets.length} media</span>
      </div>

      <div className="grid grid-cols-3 border-b border-white/10" role="tablist" aria-label="Media source">
        {([
          ["project", "Project", FolderOpen],
          ["footage", "Footage", Film],
          ["sound-effects", "Sound effects", Volume2],
        ] as const).map(([source, label]) => (
          <button
            key={source}
            type="button"
            role="tab"
            aria-selected={activeSource === source}
            onClick={() => setActiveSource(source)}
            className={`relative flex h-11 items-center justify-center gap-1 border-r border-white/10 px-1 text-[7px] font-semibold tracking-[0.02em] whitespace-nowrap outline-none transition last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ff4f1f] xl:h-10 ${
              activeSource === source
                ? "text-[#f2ede3]"
                : "text-neutral-500 hover:bg-white/[0.025] hover:text-neutral-200"
            }`}
          >
            <span aria-hidden="true">
              {source === "project" ? <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.7} /> : null}
              {source === "footage" ? <Film className="h-3.5 w-3.5" strokeWidth={1.7} /> : null}
              {source === "sound-effects" ? <Volume2 className="h-3.5 w-3.5" strokeWidth={1.7} /> : null}
            </span>
            {label}
            {activeSource === source ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-3 bottom-0 h-px bg-[#ff4f1f]"
              />
            ) : null}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeSource === "project" ? (
          <MediaLibrary
            assets={assets}
            disabled={isExporting}
            onFilesSelected={onFilesSelected}
            onRemoveAsset={onRemoveAsset}
          />
        ) : activeSource === "footage" ? (
          <StockVideoPanel
            orientation={activeAspect === "reel_9_16" ? "portrait" : "landscape"}
            disabled={isExporting}
            onAdd={onAddStockVideo}
          />
        ) : (
          <StockAudioPanel
            disabled={isExporting}
            onAdd={onAddStockSoundEffect}
          />
        )}
      </div>
    </aside>
  );
};
