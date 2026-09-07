import { InspectorCard } from "@/components/editor/controls/InspectorCard";
import { LabeledControl } from "@/components/editor/controls/LabeledControl";
import { TextMotionInspector } from "@/components/editor/features/TextMotionInspector";
import { FPS } from "@/lib/editor/constants";
import type {
  TextOverlay,
  TextOverlayAnimationKind,
} from "@/lib/editor/types";
import { TEXT_OVERLAY_FONT_FAMILIES, TEXT_OVERLAY_FONT_STYLES } from "@/lib/editor/types";
import { parseNumber } from "./utils";

const INSPECTOR_INPUT_CLASS =
  "min-h-9 w-full rounded-lg border border-white/10 bg-neutral-950/70 px-2.5 py-1.5 text-xs text-neutral-100 outline-none transition focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/12";
const INSPECTOR_COLOR_INPUT_CLASS =
  "h-9 w-full rounded-lg border border-white/10 bg-neutral-950/70 p-1 outline-none transition focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/12";

const TEXT_SIZE_PRESETS = [
  { label: "Caption", previewSize: "0.75rem", size: 32 },
  { label: "Body", previewSize: "0.875rem", size: 48 },
  { label: "Title", previewSize: "1rem", size: 64 },
  { label: "Hero", previewSize: "1.25rem", size: 88 },
] as const;

const TEXT_OVERLAY_FONT_OPTIONS: Record<
  TextOverlay["fontFamily"],
  { label: string; stack: string }
> = {
  sans: {
    label: "Condensed Sans",
    stack: 'var(--font-condensed), "Barlow Condensed", "Arial Narrow", sans-serif',
  },
  modern: {
    label: "Modern Sans",
    stack: 'var(--font-modern), "Sora", "Trebuchet MS", sans-serif',
  },
  serif: {
    label: "Editorial Serif",
    stack: 'var(--font-cormorant-garamond), "Cormorant Garamond", Georgia, serif',
  },
  cursive: {
    label: "Handwritten",
    stack: 'var(--font-cormorant-garamond), "Cormorant Garamond", Georgia, cursive',
  },
  mono: {
    label: "Mono",
    stack: 'var(--font-mono), "IBM Plex Mono", "SFMono-Regular", monospace',
  },
  display: {
    label: "Display",
    stack: 'var(--font-display), "Barlow Condensed", "Arial Narrow", sans-serif',
  },
  editorial: {
    label: "Editorial Serif",
    stack: 'var(--font-serif), "Source Serif 4", Georgia, serif',
  },
  rounded: {
    label: "Rounded Sans",
    stack: 'var(--font-sans), "Plus Jakarta Sans", "Segoe UI", sans-serif',
  },
};

interface TextOverlayInspectorProps {
  disabled?: boolean;
  onUpdateText: (overlayId: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  overlay: TextOverlay;
}

export const TextOverlayInspector = ({
  disabled,
  onUpdateText,
  overlay,
}: TextOverlayInspectorProps) => {
  return (
    <InspectorCard title="Text Overlay">
      <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Text">
        <textarea
          disabled={disabled}
          value={overlay.text}
          onChange={(event) => onUpdateText(overlay.id, { text: event.currentTarget.value })}
          className={`${INSPECTOR_INPUT_CLASS} min-h-12`}
        />
      </LabeledControl>

      <div className="editor-inspector-layout">
          <section className="space-y-3">
            <div>
              <p className="app-eyebrow text-[9px] text-neutral-500">
                Placement
              </p>
              <p className="mt-1 text-[10px] text-neutral-500">
                Position the overlay on the canvas and tune scale.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px] text-neutral-200">
              <LabeledControl label="X (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  disabled={disabled}
                  value={overlay.x}
                  onChange={(event) => {
                    onUpdateText(overlay.id, {
                      x: parseNumber(event.currentTarget.value, overlay.x),
                    });
                  }}
                  className={INSPECTOR_INPUT_CLASS}
                />
              </LabeledControl>

              <LabeledControl label="Y (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  disabled={disabled}
                  value={overlay.y}
                  onChange={(event) => {
                    onUpdateText(overlay.id, {
                      y: parseNumber(event.currentTarget.value, overlay.y),
                    });
                  }}
                  className={INSPECTOR_INPUT_CLASS}
                />
              </LabeledControl>

              <LabeledControl label="Font Size">
                <input
                  type="number"
                  min={12}
                  max={200}
                  step={1}
                  disabled={disabled}
                  value={overlay.fontSize}
                  onChange={(event) => {
                    onUpdateText(overlay.id, {
                      fontSize: parseNumber(event.currentTarget.value, overlay.fontSize),
                    });
                  }}
                  className={INSPECTOR_INPUT_CLASS}
                />
              </LabeledControl>

              <LabeledControl label="Color">
                <input
                  type="color"
                  disabled={disabled}
                  value={overlay.color}
                  onChange={(event) => {
                    onUpdateText(overlay.id, {
                      color: event.currentTarget.value,
                    });
                  }}
                  className={INSPECTOR_COLOR_INPUT_CLASS}
                />
              </LabeledControl>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <p className="app-eyebrow text-[9px] text-neutral-500">
                Typography
              </p>
              <p className="mt-1 text-[10px] text-neutral-500">
                Control the family, weight, style, and alignment.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px] text-neutral-200">
              <LabeledControl label="Font Family">
                <select
                  disabled={disabled}
                  style={{
                    fontFamily: TEXT_OVERLAY_FONT_OPTIONS[overlay.fontFamily].stack,
                  }}
                  value={overlay.fontFamily}
                  onChange={(event) => {
                    onUpdateText(overlay.id, {
                      fontFamily: event.currentTarget.value as TextOverlay["fontFamily"],
                    });
                  }}
                  className={INSPECTOR_INPUT_CLASS}
                >
                  {TEXT_OVERLAY_FONT_FAMILIES.map((fontFamily) => (
                    <option
                      key={fontFamily}
                      style={{ fontFamily: TEXT_OVERLAY_FONT_OPTIONS[fontFamily].stack }}
                      value={fontFamily}
                    >
                      {TEXT_OVERLAY_FONT_OPTIONS[fontFamily].label}
                    </option>
                  ))}
                </select>
              </LabeledControl>

              <LabeledControl label="Font Weight">
                <input
                  type="number"
                  min={100}
                  max={900}
                  step={100}
                  disabled={disabled}
                  value={overlay.fontWeight}
                  onChange={(event) => {
                    onUpdateText(overlay.id, {
                      fontWeight: parseNumber(event.currentTarget.value, overlay.fontWeight),
                    });
                  }}
                  className={INSPECTOR_INPUT_CLASS}
                />
              </LabeledControl>

              <LabeledControl label="Font Style">
                <select
                  disabled={disabled}
                  value={overlay.fontStyle}
                  onChange={(event) => {
                    onUpdateText(overlay.id, {
                      fontStyle: event.currentTarget.value as TextOverlay["fontStyle"],
                    });
                  }}
                  className={INSPECTOR_INPUT_CLASS}
                >
                  {TEXT_OVERLAY_FONT_STYLES.map((fontStyle) => (
                    <option key={fontStyle} value={fontStyle}>
                      {fontStyle}
                    </option>
                  ))}
                </select>
              </LabeledControl>

              <LabeledControl label="Alignment">
                <select
                  disabled={disabled}
                  value={overlay.textAlign ?? "center"}
                  onChange={(event) => {
                    onUpdateText(overlay.id, {
                      textAlign: event.currentTarget.value as TextOverlay["textAlign"],
                    });
                  }}
                  className={INSPECTOR_INPUT_CLASS}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </LabeledControl>

            </div>

            <div>
              <p className="app-eyebrow mb-1.5 text-[9px] text-neutral-500">
                Type scale
              </p>
              <div
                aria-label="Typography size presets"
                className="grid grid-cols-4 gap-1.5"
                role="group"
              >
                {TEXT_SIZE_PRESETS.map((preset) => {
                  const active = overlay.fontSize === preset.size;
                  return (
                    <button
                      key={preset.label}
                      aria-label={`${preset.label} size ${preset.size}`}
                      aria-pressed={active}
                      className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-md border px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f]/45 ${
                        active
                          ? "border-[#ff4f1f] bg-[#ff4f1f] text-[#0b0907]"
                          : "border-white/10 bg-neutral-950/60 text-neutral-500 hover:border-white/25 hover:text-neutral-200"
                      }`}
                      disabled={disabled}
                      onClick={() => onUpdateText(overlay.id, { fontSize: preset.size })}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="block max-w-full truncate font-semibold leading-none"
                        style={{ fontSize: preset.previewSize }}
                      >
                        Aa
                      </span>
                      <span className="text-[8px] font-semibold uppercase leading-none tracking-[0.08em]">
                        {preset.label}
                      </span>
                      <span aria-hidden="true" className="text-[8px] leading-none opacity-70">
                        {preset.size}px
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[10px] leading-4 text-neutral-500">
                Keep essential reel copy at Body or larger; use Caption for supporting details only.
              </p>
            </div>
          </section>
      </div>

      <TextMotionInspector
        disabled={disabled}
        textMotion={{
          in: overlay.animation?.in ?? "none",
          out: overlay.animation?.out ?? "none",
          duration: (overlay.animation?.durationFrames ?? 15) / FPS,
        }}
        onReset={() => onUpdateText(overlay.id, { animation: undefined })}
        onUpdate={(patch) => {
          const current = overlay.animation ?? { durationFrames: 15 };
          onUpdateText(overlay.id, {
            animation: {
              ...(patch.in !== undefined
                ? patch.in !== "none"
                  ? { in: patch.in as TextOverlayAnimationKind }
                  : {}
                : current.in
                  ? { in: current.in }
                  : {}),
              ...(patch.out !== undefined
                ? patch.out !== "none"
                  ? { out: patch.out as TextOverlayAnimationKind }
                  : {}
                : current.out
                  ? { out: current.out }
                  : {}),
              durationFrames:
                patch.duration !== undefined
                  ? Math.max(1, Math.round(patch.duration * FPS))
                  : current.durationFrames,
            },
          });
        }}
      />
    </InspectorCard>
  );
};
