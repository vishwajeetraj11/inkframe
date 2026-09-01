import { Sparkles } from "lucide-react";
import { ASPECT_PRESETS } from "@/lib/editor/constants";
import type { TextMotionProject, TextMotionTemplate } from "@/lib/text-motion/types";
import type { TextMotionTemplateDefinition } from "@/lib/text-motion/templates";
import { ALEXANDER_DEMO_PROMPT } from "./constants";

interface TextMotionToolbarProps {
  isExporting: boolean;
  isGenerating: boolean;
  onAspectChange: (aspect: TextMotionProject["aspect"]) => void;
  onGenerate: () => void;
  onLoadTemplate: (template: TextMotionTemplate) => void;
  onPromptChange: (prompt: string) => void;
  onUseAlexanderDemo: () => void;
  project: TextMotionProject;
  prompt: string;
  statusMessage: string | null;
  templateDefinitions: TextMotionTemplateDefinition[];
}

export const TextMotionToolbar = ({
  isExporting,
  isGenerating,
  onAspectChange,
  onGenerate,
  onLoadTemplate,
  onPromptChange,
  onUseAlexanderDemo,
  project,
  prompt,
  statusMessage,
  templateDefinitions,
}: TextMotionToolbarProps) => {
  const isBusy = isGenerating || isExporting;
  const promptLength = prompt.trim().length;
  const promptIsTooShort = promptLength > 0 && promptLength < 3;

  return (
    <section aria-labelledby="text-motion-brief" className="min-w-0">
      <div className="border-b border-[#f2ede3]/15 pb-5">
        <p className="app-eyebrow text-[10px] uppercase tracking-[0.24em] text-[#ff4f1f]">
          Creative brief
        </p>
        <h1
          id="text-motion-brief"
          className="app-title mt-2 text-[clamp(2rem,4vw,3.6rem)] font-semibold uppercase leading-[0.88] tracking-[-0.025em] text-[#f2ede3]"
        >
          Write it.
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

        <label className="block">
          <span className="app-eyebrow text-[10px] uppercase tracking-[0.2em] text-[#f2ede3]/45">
            Direction
          </span>
          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.currentTarget.value)}
            aria-describedby="text-motion-direction-hint"
            rows={6}
            disabled={isBusy}
            placeholder="Describe the story, pacing, tone, and call to action…"
            className="mt-2 min-h-36 w-full resize-y border border-[#f2ede3]/15 bg-[#17130f] px-3.5 py-3 text-base leading-relaxed text-[#f2ede3] placeholder:text-[#f2ede3]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f] disabled:cursor-not-allowed disabled:opacity-60"
          />
          <span
            id="text-motion-direction-hint"
            className={`mt-2 block text-xs ${promptIsTooShort ? "text-[#ff8b69]" : "text-[#f2ede3]/45"}`}
          >
            {promptIsTooShort
              ? "Add at least 3 characters before generating."
              : "Describe the story, pacing, and visual tone."}
          </span>
        </label>

        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
          <button
            type="button"
            onClick={onGenerate}
            disabled={isBusy || promptLength < 3}
            className="group flex min-h-12 flex-1 items-center justify-between gap-3 bg-[#ff4f1f] px-4 text-sm font-bold uppercase tracking-[0.06em] text-[#0f0d0a] motion-safe:transition-colors hover:bg-[#ff6a42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2ede3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0d0a] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span>{isGenerating ? "Building storyboard" : "Generate storyboard"}</span>
            <Sparkles
              aria-hidden="true"
              className={`h-4 w-4 ${isGenerating ? "motion-safe:animate-pulse" : "motion-safe:transition-transform motion-safe:group-hover:rotate-12"}`}
            />
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onUseAlexanderDemo}
            className="min-h-12 border border-[#f2ede3]/15 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[#f2ede3]/65 hover:border-[#f2ede3]/35 hover:text-[#f2ede3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Load example brief
          </button>
        </div>

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
        ) : isGenerating ? (
          <div role="status" aria-live="polite" className="border-y border-[#f2ede3]/15 py-3">
            <p className="text-sm text-[#f2ede3]/75">Writing scene beats and motion cues…</p>
            <div className="mt-3 h-px overflow-hidden bg-[#f2ede3]/10">
              <div className="h-full w-2/5 bg-[#ff4f1f] motion-safe:animate-pulse" />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export { ALEXANDER_DEMO_PROMPT };
