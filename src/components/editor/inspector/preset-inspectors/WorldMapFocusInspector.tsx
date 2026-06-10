import { LabeledControl } from "@/components/editor/controls/LabeledControl";
import type { getEditableWorldMapFocusData } from "../utils";

const MAP_INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-neutral-950/70 px-3 py-2.5 text-sm text-neutral-100 outline-none transition focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/12";

interface WorldMapFocusInspectorProps {
  countryOptions: string[];
  data: ReturnType<typeof getEditableWorldMapFocusData>;
  disabled?: boolean;
  selectedCountryName: string;
  onUpdateText: (
    updater: (
      current: ReturnType<typeof getEditableWorldMapFocusData>,
    ) => ReturnType<typeof getEditableWorldMapFocusData>,
  ) => void;
}

export const WorldMapFocusInspector = ({
  countryOptions,
  data,
  disabled,
  selectedCountryName,
  onUpdateText,
}: WorldMapFocusInspectorProps) => {
  return (
    <div className="space-y-4 rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(31,28,22,0.92),rgba(24,22,17,0.82))] p-4">
      <div>
        <p className="app-eyebrow text-[11px] uppercase tracking-[0.22em] text-cyan-200/85">
          World Map Focus
        </p>
        <p className="mt-2 text-[12px] leading-6 text-neutral-400">
          Headline, subhead, and highlighted country stay synced with the atlas scene.
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
          className={`${MAP_INPUT_CLASS} min-h-24 resize-y`}
        />
      </LabeledControl>

      <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Country Focus">
        <select
          disabled={disabled}
          value={selectedCountryName}
          onChange={(event) => {
            onUpdateText((current) => ({
              ...current,
              country: event.currentTarget.value,
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
    </div>
  );
};
