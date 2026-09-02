import { ASPECT_PRESETS } from "@/lib/editor/constants";
import type { TextMotionProject, TextMotionTemplate } from "@/lib/text-motion/types";
import type { TextMotionTemplateDefinition } from "@/lib/text-motion/templates";

interface TextMotionToolbarProps {
  isExporting: boolean;
  onAspectChange: (aspect: TextMotionProject["aspect"]) => void;
  onLoadTemplate: (template: TextMotionTemplate) => void;
  project: TextMotionProject;
  statusMessage: string | null;
  templateDefinitions: TextMotionTemplateDefinition[];
}

export const TextMotionToolbar = ({
  isExporting,
  onAspectChange,
  onLoadTemplate,
  project,
  statusMessage,
  templateDefinitions,
}: TextMotionToolbarProps) => {
  const isBusy = isExporting;

  return (
    <section aria-labelledby="text-motion-composition" className="min-w-0">
      <div className="border-b border-[#f2ede3]/15 pb-5">
        <p className="app-eyebrow text-[10px] uppercase tracking-[0.24em] text-[#ff4f1f]">
          Composition
        </p>
        <h1
          id="text-motion-composition"
          className="app-title mt-2 text-[clamp(2rem,4vw,3.6rem)] font-semibold uppercase leading-[0.88] tracking-[-0.025em] text-[#f2ede3]"
        >
          Build it.
          <br />
          <span className="text-[#f2ede3]/38">Set it in motion.</span>
        </h1>
      </div>

      <div className="space-y-6 py-5">
        <fieldset disabled={isBusy}>
          <legend className="app-eyebrow mb-2 text-[10px] uppercase tracking-[0.2em] text-[#f2ede3]/45">
            Format
          </legend>
          <div className="grid grid-cols-2 border border-[#f2ede3]/15">
            {(Object.keys(ASPECT_PRESETS) as TextMotionProject["aspect"][]).map((aspect) => {
              const isActive = aspect === project.aspect;
              const preset = ASPECT_PRESETS[aspect];
              return (
                <button
                  key={aspect}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onAspectChange(aspect)}
                  className={`min-h-11 border-r border-[#f2ede3]/15 px-3 text-left last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f] focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 ${
                    isActive
                      ? "bg-[#f2ede3] text-[#0f0d0a]"
                      : "bg-transparent text-[#f2ede3]/65 hover:bg-[#f2ede3]/[0.06] hover:text-[#f2ede3]"
                  }`}
                >
                  <span className="app-data block text-[10px] uppercase tracking-[0.12em]">
                    {aspect === "reel_9_16" ? "Portrait" : "Landscape"}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset disabled={isBusy}>
          <legend className="app-eyebrow mb-2 text-[10px] uppercase tracking-[0.2em] text-[#f2ede3]/45">
            Visual language
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {templateDefinitions.map((definition) => {
              const isActive = definition.id === project.template;
              return (
                <button
                  key={definition.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onLoadTemplate(definition.id)}
                  className={`min-h-11 border-b px-0.5 text-xs font-semibold uppercase tracking-[0.1em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f] disabled:cursor-not-allowed disabled:opacity-50 ${
                    isActive
                      ? "border-[#ff4f1f] text-[#f2ede3]"
                      : "border-transparent text-[#f2ede3]/45 hover:border-[#f2ede3]/25 hover:text-[#f2ede3]"
                  }`}
                >
                  {definition.shortLabel}
                </button>
              );
            })}
          </div>
        </fieldset>

        <p className="border-y border-[#f2ede3]/15 py-3 text-sm leading-relaxed text-[#f2ede3]/55">
          Choose a visual language, then edit the scenes below directly.
        </p>

        {statusMessage ? (
          <div
            role="status"
            aria-live="polite"
            className="flex gap-3 border-y border-[#f2ede3]/15 py-3 text-sm leading-relaxed text-[#f2ede3]/72"
          >
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isBusy ? "bg-[#ff4f1f] motion-safe:animate-pulse" : "bg-[#f2ede3]/50"}`}
            />
            {statusMessage}
          </div>
        ) : null}
      </div>
    </section>
  );
};
