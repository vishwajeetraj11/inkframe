import type {
  TextMotionAnimation,
  TextMotionFontFamily,
  TextMotionFontStyle,
  TextMotionImageAsset,
  TextMotionScene,
} from "@/lib/text-motion/types";
import {
  clamp,
  framesToSeconds,
  secondsToFrames,
  TEXT_MOTION_ANIMATION_OPTIONS,
  TEXT_MOTION_FONT_FAMILY_OPTIONS,
  TEXT_MOTION_FONT_STYLE_OPTIONS,
} from "./constants";

interface TextMotionSceneCardProps {
  imageAssets: TextMotionImageAsset[];
  imagePreviewUrl?: string;
  index: number;
  scene: TextMotionScene;
  onChange: (patch: Partial<TextMotionScene>) => void;
  onDelete: () => void;
}

export const TextMotionSceneCard = ({
  imageAssets,
  imagePreviewUrl,
  index,
  scene,
  onChange,
  onDelete,
}: TextMotionSceneCardProps) => {
  return (
    <article className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="app-panel-label text-xs font-semibold uppercase tracking-wide text-slate-400">
          Scene {index + 1}
        </p>
        <button
          type="button"
          onClick={onDelete}
          className="rounded border border-rose-500/70 px-2 py-0.5 text-xs text-rose-200"
        >
          Delete
        </button>
      </div>

      <textarea
        value={scene.text}
        onChange={(event) => onChange({ text: event.currentTarget.value })}
        rows={3}
        className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
      />

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-200 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-slate-400">Duration (s)</span>
          <input
            type="number"
            min={1}
            max={12}
            step={0.1}
            value={framesToSeconds(scene.durationInFrames)}
            onChange={(event) => {
              const value = Number.parseFloat(event.currentTarget.value);
              onChange({ durationInFrames: secondsToFrames(Number.isFinite(value) ? value : 2) });
            }}
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
          />
        </label>

        <label className="space-y-1">
          <span className="text-slate-400">Animation</span>
          <select
            value={scene.animation}
            onChange={(event) => onChange({ animation: event.currentTarget.value as TextMotionAnimation })}
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
          >
            {TEXT_MOTION_ANIMATION_OPTIONS.map((animation) => (
              <option key={animation} value={animation}>
                {animation}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-slate-400">Accent Word</span>
          <input
            value={scene.accentWord ?? ""}
            onChange={(event) => onChange({ accentWord: event.currentTarget.value })}
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
          />
        </label>

        <label className="space-y-1">
          <span className="text-slate-400">Font</span>
          <select
            value={scene.fontFamily}
            onChange={(event) => onChange({ fontFamily: event.currentTarget.value as TextMotionFontFamily })}
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
          >
            {TEXT_MOTION_FONT_FAMILY_OPTIONS.map((fontFamily) => (
              <option key={fontFamily} value={fontFamily}>
                {fontFamily}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-slate-400">Weight</span>
          <input
            type="number"
            min={100}
            max={900}
            step={100}
            value={scene.fontWeight}
            onChange={(event) => {
              const nextWeight = Number.parseInt(event.currentTarget.value, 10);
              const normalizedWeight = Number.isFinite(nextWeight)
                ? Math.max(100, Math.min(900, Math.round(nextWeight / 100) * 100))
                : 700;
              onChange({ fontWeight: normalizedWeight });
            }}
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
          />
        </label>

        <label className="space-y-1">
          <span className="text-slate-400">Style</span>
          <select
            value={scene.fontStyle}
            onChange={(event) => onChange({ fontStyle: event.currentTarget.value as TextMotionFontStyle })}
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
          >
            {TEXT_MOTION_FONT_STYLE_OPTIONS.map((fontStyle) => (
              <option key={fontStyle} value={fontStyle}>
                {fontStyle}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-slate-400">Persist</span>
          <input
            type="checkbox"
            checked={scene.keepOnScreen === true}
            onChange={(event) => onChange({ keepOnScreen: event.currentTarget.checked })}
            className="h-8 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 accent-cyan-300"
          />
        </label>

        <label className="space-y-1 md:col-span-3">
          <span className="text-slate-400">Scene Image</span>
          <select
            value={scene.imageAssetId ?? ""}
            onChange={(event) => onChange({ imageAssetId: event.currentTarget.value || undefined })}
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
          >
            <option value="">None</option>
            {imageAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </label>

        {scene.imageAssetId ? (
          <>
            <div className="md:col-span-3">
              {imagePreviewUrl ? (
                <div
                  aria-label={`Scene ${index + 1} image preview`}
                  className="h-24 w-full rounded border border-slate-700 bg-cover bg-center"
                  style={{ backgroundImage: `url(${imagePreviewUrl})` }}
                />
              ) : null}
            </div>

            <label className="space-y-1">
              <span className="text-slate-400">Image Scale</span>
              <input
                type="number"
                min={0.2}
                max={2.5}
                step={0.05}
                value={scene.imageScale ?? 1}
                onChange={(event) => {
                  const nextValue = Number.parseFloat(event.currentTarget.value);
                  onChange({ imageScale: Number.isFinite(nextValue) ? clamp(nextValue, 0.2, 2.5) : 1 });
                }}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
              />
            </label>

            <label className="space-y-1">
              <span className="text-slate-400">Image Opacity</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={scene.imageOpacity ?? 0.65}
                onChange={(event) => {
                  const nextValue = Number.parseFloat(event.currentTarget.value);
                  onChange({ imageOpacity: Number.isFinite(nextValue) ? clamp(nextValue, 0, 1) : 0.65 });
                }}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
              />
            </label>

            <label className="space-y-1">
              <span className="text-slate-400">Image X (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={scene.imageX ?? 50}
                onChange={(event) => {
                  const nextValue = Number.parseFloat(event.currentTarget.value);
                  onChange({ imageX: Number.isFinite(nextValue) ? clamp(nextValue, 0, 100) : 50 });
                }}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
              />
            </label>

            <label className="space-y-1">
              <span className="text-slate-400">Image Y (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={scene.imageY ?? 50}
                onChange={(event) => {
                  const nextValue = Number.parseFloat(event.currentTarget.value);
                  onChange({ imageY: Number.isFinite(nextValue) ? clamp(nextValue, 0, 100) : 50 });
                }}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
              />
            </label>
          </>
        ) : null}
      </div>
    </article>
  );
};
