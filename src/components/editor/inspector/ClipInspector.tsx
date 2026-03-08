import { InspectorCard } from "@/components/editor/controls/InspectorCard";
import { LabeledControl } from "@/components/editor/controls/LabeledControl";
import type { Clip } from "@/lib/editor/types";
import { framesToSeconds, parseNumber, secondsToFrames } from "./utils";

interface ClipInspectorProps {
  clip: Clip;
  disabled?: boolean;
  onUpdateClip: (clipId: string, patch: Partial<Omit<Clip, "id" | "assetId" | "kind">>) => void;
}

export const ClipInspector = ({
  clip,
  disabled,
  onUpdateClip,
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
    </InspectorCard>
  );
};
