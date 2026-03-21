"use client";

import { AspectSwitcher } from "@/components/editor/AspectSwitcher";
import type { AspectPreset } from "@/lib/editor/types";

interface WorkspaceStat {
  label: string;
  value: string;
}

interface EditorHeaderProps {
  activeAspect: AspectPreset;
  isExporting: boolean;
  statusMessage: string | null;
  workspaceStats: WorkspaceStat[];
  canExport: boolean;
  onSwitchAspect: (aspect: AspectPreset) => void;
  onExport: () => void;
}

const aspectLabel = (value: AspectPreset): string =>
  value === "reel_9_16" ? "9:16" : "16:9";

export const EditorHeader = ({
  activeAspect,
  isExporting,
  statusMessage,
  workspaceStats,
  canExport,
  onSwitchAspect,
  onExport,
}: EditorHeaderProps) => {
  return (
    <header className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(28,33,45,0.96),rgba(13,17,27,0.9))] px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.32)] backdrop-blur-md md:px-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="app-eyebrow rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-cyan-200">
              Ephemeral Studio
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
              Session-only
            </span>
          </div>

          <h1 className="app-title mt-3 text-2xl font-semibold tracking-[-0.05em] text-white md:text-3xl">
            Video editor with a real studio workspace
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
            Cut footage, manage overlays, preview Remotion output, and export without leaving
            the same workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AspectSwitcher
            activeAspect={activeAspect}
            disabled={isExporting}
            onChange={onSwitchAspect}
          />

          <button
            type="button"
            disabled={isExporting || !canExport}
            onClick={onExport}
            className="rounded-xl bg-[linear-gradient(135deg,#67e8f9,#34d399)] px-4 py-2.5 text-sm font-semibold text-neutral-950 shadow-[0_16px_38px_rgba(52,211,153,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? "Rendering..." : "Export MP4"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {workspaceStats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2"
          >
            <p className="app-eyebrow text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              {stat.label}
            </p>
            <p className="app-data mt-1 text-sm font-medium text-neutral-100">{stat.value}</p>
          </div>
        ))}

        <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2">
          <p className="app-eyebrow text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            Upload Caps
          </p>
          <p className="mt-1 text-sm text-neutral-300">
            Video 100MB, image 10MB, audio 100MB
          </p>
        </div>
      </div>

      {statusMessage ? (
        <p className="mt-4 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-neutral-200">
          {statusMessage}
        </p>
      ) : null}
    </header>
  );
};
