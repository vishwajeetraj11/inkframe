import { LabeledControl } from "@/components/editor/controls/LabeledControl";
import { TEXT_OVERLAY_STYLE_PRESET_LABELS, type TextOverlay } from "@/lib/editor/types";
import type { getEditableRegionalMapFocusData } from "../utils";

const MAP_INPUT_CLASS =
  "min-h-9 w-full rounded-lg border border-white/10 bg-neutral-950/70 px-2.5 py-1.5 text-sm text-neutral-100 outline-none transition focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/12";

interface RegionalMapFocusInspectorProps {
  countryOptions: string[];
  data: ReturnType<typeof getEditableRegionalMapFocusData>;
  disabled?: boolean;
  overlay: TextOverlay;
  primaryCountryName: string;
  secondaryCountryName: string;
  onUpdateText: (
    updater: (
      current: ReturnType<typeof getEditableRegionalMapFocusData>,
    ) => ReturnType<typeof getEditableRegionalMapFocusData>,
  ) => void;
}

export const RegionalMapFocusInspector = ({
  countryOptions,
  data,
  disabled,
  overlay,
  primaryCountryName,
  secondaryCountryName,
  onUpdateText,
}: RegionalMapFocusInspectorProps) => {
  const presetLabel = TEXT_OVERLAY_STYLE_PRESET_LABELS[overlay.stylePreset];

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(31,28,22,0.92),rgba(24,22,17,0.82))] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="app-eyebrow text-[11px] uppercase tracking-[0.22em] text-cyan-200/85">
            {presetLabel}
          </p>
          <p className="mt-2 max-w-xl text-[12px] leading-6 text-neutral-400">
            Build a regional atlas focus with one primary country, an optional neighboring country,
            and either country or shared-border emphasis.
          </p>
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
          Atlas Preset
        </span>
      </div>

      <section className="space-y-3">
        <div>
          <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-neutral-500">
            Story Copy
          </p>
        </div>

        <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Headline">
          <input
            type="text"
            disabled={disabled}
            value={data.headline}
            onChange={(event) => {
              onUpdateText((current) => ({
                ...current,
                headline: event.currentTarget.value,
              }));
            }}
            className={MAP_INPUT_CLASS}
          />
        </LabeledControl>

        <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Subhead">
          <textarea
            disabled={disabled}
            value={data.subhead}
            onChange={(event) => {
              onUpdateText((current) => ({
                ...current,
                subhead: event.currentTarget.value,
              }));
            }}
            className={`${MAP_INPUT_CLASS} min-h-13 resize-y`}
          />
        </LabeledControl>
      </section>

      <section className="space-y-3">
        <div>
          <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-neutral-500">
            Geography
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Primary Country">
            <select
              disabled={disabled}
              value={primaryCountryName}
              onChange={(event) => {
                onUpdateText((current) => ({
                  ...current,
                  primaryCountry: event.currentTarget.value,
                }));
              }}
              className={MAP_INPUT_CLASS}
            >
              {countryOptions.map((countryName) => (
                <option key={countryName} value={countryName}>
                  {countryName}
                </option>
              ))}
            </select>
          </LabeledControl>

          <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Secondary Country">
            <select
              disabled={disabled}
              value={secondaryCountryName}
              onChange={(event) => {
                onUpdateText((current) => ({
                  ...current,
                  secondaryCountry: event.currentTarget.value,
                }));
              }}
              className={MAP_INPUT_CLASS}
            >
              <option value="">None</option>
              {countryOptions.map((countryName) => (
                <option key={countryName} value={countryName}>
                  {countryName}
                </option>
              ))}
            </select>
          </LabeledControl>
        </div>

        <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Focus Mode">
          <select
            disabled={disabled}
            value={data.focusMode}
            onChange={(event) => {
              onUpdateText((current) => ({
                ...current,
                focusMode: event.currentTarget.value as typeof current.focusMode,
              }));
            }}
            className={MAP_INPUT_CLASS}
          >
            <option value="country">Country</option>
            <option value="border">Border</option>
          </select>
        </LabeledControl>
      </section>

      <section className="space-y-3">
        <div>
          <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-neutral-500">
            Annotation
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
          <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Label">
            <input
              type="text"
              disabled={disabled}
              value={data.label}
              onChange={(event) => {
                onUpdateText((current) => ({
                  ...current,
                  label: event.currentTarget.value,
                }));
              }}
              className={MAP_INPUT_CLASS}
            />
          </LabeledControl>

          <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Year">
            <input
              type="text"
              disabled={disabled}
              value={data.year}
              onChange={(event) => {
                onUpdateText((current) => ({
                  ...current,
                  year: event.currentTarget.value,
                }));
              }}
              className={MAP_INPUT_CLASS}
            />
          </LabeledControl>
        </div>
      </section>
    </div>
  );
};
