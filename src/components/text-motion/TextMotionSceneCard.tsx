import { ChevronDown, Trash2 } from "lucide-react";
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

const fieldClass =
  "mt-1 min-h-11 w-full border border-[#f2ede3]/15 bg-[#17130f] px-3 text-sm text-[#f2ede3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f] disabled:opacity-50";
const labelClass =
  "app-eyebrow text-[9px] uppercase tracking-[0.16em] text-[#f2ede3]/42";

export const TextMotionSceneCard = ({
  imageAssets,
  imagePreviewUrl,
  index,
  scene,
  onChange,
  onDelete,
}: TextMotionSceneCardProps) => {
  return (
    <article className="grid gap-4 py-5 md:grid-cols-[5.5rem_minmax(0,1fr)] md:gap-6 lg:py-6">
      <div className="flex items-center justify-between md:block">
        <div>
          <p className="app-eyebrow text-[9px] uppercase tracking-[0.2em] text-[#f2ede3]/35">Scene</p>
          <p className="app-title mt-1 text-4xl font-semibold leading-none text-[#f2ede3]/28">
            {String(index + 1).padStart(2, "0")}
          </p>
        </div>
        <p className="app-data text-[10px] uppercase tracking-[0.12em] text-[#f2ede3]/36 md:mt-4">
          {framesToSeconds(scene.durationInFrames)} sec
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Scene {index + 1} text</span>
            <textarea
              value={scene.text}
              onChange={(event) => onChange({ text: event.currentTarget.value })}
              rows={2}
              aria-label={`Scene ${index + 1} text`}
              className="app-title min-h-[5.5rem] w-full resize-y border-0 border-l-2 border-[#ff4f1f] bg-transparent py-2 pl-4 pr-2 text-[clamp(1.5rem,3vw,2.35rem)] font-semibold uppercase leading-[0.95] tracking-[-0.015em] text-[#f2ede3] placeholder:text-[#f2ede3]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f]"
            />
          </label>
          <button
            type="button"
            aria-label={`Delete scene ${index + 1}`}
            title="Delete scene"
            onClick={onDelete}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-[#f2ede3]/35 hover:bg-[#ff4f1f] hover:text-[#0f0d0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f]"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label>
            <span className={labelClass}>Duration</span>
            <div className="relative">
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
                className={`${fieldClass} pr-8`}
              />
              <span className="app-data pointer-events-none absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-[9px] uppercase text-[#f2ede3]/30">
                sec
              </span>
            </div>
          </label>

          <label>
            <span className={labelClass}>Motion</span>
            <select
              value={scene.animation}
              onChange={(event) => onChange({ animation: event.currentTarget.value as TextMotionAnimation })}
              className={fieldClass}
            >
              {TEXT_MOTION_ANIMATION_OPTIONS.map((animation) => (
                <option key={animation} value={animation}>
                  {animation}
                </option>
              ))}
            </select>
          </label>

          <label className="col-span-2 sm:col-span-1">
            <span className={labelClass}>Accent word</span>
            <input
              value={scene.accentWord ?? ""}
              placeholder="Optional"
              onChange={(event) => onChange({ accentWord: event.currentTarget.value })}
              className={fieldClass}
            />
          </label>

          <label className="col-span-2 flex min-h-11 cursor-pointer items-center justify-between self-end border border-[#f2ede3]/15 bg-[#17130f] px-3 sm:col-span-1">
            <span>
              <span className="block text-xs font-medium text-[#f2ede3]/72">Keep visible</span>
              <span className="app-data block text-[9px] uppercase text-[#f2ede3]/30">Caption rail</span>
            </span>
            <input
              type="checkbox"
              checked={scene.keepOnScreen === true}
              onChange={(event) => onChange({ keepOnScreen: event.currentTarget.checked })}
              className="h-5 w-5 accent-[#ff4f1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f]"
            />
          </label>
        </div>

        <details className="group mt-4 border-t border-[#f2ede3]/10">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-[#f2ede3]/45 hover:text-[#f2ede3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f] [&::-webkit-details-marker]:hidden">
            Typography & image
            <ChevronDown aria-hidden="true" className="h-4 w-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-open:rotate-180" />
          </summary>

          <div className="grid gap-3 pb-2 pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <label>
              <span className={labelClass}>Typeface</span>
              <select
                value={scene.fontFamily}
                onChange={(event) => onChange({ fontFamily: event.currentTarget.value as TextMotionFontFamily })}
                className={fieldClass}
              >
                {TEXT_MOTION_FONT_FAMILY_OPTIONS.map((fontFamily) => (
                  <option key={fontFamily} value={fontFamily}>
                    {fontFamily}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className={labelClass}>Weight</span>
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
                className={fieldClass}
              />
            </label>

            <label>
              <span className={labelClass}>Style</span>
              <select
                value={scene.fontStyle}
                onChange={(event) => onChange({ fontStyle: event.currentTarget.value as TextMotionFontStyle })}
                className={fieldClass}
              >
                {TEXT_MOTION_FONT_STYLE_OPTIONS.map((fontStyle) => (
                  <option key={fontStyle} value={fontStyle}>
                    {fontStyle}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className={labelClass}>Scene image</span>
              <select
                value={scene.imageAssetId ?? ""}
                onChange={(event) => onChange({ imageAssetId: event.currentTarget.value || undefined })}
                className={fieldClass}
              >
                <option value="">No image</option>
                {imageAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </label>

            {scene.imageAssetId ? (
              <>
                {imagePreviewUrl ? (
                  <div
                    aria-label={`Scene ${index + 1} image preview`}
                    className="min-h-28 bg-cover bg-center sm:col-span-2 lg:row-span-2"
                    style={{ backgroundImage: `url(${imagePreviewUrl})` }}
                  />
                ) : null}

                <label>
                  <span className={labelClass}>Image scale</span>
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
                    className={fieldClass}
                  />
                </label>

                <label>
                  <span className={labelClass}>Opacity</span>
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
                    className={fieldClass}
                  />
                </label>

                <label>
                  <span className={labelClass}>Position X</span>
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
                    className={fieldClass}
                  />
                </label>

                <label>
                  <span className={labelClass}>Position Y</span>
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
                    className={fieldClass}
                  />
                </label>
              </>
            ) : null}
          </div>
        </details>
      </div>
    </article>
  );
};
