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
    <div className="flex gap-2 rounded-xl border border-neutral-700/60 bg-neutral-900/50 p-1">
      {aspects.map((aspect) => {
        const preset = ASPECT_PRESETS[aspect];
        const isActive = aspect === activeAspect;

        return (
          <button
            key={aspect}
            type="button"
            disabled={disabled}
            onClick={() => onChange(aspect)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-cyan-300 text-neutral-950"
                : "text-neutral-200 hover:bg-neutral-800"
            } ${disabled ? "opacity-60" : ""}`}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
};
