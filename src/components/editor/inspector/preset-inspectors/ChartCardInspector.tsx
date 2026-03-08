import { LabeledControl } from "@/components/editor/controls/LabeledControl";
import { CHART_CARD_FALLBACK_PALETTE } from "@/lib/editor/chart-card";
import type { TextOverlay } from "@/lib/editor/types";
import type { getEditableChartCardData } from "../utils";
import { parseNumber } from "../utils";

interface ChartCardInspectorProps {
  data: ReturnType<typeof getEditableChartCardData>;
  disabled?: boolean;
  overlay: TextOverlay;
  onUpdateText: (
    updater: (
      current: ReturnType<typeof getEditableChartCardData>,
    ) => ReturnType<typeof getEditableChartCardData>,
  ) => void;
}

export const ChartCardInspector = ({
  data,
  disabled,
  overlay,
  onUpdateText,
}: ChartCardInspectorProps) => {
  return (
    <div className="space-y-3 rounded-lg border border-neutral-700/70 bg-neutral-900/45 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
          Pie Chart Card
        </p>
        <p className="mt-1 text-[11px] text-neutral-500">
          Headline, subtitle, slices, values, and colors stay synced with the chart data.
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

      <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Subtitle">
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-400">Pie Slices</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onUpdateText((current) => ({
                ...current,
                rows: [
                  ...current.rows,
                  {
                    label: `Slice ${current.rows.length + 1}`,
                    value: 10,
                    color:
                      CHART_CARD_FALLBACK_PALETTE[
                        current.rows.length % CHART_CARD_FALLBACK_PALETTE.length
                      ],
                  },
                ],
              }));
            }}
            className="rounded border border-neutral-600 px-2 py-1 text-[11px] font-medium text-neutral-200"
          >
            Add Slice
          </button>
        </div>

        {data.rows.map((row, index) => (
          <div
            key={`${overlay.id}-chart-row-${index}`}
            className="grid grid-cols-[minmax(0,1.6fr)_90px_52px_auto] gap-2"
          >
            <input
              type="text"
              disabled={disabled}
              value={row.label}
              onChange={(event) => {
                onUpdateText((current) => ({
                  ...current,
                  rows: current.rows.map((currentRow, currentIndex) =>
                    currentIndex === index
                      ? { ...currentRow, label: event.currentTarget.value }
                      : currentRow,
                  ),
                }));
              }}
              className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
            />

            <input
              type="number"
              min={0.1}
              step={0.1}
              disabled={disabled}
              value={row.value}
              onChange={(event) => {
                onUpdateText((current) => ({
                  ...current,
                  rows: current.rows.map((currentRow, currentIndex) =>
                    currentIndex === index
                      ? {
                          ...currentRow,
                          value: Math.max(
                            0.1,
                            parseNumber(event.currentTarget.value, currentRow.value),
                          ),
                        }
                      : currentRow,
                  ),
                }));
              }}
              className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
            />

            <input
              type="color"
              disabled={disabled}
              value={row.color}
              onChange={(event) => {
                onUpdateText((current) => ({
                  ...current,
                  rows: current.rows.map((currentRow, currentIndex) =>
                    currentIndex === index
                      ? { ...currentRow, color: event.currentTarget.value }
                      : currentRow,
                  ),
                }));
              }}
              className="h-8 w-full rounded border border-neutral-600 bg-neutral-900"
            />

            <button
              type="button"
              disabled={disabled || data.rows.length <= 2}
              onClick={() => {
                onUpdateText((current) => ({
                  ...current,
                  rows: current.rows.filter((_, currentIndex) => currentIndex !== index),
                }));
              }}
              className="rounded border border-neutral-600 px-2 py-1 text-[11px] font-medium text-neutral-200 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
