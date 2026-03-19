import { LabeledControl } from "@/components/editor/controls/LabeledControl";
import { TEXT_OVERLAY_STYLE_PRESET_LABELS, type TextOverlay } from "@/lib/editor/types";
import type { getEditableVoxTimelineData } from "../utils";

interface VoxTimelineInspectorProps {
  data: ReturnType<typeof getEditableVoxTimelineData>;
  disabled?: boolean;
  overlay: TextOverlay;
  onUpdateText: (
    updater: (
      current: ReturnType<typeof getEditableVoxTimelineData>,
    ) => ReturnType<typeof getEditableVoxTimelineData>,
  ) => void;
}

export const VoxTimelineInspector = ({
  data,
  disabled,
  overlay,
  onUpdateText,
}: VoxTimelineInspectorProps) => {
  const presetLabel = TEXT_OVERLAY_STYLE_PRESET_LABELS[overlay.stylePreset];

  return (
    <div className="space-y-3 rounded-lg border border-neutral-700/70 bg-neutral-900/45 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
          {presetLabel}
        </p>
        <p className="mt-1 text-[11px] text-neutral-500">
          Pair 3 to 6 chronological events with uploaded image clips arranged in order.
        </p>
      </div>

      <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Kicker">
        <input
          type="text"
          disabled={disabled}
          value={data.kicker}
          onChange={(event) => {
            onUpdateText((current) => ({
              ...current,
              kicker: event.currentTarget.value,
            }));
          }}
          className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
        />
      </LabeledControl>

      <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Headline">
        <textarea
          disabled={disabled}
          value={data.headline}
          onChange={(event) => {
            onUpdateText((current) => ({
              ...current,
              headline: event.currentTarget.value,
            }));
          }}
          className="min-h-16 w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
        />
      </LabeledControl>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-400">Events</span>
          <button
            type="button"
            disabled={disabled || data.events.length >= 6}
            onClick={() => {
              onUpdateText((current) => ({
                ...current,
                events: [
                  ...current.events,
                  {
                    date: `Event ${current.events.length + 1}`,
                    title: "Turning point",
                    caption: "Add one line of historical context.",
                    emphasis: false,
                  },
                ],
              }));
            }}
            className="rounded border border-neutral-600 px-2 py-1 text-[11px] font-medium text-neutral-200 disabled:opacity-40"
          >
            Add Event
          </button>
        </div>

        {data.events.map((event, index) => (
          <div
            key={`${overlay.id}-vox-timeline-event-${index}`}
            className="space-y-2 rounded border border-neutral-700/70 bg-neutral-950/60 p-2"
          >
            <div className="grid grid-cols-[120px_minmax(0,1fr)_auto] gap-2">
              <input
                type="text"
                disabled={disabled}
                value={event.date}
                onChange={(nextEvent) => {
                  onUpdateText((current) => ({
                    ...current,
                    events: current.events.map((currentEvent, currentIndex) =>
                      currentIndex === index
                        ? { ...currentEvent, date: nextEvent.currentTarget.value }
                        : currentEvent,
                    ),
                  }));
                }}
                className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
                placeholder="Date"
              />

              <input
                type="text"
                disabled={disabled}
                value={event.title}
                onChange={(nextEvent) => {
                  onUpdateText((current) => ({
                    ...current,
                    events: current.events.map((currentEvent, currentIndex) =>
                      currentIndex === index
                        ? { ...currentEvent, title: nextEvent.currentTarget.value }
                        : currentEvent,
                    ),
                  }));
                }}
                className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
                placeholder="Title"
              />

              <button
                type="button"
                disabled={disabled || data.events.length <= 3}
                onClick={() => {
                  onUpdateText((current) => ({
                    ...current,
                    events: current.events.filter((_, currentIndex) => currentIndex !== index),
                  }));
                }}
                className="rounded border border-neutral-600 px-2 py-1 text-[11px] font-medium text-neutral-200 disabled:opacity-40"
              >
                Remove
              </button>
            </div>

            <textarea
              disabled={disabled}
              value={event.caption}
              onChange={(nextEvent) => {
                onUpdateText((current) => ({
                  ...current,
                  events: current.events.map((currentEvent, currentIndex) =>
                    currentIndex === index
                      ? { ...currentEvent, caption: nextEvent.currentTarget.value }
                      : currentEvent,
                  ),
                }));
              }}
              className="min-h-16 w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
              placeholder="Caption"
            />

            <label className="flex items-center gap-2 text-[11px] text-neutral-300">
              <input
                type="checkbox"
                disabled={disabled}
                checked={event.emphasis}
                onChange={(nextEvent) => {
                  onUpdateText((current) => ({
                    ...current,
                    events: current.events.map((currentEvent, currentIndex) =>
                      currentIndex === index
                        ? {
                            ...currentEvent,
                            emphasis: nextEvent.currentTarget.checked,
                          }
                        : currentEvent,
                    ),
                  }));
                }}
              />
              Highlight this event
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};
