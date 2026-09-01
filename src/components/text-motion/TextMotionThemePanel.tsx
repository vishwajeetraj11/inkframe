import type { TextMotionProject } from "@/lib/text-motion/types";

interface TextMotionThemePanelProps {
  theme: TextMotionProject["theme"];
  onChange: (patch: Partial<TextMotionProject["theme"]>) => void;
}

export const TextMotionThemePanel = ({
  theme,
  onChange,
}: TextMotionThemePanelProps) => {
  const colors = [
    { key: "backgroundFrom", label: "Start", value: theme.backgroundFrom },
    { key: "backgroundTo", label: "End", value: theme.backgroundTo },
    { key: "textColor", label: "Type", value: theme.textColor },
    { key: "accentColor", label: "Accent", value: theme.accentColor },
  ] as const;

  return (
    <section aria-labelledby="motion-palette-heading" className="py-5 xl:pr-6">
      <div>
        <h3 id="motion-palette-heading" className="app-eyebrow text-[10px] uppercase tracking-[0.2em] text-[#f2ede3]/45">
          Frame palette
        </h3>
        <p className="mt-1 text-xs text-[#f2ede3]/48">Color updates appear in the monitor instantly.</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
        {colors.map((color) => (
          <label key={color.key} className="group flex min-h-11 cursor-pointer items-center gap-2">
            <span className="relative h-9 w-9 shrink-0 overflow-hidden border border-[#f2ede3]/20 group-focus-within:ring-2 group-focus-within:ring-[#ff4f1f]">
              <span className="absolute inset-1" style={{ backgroundColor: color.value }} aria-hidden="true" />
              <input
                type="color"
                value={color.value}
                aria-label={`${color.label} color`}
                onChange={(event) => onChange({ [color.key]: event.currentTarget.value })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-[#f2ede3]/72">{color.label}</span>
              <span className="app-data block truncate text-[9px] uppercase text-[#f2ede3]/35">{color.value}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
};
