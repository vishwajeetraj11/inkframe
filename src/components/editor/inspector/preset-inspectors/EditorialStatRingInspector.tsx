import { useState } from "react";
import { LabeledControl } from "@/components/editor/controls/LabeledControl";
import { EDITORIAL_STAT_RING_DEFAULT_COLOR } from "@/lib/editor/editorial-stat-ring";
import type { getEditableEditorialStatRingData } from "../utils";
import { parseNumber } from "../utils";

interface EditorialStatRingInspectorProps {
  data: ReturnType<typeof getEditableEditorialStatRingData>;
  disabled?: boolean;
  onUpdateText: (
    updater: (
      current: ReturnType<typeof getEditableEditorialStatRingData>,
    ) => ReturnType<typeof getEditableEditorialStatRingData>,
  ) => void;
}

export const EditorialStatRingInspector = ({
  data,
  disabled,
  onUpdateText,
}: EditorialStatRingInspectorProps) => {
  const [valueInput, setValueInput] = useState<string | null>(null);

  return (
    <div className="space-y-3 rounded-lg border border-neutral-700/70 bg-neutral-900/45 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
          Stat Ring Card
        </p>
        <p className="mt-1 text-[11px] text-neutral-500">
          Headline, highlight, source line, stat value, suffix, and accent color stay synced with the ring card.
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

      <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Highlighted Phrase">
        <input
          type="text"
          disabled={disabled}
          value={data.highlight ?? ""}
          onChange={(event) => {
            onUpdateText((current) => ({
              ...current,
              highlight: event.currentTarget.value.trim() || null,
            }));
          }}
          className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
        />
      </LabeledControl>

      <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Source Line">
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

      <div className="grid grid-cols-3 gap-2">
        <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Value">
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            disabled={disabled}
            value={valueInput ?? `${data.value}`}
            onFocus={() => {
              setValueInput(`${data.value}`);
            }}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setValueInput(nextValue);
              onUpdateText((current) => ({
                ...current,
                value:
                  nextValue.trim().length === 0
                    ? 0
                    : Math.max(0, Math.min(100, parseNumber(nextValue, current.value))),
              }));
            }}
            onBlur={() => {
              setValueInput(null);
            }}
            className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
          />
        </LabeledControl>

        <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Suffix">
          <input
            type="text"
            disabled={disabled}
            value={data.suffix}
            onChange={(event) => {
              onUpdateText((current) => ({
                ...current,
                suffix: event.currentTarget.value,
              }));
            }}
            className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
          />
        </LabeledControl>

        <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Accent">
          <input
            type="color"
            disabled={disabled}
            value={data.color || EDITORIAL_STAT_RING_DEFAULT_COLOR}
            onChange={(event) => {
              onUpdateText((current) => ({
                ...current,
                color: event.currentTarget.value,
              }));
            }}
            className="h-8 w-full rounded border border-neutral-600 bg-neutral-900"
          />
        </LabeledControl>
      </div>
    </div>
  );
};
