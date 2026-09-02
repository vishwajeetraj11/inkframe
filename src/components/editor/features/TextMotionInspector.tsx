import { Sparkles } from "lucide-react";
import { FeatureIconButton } from "./FeatureIconButton";

/** Effects rendered by the same Elah resolver in preview and browser export. */
export const TEXT_MOTION_EFFECTS = [
  "none",
  "fade",
  "rise",
  "slide-left",
  "punch",
  "typewriter",
  "word-reveal",
] as const;
export type TextMotionEffect = (typeof TEXT_MOTION_EFFECTS)[number];

const MOTION_LABELS: Record<TextMotionEffect, string> = {
  none: "None",
  fade: "Soft fade",
  rise: "Rise + fade",
  "slide-left": "Slide from left",
  punch: "Punch in",
  typewriter: "Typewriter",
  "word-reveal": "Word reveal",
};

const TIMING_PRESETS = [
  { label: "Snap", seconds: 0.2 },
  { label: "Smooth", seconds: 0.4 },
  { label: "Cinematic", seconds: 0.65 },
] as const;

export interface TextMotionInspectorValue {
  in: TextMotionEffect;
  out: TextMotionEffect;
  duration: number;
}

export interface TextMotionInspectorProps {
  textMotion: TextMotionInspectorValue;
  disabled?: boolean;
  onUpdate: (patch: Partial<TextMotionInspectorValue>) => void;
  onReset?: () => void;
}

const controlClassName =
  "h-9 w-full border border-[#f2ede3]/15 bg-[#0f0d0a] px-2.5 text-xs text-[#f2ede3] outline-none transition-colors hover:border-[#f2ede3]/35 focus-visible:border-[#ff4f1f] focus-visible:ring-1 focus-visible:ring-[#ff4f1f] disabled:cursor-not-allowed disabled:opacity-45";
const labelClassName =
  "app-eyebrow text-[9px] uppercase tracking-[0.18em] text-[#f2ede3]/45";

const displayDuration = (seconds: number): number => Number(seconds.toFixed(2));

export const TextMotionInspector = ({
  textMotion,
  disabled = false,
  onUpdate,
  onReset,
}: TextMotionInspectorProps) => {
  const headingId = "text-motion-inspector-heading";

  return (
    <section
      aria-labelledby={headingId}
      className="border-y border-[#f2ede3]/12 bg-[#15120e] text-[#f2ede3]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-[#f2ede3]/10 px-3 py-2.5">
        <div>
          <p className="app-eyebrow flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-[#ff4f1f]">
            <Sparkles aria-hidden="true" size={12} />
            Kinetic type
          </p>
          <h2 id={headingId} className="mt-0.5 text-sm font-semibold tracking-[-0.01em]">
            Text motion
          </h2>
        </div>
        {onReset ? (
          <FeatureIconButton
            disabled={disabled}
            icon={Sparkles}
            label="Reset text motion"
            onClick={onReset}
          />
        ) : null}
      </header>

      <div className="grid gap-x-3 gap-y-3 px-3 py-3 sm:grid-cols-2">
        {(["in", "out"] as const).map((phase) => (
          <label key={phase} className="space-y-1">
            <span className={labelClassName}>{phase === "in" ? "In motion" : "Out motion"}</span>
            <select
              aria-label={`${phase === "in" ? "In" : "Out"} motion effect`}
              className={controlClassName}
              disabled={disabled}
              value={textMotion[phase]}
              onChange={(event) =>
                onUpdate({ [phase]: event.currentTarget.value as TextMotionEffect })
              }
            >
              {TEXT_MOTION_EFFECTS.map((effect) => (
                <option key={effect} value={effect}>
                  {MOTION_LABELS[effect]}
                </option>
              ))}
            </select>
          </label>
        ))}

        <div className="space-y-1 sm:col-span-2">
          <label className={labelClassName} htmlFor="text-motion-duration">
            Duration (s)
          </label>
          <div className="flex h-9 items-center gap-2 border border-[#f2ede3]/15 bg-[#0f0d0a] px-2.5 focus-within:border-[#ff4f1f] focus-within:ring-1 focus-within:ring-[#ff4f1f]">
            <input
              aria-label="Text motion duration"
              id="text-motion-duration"
              className="app-data min-w-0 flex-1 bg-transparent text-xs text-[#f2ede3] outline-none"
              disabled={disabled}
              max={10}
              min={0.05}
              onChange={(event) => {
                const next = Number(event.currentTarget.value);
                if (Number.isFinite(next)) onUpdate({ duration: Math.max(0.05, Math.min(10, next)) });
              }}
              step={0.05}
              type="number"
              value={displayDuration(textMotion.duration)}
            />
            <span className="app-data text-[10px] text-[#f2ede3]/35">SEC</span>
          </div>
          <div aria-label="Motion timing presets" className="grid grid-cols-3 gap-1.5 pt-1">
            {TIMING_PRESETS.map((preset) => {
              const active = Math.abs(textMotion.duration - preset.seconds) < 0.01;
              return (
                <button
                  key={preset.label}
                  aria-pressed={active}
                  className={`h-8 min-w-0 overflow-hidden border px-2 text-[11px] font-medium normal-case tracking-normal transition-colors ${
                    active
                      ? "border-[#ff4f1f] bg-[#ff4f1f] text-[#0b0907]"
                      : "border-[#f2ede3]/12 text-[#f2ede3]/55 hover:border-[#f2ede3]/35 hover:text-[#f2ede3]"
                  }`}
                  disabled={disabled}
                  onClick={() => onUpdate({ duration: preset.seconds })}
                  type="button"
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <span className="block text-[10px] leading-4 text-[#f2ede3]/35">
            Punch for headlines, rise for supporting copy, and word reveal for paced statements.
            Preview and MP4 use the same motion engine.
          </span>
        </div>
      </div>
    </section>
  );
};
