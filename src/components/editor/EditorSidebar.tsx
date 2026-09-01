"use client";

import Link from "next/link";
import type { RemotionSfxId } from "@/lib/editor/remotion-sfx";
import type { AssetKind } from "@/lib/editor/types";
import { MediaLibrary } from "@/components/editor/MediaLibrary";

interface MediaLibraryAsset {
  assetId: string;
  kind: AssetKind;
  name: string;
  size: number;
}

interface EditorSidebarProps {
  isExporting: boolean;
  assets: MediaLibraryAsset[];
  onFilesSelected: (files: FileList | null) => void;
  onAddRemotionSfx: (effectId: RemotionSfxId) => void;
  onRemoveAsset: (assetId: string) => void;
}

export const EditorSidebar = ({
  isExporting,
  assets,
  onFilesSelected,
  onAddRemotionSfx,
  onRemoveAsset,
}: EditorSidebarProps) => {
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

      <div className="border-b border-white/10 lg:hidden">
        <Link
          href="/templates"
          className="inline-flex min-h-11 w-full items-center justify-start px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-300 outline-none transition hover:bg-white/[0.05] hover:text-neutral-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300"
        >
          Templates
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <MediaLibrary
          assets={assets}
          disabled={isExporting}
          onFilesSelected={onFilesSelected}
          onAddRemotionSfx={onAddRemotionSfx}
          onRemoveAsset={onRemoveAsset}
        />
      </div>
    </aside>
  );
};
