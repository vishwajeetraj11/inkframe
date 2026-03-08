import { AspectSwitcher } from "@/components/editor/AspectSwitcher";
import type { TextMotionProject, TextMotionTemplate } from "@/lib/text-motion/types";
import type { TextMotionTemplateDefinition } from "@/lib/text-motion/templates";
import { ALEXANDER_DEMO_PROMPT, templateLabel } from "./constants";

interface TextMotionToolbarProps {
  durationInFrames: number;
  isExporting: boolean;
  isGenerating: boolean;
  onAspectChange: (aspect: TextMotionProject["aspect"]) => void;
  onExport: () => void;
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
  durationInFrames,
  isExporting,
  isGenerating,
  onAspectChange,
  onExport,
  onGenerate,
  onLoadTemplate,
  onPromptChange,
  onUseAlexanderDemo,
  project,
  prompt,
  statusMessage,
  templateDefinitions,
}: TextMotionToolbarProps) => {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4">
      <div className="space-y-2">
        <p className="app-eyebrow text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          AI Text Motion Editor
        </p>
        <h1 className="app-title text-2xl font-semibold leading-tight md:text-3xl">
          Prompt to kinetic typography
        </h1>
        <p className="text-sm text-slate-300">
          Generate animated text scenes with OpenAI, preview in Remotion, and export MP4.
        </p>
      </div>

      <AspectSwitcher
        activeAspect={project.aspect}
        disabled={isGenerating || isExporting}
        onChange={onAspectChange}
      />

      <label className="block space-y-2">
        <div className="flex items-center justify-between">
          <span className="app-panel-label text-xs font-semibold uppercase tracking-wide text-slate-300">
            Prompt
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {templateDefinitions
              .filter((definition) => definition.id !== "default")
              .map((definition) => (
                <button
                  key={definition.id}
                  type="button"
                  disabled={isGenerating || isExporting}
                  onClick={() => onLoadTemplate(definition.id)}
                  className="rounded-md border px-2 py-1 text-xs font-semibold disabled:opacity-60 border-cyan-300/70 text-cyan-200"
                >
                  Template: {definition.shortLabel}
                </button>
              ))}
            <button
              type="button"
              disabled={isGenerating || isExporting}
              onClick={onUseAlexanderDemo}
              className="rounded-md border border-cyan-300/70 px-2 py-1 text-xs font-semibold text-cyan-200 disabled:opacity-60"
            >
              Demo: Alexander
            </button>
          </div>
        </div>
        <textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.currentTarget.value)}
          rows={5}
          disabled={isGenerating || isExporting}
          className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating || isExporting || prompt.trim().length < 3}
          className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
        >
          {isGenerating ? "Generating..." : "Generate Motion Script"}
        </button>

        <button
          type="button"
          onClick={onExport}
          disabled={isGenerating || isExporting}
          className="rounded-lg bg-emerald-300 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
        >
          {isExporting ? "Rendering..." : "Export MP4"}
        </button>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
          {statusMessage}
        </p>
      ) : null}

      <div className="app-data rounded-xl border border-slate-700/70 bg-slate-950/50 p-3 text-xs text-slate-300">
        <p>Template: {templateLabel(project.template)}</p>
        <p>Title: {project.title}</p>
        <p>Total Duration: {(durationInFrames / 30).toFixed(2)}s</p>
        <p>Scenes: {project.scenes.length}</p>
        <p>Images: {project.imageAssets.length}</p>
      </div>
    </section>
  );
};

export { ALEXANDER_DEMO_PROMPT };
