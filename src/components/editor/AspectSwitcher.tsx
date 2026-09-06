"use client";

import { ASPECT_PRESETS } from "@/lib/editor/constants";
import type { AspectPreset, ProjectCutdown } from "@/lib/editor/types";
import { Laptop, Scissors, Smartphone } from "lucide-react";

interface AspectSwitcherProps {
  activeAspect: AspectPreset;
  onChange: (aspect: AspectPreset) => void;
  cutdowns?: ProjectCutdown[];
  activeCutdownId?: string;
  onCreateCutdown?: () => void;
  onSwitchCutdown?: (id: string) => void;
  disabled?: boolean;
}

const aspects = Object.keys(ASPECT_PRESETS) as AspectPreset[];

const aspectDetails: Record<AspectPreset, string> = {
  reel_9_16: "Vertical 9:16 canvas for Reels, Shorts, and mobile feeds.",
  widescreen_16_9: "Widescreen 16:9 canvas for desktop and landscape video.",
};

export const AspectSwitcher = ({
  activeAspect,
  onChange,
  cutdowns = [],
  activeCutdownId,
  onCreateCutdown,
  onSwitchCutdown,
  disabled,
}: AspectSwitcherProps) => {
  return (
    <div
      className="flex h-[44px] items-center border border-white/10 bg-[#17140f] xl:h-10"
      role="group"
      aria-label="Canvas aspect ratio"
    >
      {aspects.map((aspect) => {
        const preset = ASPECT_PRESETS[aspect];
        const isActive = aspect === activeAspect && !activeCutdownId;
        const Icon = aspect === "reel_9_16" ? Smartphone : Laptop;
        const tooltipId = `aspect-tooltip-${aspect}`;

        return (
          <button
            key={aspect}
            type="button"
            aria-label={`Use ${preset.label} canvas`}
            aria-describedby={tooltipId}
            aria-pressed={isActive}
            disabled={disabled}
            onClick={() => onChange(aspect)}
            className={`group relative inline-flex h-[44px] w-[48px] items-center justify-center text-[10px] font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 xl:h-9 ${
              isActive
                ? "bg-neutral-100 text-neutral-950"
                : "text-neutral-300 hover:bg-white/[0.06] hover:text-neutral-50"
            } ${disabled ? "opacity-60" : ""}`}
          >
            <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.7} />
            <span
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-50 w-max max-w-52 -translate-x-1/2 translate-y-[-2px] border border-white/15 bg-[#17140f] px-2.5 py-1.5 text-left text-[10px] font-medium leading-4 text-neutral-100 opacity-0 shadow-xl transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
            >
              <span className="block">{preset.label}</span>
              <span className="block text-[9px] font-normal text-neutral-400">{aspectDetails[aspect]}</span>
            </span>
          </button>
        );
      })}
      {cutdowns.length > 0 ? (
        <span className="group/version relative h-full">
          <select
            aria-label="Project version"
            aria-describedby="version-selector-tooltip"
            disabled={disabled}
            value={activeCutdownId ?? ""}
            onChange={(event) => event.target.value ? onSwitchCutdown?.(event.target.value) : onChange(activeAspect)}
            className="h-full max-w-28 border-l border-white/10 bg-[#17140f] px-2 text-[10px] font-semibold text-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300"
          >
            <option value="">Full cut</option>
            {cutdowns.map((cutdown) => <option key={cutdown.id} value={cutdown.id}>{cutdown.name} · {cutdown.sourceAspect === "reel_9_16" ? "9:16" : "16:9"}</option>)}
          </select>
          <span
            id="version-selector-tooltip"
            role="tooltip"
            className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-50 w-56 -translate-x-1/2 translate-y-[-2px] border border-white/15 bg-[#17140f] px-2.5 py-1.5 text-left text-[10px] font-medium leading-4 text-neutral-100 opacity-0 shadow-xl transition duration-150 group-hover/version:translate-y-0 group-hover/version:opacity-100 group-focus-within/version:translate-y-0 group-focus-within/version:opacity-100"
          >
            Full cut is the complete timeline. Choose a saved shorter version to edit or export it independently.
          </span>
        </span>
      ) : null}
      {onCreateCutdown ? (
        <button
          type="button"
          aria-label="Create 15 second cutdown from this version"
          aria-describedby="create-cutdown-tooltip"
          disabled={disabled}
          onClick={onCreateCutdown}
          className="group/cutdown relative inline-flex h-full w-11 items-center justify-center border-l border-white/10 text-neutral-300 outline-none transition hover:bg-white/[0.06] hover:text-neutral-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300 disabled:opacity-60"
        >
          <Scissors aria-hidden="true" className="h-4 w-4" strokeWidth={1.7} />
          <span
            id="create-cutdown-tooltip"
            role="tooltip"
            className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-50 w-56 translate-y-[-2px] border border-white/15 bg-[#17140f] px-2.5 py-1.5 text-left text-[10px] font-medium leading-4 text-neutral-100 opacity-0 shadow-xl transition duration-150 group-hover/cutdown:translate-y-0 group-hover/cutdown:opacity-100 group-focus-visible/cutdown:translate-y-0 group-focus-visible/cutdown:opacity-100"
          >
            Create an independent cut from the first 15 seconds. Your full timeline stays unchanged.
          </span>
        </button>
      ) : null}
    </div>
  );
};
