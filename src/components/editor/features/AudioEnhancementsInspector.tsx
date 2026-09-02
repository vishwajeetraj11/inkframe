import { Trash2, Volume2, VolumeX } from "lucide-react";
import { FeatureIconButton } from "./FeatureIconButton";

/** Structural audio controls; values are seconds except volume (0–1). */
export interface AudioEnhancementsInspectorValue {
  volume: number;
  fadeIn: number;
  fadeOut: number;
  muted: boolean;
}

export interface AudioEnhancementsInspectorProps {
  audio: AudioEnhancementsInspectorValue;
  disabled?: boolean;
  onUpdate: (patch: Partial<AudioEnhancementsInspectorValue>) => void;
  onDelete?: () => void;
}

const labelClassName =
  "app-eyebrow text-[9px] uppercase tracking-[0.18em] text-[#f2ede3]/45";
const numberClassName =
  "app-data h-9 w-full border border-[#f2ede3]/15 bg-[#0f0d0a] px-2.5 text-xs text-[#f2ede3] outline-none transition-colors hover:border-[#f2ede3]/35 focus-visible:border-[#ff4f1f] focus-visible:ring-1 focus-visible:ring-[#ff4f1f] disabled:cursor-not-allowed disabled:opacity-45";

export const AudioEnhancementsInspector = ({
  audio,
  disabled = false,
  onUpdate,
  onDelete,
}: AudioEnhancementsInspectorProps) => {
  const headingId = "audio-enhancements-inspector-heading";
  const updateSeconds = (field: "fadeIn" | "fadeOut", value: string) => {
    const next = Number(value);
    if (Number.isFinite(next)) onUpdate({ [field]: Math.max(0, Math.min(10, next)) });
  };

  return (
    <section
      aria-labelledby={headingId}
      className="border-y border-[#f2ede3]/12 bg-[#15120e] text-[#f2ede3]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-[#f2ede3]/10 px-3 py-2.5">
        <div>
          <p className="app-eyebrow text-[9px] uppercase tracking-[0.2em] text-[#ff4f1f]">
            Mix / enhancements
          </p>
          <h2 id={headingId} className="mt-0.5 text-sm font-semibold tracking-[-0.01em]">
            Audio
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <FeatureIconButton
            aria-pressed={audio.muted}
            disabled={disabled}
            icon={audio.muted ? VolumeX : Volume2}
            label={audio.muted ? "Unmute audio" : "Mute audio"}
            onClick={() => onUpdate({ muted: !audio.muted })}
            className={audio.muted ? "border-[#ff4f1f] bg-[#ff4f1f] text-[#0f0d0a]" : ""}
          />
          {onDelete ? (
            <FeatureIconButton
              disabled={disabled}
              icon={Trash2}
              label="Delete audio"
              onClick={onDelete}
              className="border-[#ff4f1f]/35 text-[#ff9a7d]"
            />
          ) : null}
        </div>
      </header>

      <div className="space-y-3 px-3 py-3">
        <label className="block space-y-1">
          <span className="flex items-center justify-between">
            <span className={labelClassName}>Volume</span>
            <span className="app-data text-[10px] text-[#f2ede3]/45">
              {Math.round(audio.volume * 100)}%
            </span>
          </span>
          <input
            aria-label="Audio volume"
            className="h-4 w-full accent-[#ff4f1f]"
            disabled={disabled || audio.muted}
            max={1}
            min={0}
            onChange={(event) => onUpdate({ volume: Number(event.currentTarget.value) })}
            step={0.01}
            type="range"
            value={audio.volume}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className={labelClassName}>Fade in (s)</span>
            <input
              aria-label="Audio fade in"
              className={numberClassName}
              disabled={disabled}
              max={10}
              min={0}
              onChange={(event) => updateSeconds("fadeIn", event.currentTarget.value)}
              step={0.05}
              type="number"
              value={audio.fadeIn}
            />
          </label>
          <label className="space-y-1">
            <span className={labelClassName}>Fade out (s)</span>
            <input
              aria-label="Audio fade out"
              className={numberClassName}
              disabled={disabled}
              max={10}
              min={0}
              onChange={(event) => updateSeconds("fadeOut", event.currentTarget.value)}
              step={0.05}
              type="number"
              value={audio.fadeOut}
            />
          </label>
        </div>
      </div>
    </section>
  );
};
