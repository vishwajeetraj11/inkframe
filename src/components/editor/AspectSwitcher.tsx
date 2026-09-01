"use client";

import { ASPECT_PRESETS } from "@/lib/editor/constants";
import type { AspectPreset } from "@/lib/editor/types";

interface AspectSwitcherProps {
  activeAspect: AspectPreset;
  onChange: (aspect: AspectPreset) => void;
  disabled?: boolean;
}

const aspects = Object.keys(ASPECT_PRESETS) as AspectPreset[];

export const AspectSwitcher = ({
  activeAspect,
  onChange,
  disabled,
}: AspectSwitcherProps) => {
  return (
    <div
      className="flex min-h-11 items-center border border-white/10 bg-[#17140f] p-1"
      role="group"
      aria-label="Canvas aspect ratio"
    >
      {aspects.map((aspect) => {
        const preset = ASPECT_PRESETS[aspect];
        const isActive = aspect === activeAspect;

        return (
          <button
            key={aspect}
            type="button"
            aria-label={`Use ${preset.label} canvas`}
            aria-pressed={isActive}
            disabled={disabled}
            onClick={() => onChange(aspect)}
            className={`min-h-11 px-3 text-xs font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:px-4 ${
              isActive
                ? "bg-neutral-100 text-neutral-950"
                : "text-neutral-300 hover:bg-white/[0.06] hover:text-neutral-50"
            } ${disabled ? "opacity-60" : ""}`}
          >
            <span className="hidden sm:inline">{preset.label}</span>
            <span className="sm:hidden">{aspect === "reel_9_16" ? "9:16" : "16:9"}</span>
          </button>
        );
      })}
    </div>
  );
};
