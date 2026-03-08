import { LabeledControl } from "@/components/editor/controls/LabeledControl";
import type { getEditableWorldMapFocusData } from "../utils";

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
    <div className="space-y-3 rounded-lg border border-neutral-700/70 bg-neutral-900/45 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
          World Map Focus
        </p>
        <p className="mt-1 text-[11px] text-neutral-500">
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
          className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
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
          className="min-h-16 w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
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
          className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
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
