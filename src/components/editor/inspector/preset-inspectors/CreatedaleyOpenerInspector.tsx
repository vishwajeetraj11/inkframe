import { LabeledControl } from "@/components/editor/controls/LabeledControl";
import {
  CREATEDALEY_OPENER_TEXTURE_LABELS,
  CREATEDALEY_OPENER_TEXTURES,
} from "@/lib/editor/types";
import type { TextOverlay } from "@/lib/editor/types";
import type { getEditableCreatedaleyOpenerData } from "../utils";

interface CreatedaleyOpenerInspectorProps {
  data: ReturnType<typeof getEditableCreatedaleyOpenerData>;
  disabled?: boolean;
  overlay: TextOverlay;
  onUpdateOverlay: (patch: Partial<Omit<TextOverlay, "id">>) => void;
  onUpdateText: (
    updater: (
      current: ReturnType<typeof getEditableCreatedaleyOpenerData>,
    ) => ReturnType<typeof getEditableCreatedaleyOpenerData>,
  ) => void;
}

export const CreatedaleyOpenerInspector = ({
  data,
  disabled,
  overlay,
  onUpdateOverlay,
  onUpdateText,
}: CreatedaleyOpenerInspectorProps) => {
  return (
    <div className="space-y-3 rounded-lg border border-neutral-700/70 bg-neutral-900/45 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
          Createdaley Opener
        </p>
        <p className="mt-1 text-[11px] text-neutral-500">
          Wordmark, pronunciation, definition label, and body copy stay synced with the opener layout.
        </p>
      </div>

      <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Wordmark">
        <input
          type="text"
          disabled={disabled}
          value={data.wordmark}
          onChange={(event) => {
            onUpdateText((current) => ({
              ...current,
              wordmark: event.currentTarget.value,
            }));
          }}
          className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
        />
      </LabeledControl>

      <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Pronunciation">
        <input
          type="text"
          disabled={disabled}
          value={data.pronunciation}
          onChange={(event) => {
            onUpdateText((current) => ({
              ...current,
              pronunciation: event.currentTarget.value,
            }));
          }}
          className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
        />
      </LabeledControl>

      <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Part of Speech">
        <input
          type="text"
          disabled={disabled}
          value={data.partOfSpeech}
          onChange={(event) => {
            onUpdateText((current) => ({
              ...current,
              partOfSpeech: event.currentTarget.value,
            }));
          }}
          className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
        />
      </LabeledControl>

      <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Texture">
        <select
          disabled={disabled}
          value={overlay.createdaleyTexture}
          onChange={(event) => {
            onUpdateOverlay({
              createdaleyTexture: event.currentTarget.value as TextOverlay["createdaleyTexture"],
            });
          }}
          className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
        >
          {CREATEDALEY_OPENER_TEXTURES.map((texture) => (
            <option key={texture} value={texture}>
              {CREATEDALEY_OPENER_TEXTURE_LABELS[texture]}
            </option>
          ))}
        </select>
      </LabeledControl>

      <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Definition">
        <textarea
          disabled={disabled}
          value={data.definition}
          onChange={(event) => {
            onUpdateText((current) => ({
              ...current,
              definition: event.currentTarget.value,
            }));
          }}
          className="min-h-20 w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
        />
      </LabeledControl>
    </div>
  );
};
