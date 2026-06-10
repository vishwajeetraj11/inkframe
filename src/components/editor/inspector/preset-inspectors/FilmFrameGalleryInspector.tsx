import { LabeledControl } from "@/components/editor/controls/LabeledControl";
import { TEXT_OVERLAY_STYLE_PRESET_LABELS, type TextOverlay } from "@/lib/editor/types";
import type { getEditableFilmFrameGalleryData } from "../utils";

const FILM_INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-neutral-950/70 px-3 py-2.5 text-sm text-neutral-100 outline-none transition focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/12";

interface FilmFrameGalleryInspectorProps {
  data: ReturnType<typeof getEditableFilmFrameGalleryData>;
  disabled?: boolean;
  overlay: TextOverlay;
  onUpdateText: (
    updater: (
      current: ReturnType<typeof getEditableFilmFrameGalleryData>,
    ) => ReturnType<typeof getEditableFilmFrameGalleryData>,
  ) => void;
}

export const FilmFrameGalleryInspector = ({
  data,
  disabled,
  overlay,
  onUpdateText,
}: FilmFrameGalleryInspectorProps) => {
  const presetLabel = TEXT_OVERLAY_STYLE_PRESET_LABELS[overlay.stylePreset];

  return (
    <div className="space-y-5 rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,24,19,0.94),rgba(11,10,8,0.88))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="app-eyebrow text-[11px] uppercase tracking-[0.22em] text-amber-100/85">
            {presetLabel}
          </p>
          <p className="mt-2 max-w-xl text-[12px] leading-6 text-neutral-400">
            Build a framed image sequence with an editorial title block and optional location and year.
          </p>
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
          Image Sequence
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
            className={FILM_INPUT_CLASS}
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
            className={`${FILM_INPUT_CLASS} min-h-24 resize-y`}
          />
        </LabeledControl>
      </section>

      <section className="space-y-3">
        <div>
          <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-neutral-500">
            Metadata
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
          <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Location">
            <input
              type="text"
              disabled={disabled}
              value={data.location}
              onChange={(event) => {
                onUpdateText((current) => ({
                  ...current,
                  location: event.currentTarget.value,
                }));
              }}
              className={FILM_INPUT_CLASS}
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
              className={FILM_INPUT_CLASS}
            />
          </LabeledControl>
        </div>
      </section>
    </div>
  );
};
