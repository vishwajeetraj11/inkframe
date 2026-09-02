import { InspectorCard } from "@/components/editor/controls/InspectorCard";
import { LabeledControl } from "@/components/editor/controls/LabeledControl";
import type { Clip } from "@/lib/editor/types";
import { framesToSeconds, parseNumber, secondsToFrames } from "./utils";

interface ClipInspectorProps {
  clip: Clip;
  disabled?: boolean;
  onUpdateClip: (clipId: string, patch: Partial<Omit<Clip, "id" | "assetId" | "kind">>) => void;
  onDetachAudio?: (clipId: string) => void;
}

export const ClipInspector = ({
  clip,
  disabled,
  onUpdateClip,
  onDetachAudio,
}: ClipInspectorProps) => {
  return (
    <InspectorCard title="Clip">
      <div className="grid grid-cols-2 gap-2 text-xs text-neutral-200">
        <LabeledControl label="Trim Start (s)">
          <input
            type="number"
            min={0}
            step={0.1}
            disabled={disabled}
            value={framesToSeconds(clip.trimStartFrame)}
            onChange={(event) => {
              const seconds = parseNumber(
                event.currentTarget.value,
                framesToSeconds(clip.trimStartFrame),
              );

              onUpdateClip(clip.id, {
                trimStartFrame: Math.max(0, secondsToFrames(seconds)),
              });
            }}
            className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
          />
        </LabeledControl>

        <LabeledControl label="Trim End (s)">
          <input
            type="number"
            min={0.1}
            step={0.1}
            disabled={disabled}
            value={framesToSeconds(clip.trimEndFrame)}
            onChange={(event) => {
              const seconds = parseNumber(
                event.currentTarget.value,
                framesToSeconds(clip.trimEndFrame),
              );

              onUpdateClip(clip.id, {
                trimEndFrame: Math.max(1, secondsToFrames(seconds)),
              });
            }}
            className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
          />
        </LabeledControl>
      </div>

      {clip.kind === "video" ? (
        <div className="border-t border-white/10 pt-3">
          <div className="mb-2 flex items-center justify-between text-[10px] text-neutral-400">
            <span className="app-eyebrow uppercase tracking-[0.16em]">Clip audio</span>
            <span className="app-data">{Math.round(clip.volume * 100)}%</span>
          </div>
          <input
            aria-label="Clip audio volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            disabled={disabled}
            value={clip.volume}
            onChange={(event) =>
              onUpdateClip(clip.id, { volume: Number(event.currentTarget.value) })
            }
            className="w-full accent-[#ff4f1f]"
          />
          {onDetachAudio ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onDetachAudio(clip.id)}
              className="mt-3 h-9 w-full border border-white/15 px-3 text-[9px] font-semibold uppercase tracking-[0.13em] text-neutral-200 outline-none transition hover:border-[#ff4f1f] hover:text-[#ff9b7d] focus-visible:ring-2 focus-visible:ring-[#ff4f1f] disabled:opacity-40"
            >
              Detach audio
            </button>
          ) : null}
        </div>
      ) : null}
    </InspectorCard>
  );
};
