"use client";

import { ASPECT_PRESETS } from "@/lib/editor/constants";
import { TextMotionComposition } from "@/remotion/TextMotionComposition";
import { Player } from "@remotion/player";
import { TextMotionThemePanel } from "./TextMotionThemePanel";
import { TextMotionToolbar } from "./TextMotionToolbar";
import { ALEXANDER_DEMO_PROMPT } from "./constants";
import { TextMotionSceneList } from "./TextMotionSceneList";
import { useTextMotionProject } from "./hooks/use-text-motion-project";

export const TextMotionEditor = () => {
  const project = useTextMotionProject();
  const preset =
    ASPECT_PRESETS[project.safeProject.aspect] ?? ASPECT_PRESETS.reel_9_16;
  const imagePreviewById = new Map(
    project.safeProject.imageAssets.map((asset) => [asset.id, asset.dataUrl]),
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#172554,_#020617_65%)] px-4 py-6 text-slate-100 md:px-6">
      <div className="mx-auto grid w-full max-w-7xl gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <TextMotionToolbar
            durationInFrames={project.durationInFrames}
            isExporting={project.isExporting}
            isGenerating={project.isGenerating}
            onAspectChange={(aspect) => {
              project.setProject((previous) => ({
                ...previous,
                aspect,
              }));
            }}
            onExport={() => {
              void project.onExport();
            }}
            onGenerate={() => {
              void project.onGenerate();
            }}
            onLoadTemplate={project.loadTemplate}
            onPromptChange={project.setPrompt}
            onUseAlexanderDemo={() => {
              project.setPrompt(ALEXANDER_DEMO_PROMPT);
              project.setStatusMessage("Loaded Alexander demo prompt.");
            }}
            project={project.safeProject}
            prompt={project.prompt}
            statusMessage={project.statusMessage}
            templateDefinitions={project.templateDefinitions}
          />

          <div className="space-y-2 rounded-xl border border-slate-700/70 bg-slate-950/50 p-3">
            <div className="flex items-center justify-between">
              <p className="app-panel-label text-xs font-semibold uppercase tracking-wide text-slate-300">
                Image Assets
              </p>
              <label className="cursor-pointer rounded-md border border-cyan-300/70 px-2 py-1 text-xs font-semibold text-cyan-200">
                Add Images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={project.isGenerating || project.isExporting}
                  onChange={(event) => {
                    void project.onImageFilesSelected(event.currentTarget.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
              {project.safeProject.imageAssets.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Upload images to combine with text scenes.
                </p>
              ) : (
                project.safeProject.imageAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900/70 px-2 py-1.5"
                  >
                    <p className="truncate text-xs text-slate-200">{asset.name}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => project.onUseImageInAllScenes(asset.id)}
                        className="rounded border border-cyan-300/70 px-2 py-0.5 text-[11px] text-cyan-200"
                      >
                        Use In All Scenes
                      </button>
                      <button
                        type="button"
                        onClick={() => project.onRemoveImageAsset(asset.id)}
                        className="rounded border border-rose-500/70 px-2 py-0.5 text-[11px] text-rose-200"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <TextMotionThemePanel
            theme={project.safeProject.theme}
            onChange={project.updateTheme}
          />
        </div>

        <section className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4">
            <h2 className="app-panel-label mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
              Preview
            </h2>
            <div
              className="overflow-hidden rounded-xl border border-slate-700 bg-black"
              style={{ aspectRatio: `${preset.width} / ${preset.height}` }}
            >
              <Player
                component={TextMotionComposition}
                inputProps={project.inputProps}
                durationInFrames={project.durationInFrames}
                compositionWidth={preset.width}
                compositionHeight={preset.height}
                fps={preset.fps}
                acknowledgeRemotionLicense
                controls
                loop
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </div>

          <TextMotionSceneList
            scenes={project.safeProject.scenes}
            imageAssets={project.safeProject.imageAssets}
            imagePreviewById={imagePreviewById}
            onAddScene={project.addScene}
            onChangeScene={project.updateScene}
            onDeleteScene={project.removeScene}
          />
        </section>
      </div>
    </div>
  );
};
