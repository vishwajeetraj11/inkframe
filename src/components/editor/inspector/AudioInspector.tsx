import { InspectorCard } from "@/components/editor/controls/InspectorCard";
import { LabeledControl } from "@/components/editor/controls/LabeledControl";
import type { AudioTrack } from "@/lib/editor/types";
import { framesToSeconds, parseNumber, secondsToFrames } from "./utils";

interface AudioInspectorProps {
  audioTrack: AudioTrack;
  disabled?: boolean;
  onUpdateAudio: (audioId: string, patch: Partial<Omit<AudioTrack, "id" | "assetId">>) => void;
}

export const AudioInspector = ({
  audioTrack,
  disabled,
  onUpdateAudio,
}: AudioInspectorProps) => {
  return (
    <InspectorCard title="Audio Track">
      <div className="grid grid-cols-2 gap-2 text-xs text-neutral-200">
        <LabeledControl label="Trim Start (s)">
          <input
            type="number"
            min={0}
            step={0.1}
            disabled={disabled}
            value={framesToSeconds(audioTrack.trimStartFrame)}
            onChange={(event) => {
              const seconds = parseNumber(
                event.currentTarget.value,
                framesToSeconds(audioTrack.trimStartFrame),
              );

              onUpdateAudio(audioTrack.id, {
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
            value={framesToSeconds(audioTrack.trimEndFrame)}
            onChange={(event) => {
              const seconds = parseNumber(
                event.currentTarget.value,
                framesToSeconds(audioTrack.trimEndFrame),
              );

              onUpdateAudio(audioTrack.id, {
                trimEndFrame: Math.max(1, secondsToFrames(seconds)),
              });
            }}
            className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
          />
        </LabeledControl>
      </div>

      <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Volume">
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          disabled={disabled}
          value={audioTrack.volume}
          onChange={(event) => {
            onUpdateAudio(audioTrack.id, {
              volume: Number.parseFloat(event.currentTarget.value),
            });
          }}
          className="w-full"
        />
      </LabeledControl>
    </InspectorCard>
  );
};
