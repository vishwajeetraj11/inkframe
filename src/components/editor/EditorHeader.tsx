"use client";

import Link from "next/link";
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
    <header className="relative z-20 border-b border-white/10 bg-[#0f0d0a]/95 px-3 backdrop-blur-xl md:px-4">
      <div className="mx-auto flex h-[53px] w-full max-w-[1800px] flex-nowrap items-center gap-2">
        <Link
          href="/"
          className="group inline-flex min-h-10 items-center gap-2.5 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <span className="h-2.5 w-2.5 bg-cyan-300 transition-transform duration-200 group-hover:rotate-45" />
          <span className="app-title text-sm font-semibold uppercase tracking-[0.1em] text-neutral-50">
            Inkframe
          </span>
        </Link>

        <span aria-hidden="true" className="hidden h-6 w-px bg-white/10 sm:block" />

        <nav aria-label="Studio" className="hidden items-center gap-1 lg:flex">
          <span className="inline-flex min-h-10 items-center border-b border-cyan-300 px-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-100">
            Editor
          </span>
          <Link
            href="/templates"
            className="inline-flex min-h-10 items-center border-b border-transparent px-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-400 transition hover:border-white/20 hover:text-neutral-100 focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            Templates
          </Link>
          <Link
            href="/text-motion"
            className="inline-flex min-h-10 items-center border-b border-transparent px-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-400 transition hover:border-white/20 hover:text-neutral-100 focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            Text motion
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-4 border-r border-white/10 pr-4 2xl:flex">
            {workspaceStats.map((stat) => (
              <span key={stat.label} className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="app-eyebrow text-[10px] uppercase tracking-[0.14em] text-neutral-400">
                  {stat.label}
                </span>
                <span className="app-data text-xs text-neutral-100">{stat.value}</span>
              </span>
            ))}
          </div>

          <AspectSwitcher
            activeAspect={activeAspect}
            disabled={isExporting}
            onChange={onSwitchAspect}
          />

          <button
            type="button"
            disabled={isExporting || !canExport}
            onClick={onExport}
            className="inline-flex min-h-10 items-center justify-center bg-cyan-300 px-3 text-[10px] font-semibold text-neutral-950 outline-none transition hover:bg-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0d0a] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isExporting ? "Rendering…" : "Export"}
          </button>
        </div>
      </div>

      {statusMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="relative z-30 mb-2 w-full border border-white/10 bg-[#1b1813] px-4 py-3 text-sm text-neutral-100 shadow-2xl xl:absolute xl:left-1/2 xl:top-full xl:mb-0 xl:w-[min(92vw,680px)] xl:-translate-x-1/2"
        >
          {statusMessage}
        </div>
      ) : null}
    </header>
  );
};
