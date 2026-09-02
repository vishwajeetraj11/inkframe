import { InspectorCard } from "@/components/editor/controls/InspectorCard";
import { LabeledControl } from "@/components/editor/controls/LabeledControl";
import { AudioEnhancementsInspector } from "@/components/editor/features/AudioEnhancementsInspector";
import { FPS } from "@/lib/editor/constants";
import type { AudioTrack } from "@/lib/editor/types";
import { framesToSeconds, parseNumber, secondsToFrames } from "./utils";

interface AudioInspectorProps {
  audioTrack: AudioTrack;
  audioLabel?: string;
  disabled?: boolean;
  onUpdateAudio: (audioId: string, patch: Partial<Omit<AudioTrack, "id" | "assetId">>) => void;
  onRemoveAudio?: (audioId: string) => void;
}

export const AudioInspector = ({
  audioTrack,
  audioLabel,
  disabled,
  onUpdateAudio,
  onRemoveAudio,
}: AudioInspectorProps) => {
  return (
    <InspectorCard title="Audio Track">
      <div>
        <p className="text-sm font-medium text-neutral-100">
          {audioLabel ?? "Selected audio"}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Adjust timing and level from one place.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-neutral-200">
        <LabeledControl label="Start (s)">
          <input
            type="number"
            min={0}
            step={0.1}
            disabled={disabled}
            value={framesToSeconds(audioTrack.startFrame)}
            onChange={(event) => {
              const seconds = parseNumber(
                event.currentTarget.value,
                framesToSeconds(audioTrack.startFrame),
              );

              onUpdateAudio(audioTrack.id, {
                startFrame: Math.max(0, secondsToFrames(seconds)),
              });
            }}
            className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
          />
        </LabeledControl>

        <LabeledControl label="End (s)">
          <input
            type="number"
            min={0.1}
            step={0.1}
            disabled={disabled}
            value={framesToSeconds(audioTrack.endFrame)}
            onChange={(event) => {
              const seconds = parseNumber(
                event.currentTarget.value,
                framesToSeconds(audioTrack.endFrame),
              );

              onUpdateAudio(audioTrack.id, {
                endFrame: Math.max(1, secondsToFrames(seconds)),
              });
            }}
            className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
          />
        </LabeledControl>
      </div>

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

      <AudioEnhancementsInspector
        audio={{
          volume: audioTrack.volume,
          fadeIn: (audioTrack.fadeInFrames ?? 0) / FPS,
          fadeOut: (audioTrack.fadeOutFrames ?? 0) / FPS,
          muted: audioTrack.muted ?? false,
        }}
        disabled={disabled}
        onDelete={onRemoveAudio ? () => onRemoveAudio(audioTrack.id) : undefined}
        onUpdate={(patch) => {
          onUpdateAudio(audioTrack.id, {
            ...(patch.volume !== undefined ? { volume: patch.volume } : {}),
            ...(patch.fadeIn !== undefined
              ? { fadeInFrames: Math.round(patch.fadeIn * FPS) }
              : {}),
            ...(patch.fadeOut !== undefined
              ? { fadeOutFrames: Math.round(patch.fadeOut * FPS) }
              : {}),
            ...(patch.muted !== undefined ? { muted: patch.muted } : {}),
          });
        }}
      />
    </InspectorCard>
  );
};
