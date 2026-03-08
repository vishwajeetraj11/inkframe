import type { TextMotionProject } from "@/lib/text-motion/types";

interface TextMotionThemePanelProps {
  theme: TextMotionProject["theme"];
  onChange: (patch: Partial<TextMotionProject["theme"]>) => void;
}

export const TextMotionThemePanel = ({
  theme,
  onChange,
}: TextMotionThemePanelProps) => {
  return (
    <div className="space-y-2 rounded-xl border border-slate-700/70 bg-slate-950/50 p-3">
      <p className="app-panel-label text-xs font-semibold uppercase tracking-wide text-slate-300">
        Theme
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="space-y-1">
          <span className="text-slate-400">Background From</span>
          <input
            type="color"
            value={theme.backgroundFrom}
            onChange={(event) => onChange({ backgroundFrom: event.currentTarget.value })}
            className="h-9 w-full rounded border border-slate-700 bg-slate-900"
          />
        </label>

        <label className="space-y-1">
          <span className="text-slate-400">Background To</span>
          <input
            type="color"
            value={theme.backgroundTo}
            onChange={(event) => onChange({ backgroundTo: event.currentTarget.value })}
            className="h-9 w-full rounded border border-slate-700 bg-slate-900"
          />
        </label>

        <label className="space-y-1">
          <span className="text-slate-400">Text Color</span>
          <input
            type="color"
            value={theme.textColor}
            onChange={(event) => onChange({ textColor: event.currentTarget.value })}
            className="h-9 w-full rounded border border-slate-700 bg-slate-900"
          />
        </label>

        <label className="space-y-1">
          <span className="text-slate-400">Accent Color</span>
          <input
            type="color"
            value={theme.accentColor}
            onChange={(event) => onChange({ accentColor: event.currentTarget.value })}
            className="h-9 w-full rounded border border-slate-700 bg-slate-900"
          />
        </label>
      </div>
    </div>
  );
};
