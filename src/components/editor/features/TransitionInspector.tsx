import { Trash2 } from "lucide-react";
import { FeatureIconButton } from "./FeatureIconButton";

export const TRANSITION_KINDS = ["fade", "slide", "wipe"] as const;
export const TRANSITION_DIRECTIONS = ["left", "right", "up", "down"] as const;
export const TRANSITION_EASINGS = [
  "linear",
  "ease-in",
  "ease-out",
] as const;

export type TransitionKind = (typeof TRANSITION_KINDS)[number];
export type TransitionDirection = (typeof TRANSITION_DIRECTIONS)[number];
export type TransitionEasing = (typeof TRANSITION_EASINGS)[number];

/** Deliberately structural: the inspector can sit above any timeline model. */
export interface TransitionInspectorValue {
  kind: TransitionKind;
  direction: TransitionDirection;
  easing: TransitionEasing;
  duration: number;
}

export interface TransitionInspectorProps {
  transition: TransitionInspectorValue;
  disabled?: boolean;
  onUpdate: (patch: Partial<TransitionInspectorValue>) => void;
  onRemove?: () => void;
}

const controlClassName =
  "h-9 w-full border border-[#f2ede3]/15 bg-[#0f0d0a] px-2.5 text-xs text-[#f2ede3] outline-none transition-colors hover:border-[#f2ede3]/35 focus-visible:border-[#ff4f1f] focus-visible:ring-1 focus-visible:ring-[#ff4f1f] disabled:cursor-not-allowed disabled:opacity-45";
const labelClassName =
  "app-eyebrow text-[9px] uppercase tracking-[0.18em] text-[#f2ede3]/45";

const displayDuration = (seconds: number): number => Number(seconds.toFixed(2));

export const TransitionInspector = ({
  transition,
  disabled = false,
  onUpdate,
  onRemove,
}: TransitionInspectorProps) => {
  const headingId = "transition-inspector-heading";

  return (
    <section
      aria-labelledby={headingId}
      className="border-y border-[#f2ede3]/12 bg-[#15120e] text-[#f2ede3]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-[#f2ede3]/10 px-3 py-2.5">
        <div>
          <p className="app-eyebrow text-[9px] uppercase tracking-[0.2em] text-[#ff4f1f]">
            Edit / transition
          </p>
          <h2 id={headingId} className="mt-0.5 text-sm font-semibold tracking-[-0.01em]">
            Transition
          </h2>
        </div>
        {onRemove ? (
          <FeatureIconButton
            disabled={disabled}
            icon={Trash2}
            label="Remove transition"
            onClick={onRemove}
            className="border-[#ff4f1f]/35 text-[#ff9a7d]"
          />
        ) : null}
      </header>

      <div className="grid gap-x-3 gap-y-3 px-3 py-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className={labelClassName}>Kind</span>
          <select
            aria-label="Transition kind"
            className={controlClassName}
            disabled={disabled}
            value={transition.kind}
            onChange={(event) =>
              onUpdate({ kind: event.currentTarget.value as TransitionKind })
            }
          >
            {TRANSITION_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className={labelClassName}>Direction</span>
          <select
            aria-label="Transition direction"
            className={controlClassName}
            disabled={disabled || transition.kind === "fade"}
            value={transition.direction}
            onChange={(event) =>
              onUpdate({ direction: event.currentTarget.value as TransitionDirection })
            }
          >
            {TRANSITION_DIRECTIONS.map((direction) => (
              <option key={direction} value={direction}>
                {direction}
              </option>
            ))}
          </select>
          {transition.kind === "fade" ? (
            <span className="block text-[10px] text-[#f2ede3]/30">Not used by fade</span>
          ) : null}
        </label>

        <label className="space-y-1">
          <span className={labelClassName}>Easing</span>
          <select
            aria-label="Transition easing"
            className={controlClassName}
            disabled={disabled}
            value={transition.easing}
            onChange={(event) =>
              onUpdate({ easing: event.currentTarget.value as TransitionEasing })
            }
          >
            {TRANSITION_EASINGS.map((easing) => (
              <option key={easing} value={easing}>
                {easing}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className={labelClassName}>Duration (s)</span>
          <div className="flex h-9 items-center gap-2 border border-[#f2ede3]/15 bg-[#0f0d0a] px-2.5 focus-within:border-[#ff4f1f] focus-within:ring-1 focus-within:ring-[#ff4f1f]">
            <input
              aria-label="Transition duration"
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
              value={displayDuration(transition.duration)}
            />
            <span className="app-data text-[10px] text-[#f2ede3]/35">SEC</span>
          </div>
        </label>
      </div>
    </section>
  );
};
