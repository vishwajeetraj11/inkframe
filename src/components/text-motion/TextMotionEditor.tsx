"use client";

import Link from "next/link";
import { Download, Film, ImagePlus, Trash2 } from "lucide-react";
import { ASPECT_PRESETS } from "@/lib/editor/constants";
import { TextMotionThemePanel } from "./TextMotionThemePanel";
import { TextMotionToolbar } from "./TextMotionToolbar";
import { ALEXANDER_DEMO_PROMPT } from "./constants";
import { TextMotionSceneList } from "./TextMotionSceneList";
import { useTextMotionProject } from "./hooks/use-text-motion-project";
import { useTextMotionWebMcp } from "./hooks/use-text-motion-webmcp";
import { ElahTextMotionPreview } from "./ElahTextMotionPreview";

export const TextMotionEditor = () => {
  const project = useTextMotionProject();
  useTextMotionWebMcp({
    project: project.safeProject,
    setProject: (nextProject) => project.setProject(nextProject),
    prompt: project.prompt,
    setPrompt: project.setPrompt,
    loadTemplate: project.loadTemplate,
    generate: (prompt, signal) => project.onGenerate(prompt, signal),
    exportProject: (signal) => project.onExport(signal),
    requestImagePicker: () => {
      const input = document.getElementById("text-motion-image-upload");
      if (!(input instanceof HTMLInputElement) || input.disabled) {
        throw new Error("Image picker is unavailable while the workspace is busy.");
      }
      input.click();
    },
  });
  const preset =
    ASPECT_PRESETS[project.safeProject.aspect] ?? ASPECT_PRESETS.reel_9_16;
  const imagePreviewById = new Map(
    project.safeProject.imageAssets.map((asset) => [asset.id, asset.dataUrl]),
  );

  return (
    <div className="min-h-screen bg-[#0f0d0a] text-[#f2ede3] selection:bg-[#ff4f1f] selection:text-[#0f0d0a]">
      <header className="sticky top-0 z-30 border-b border-[#f2ede3]/15 bg-[#0f0d0a]/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-4 md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <Link
              href="/"
              aria-label="Inkframe home"
              className="flex min-h-11 items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f]"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff4f1f]" aria-hidden="true" />
              <span className="app-title text-xl font-semibold uppercase tracking-[-0.02em]">Inkframe</span>
            </Link>
            <span className="hidden h-5 w-px bg-[#f2ede3]/15 sm:block" aria-hidden="true" />
            <div className="min-w-0">
              <p className="app-eyebrow truncate text-[10px] uppercase tracking-[0.18em] text-[#f2ede3]/42">
                Text motion / {project.safeProject.aspect === "reel_9_16" ? "9:16" : "16:9"}
              </p>
              <p className="truncate text-xs text-[#f2ede3]/72">{project.safeProject.title}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="app-data hidden items-center gap-4 text-[10px] uppercase tracking-[0.12em] text-[#f2ede3]/45 md:flex">
              <span>{project.safeProject.scenes.length} scenes</span>
              <span>{(project.durationInFrames / 30).toFixed(1)} sec</span>
            </div>
            <button
              type="button"
              onClick={() => void project.onExport()}
              disabled={project.isGenerating || project.isExporting}
              className="flex min-h-11 items-center gap-2 border border-[#f2ede3]/25 px-3 text-xs font-bold uppercase tracking-[0.08em] text-[#f2ede3] motion-safe:transition-colors hover:border-[#ff4f1f] hover:bg-[#ff4f1f] hover:text-[#0f0d0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0d0a] disabled:cursor-not-allowed disabled:opacity-45 sm:px-4"
            >
              <Download aria-hidden="true" className={`h-4 w-4 ${project.isExporting ? "motion-safe:animate-pulse" : ""}`} />
              <span className="hidden sm:inline">{project.isExporting ? "Rendering film" : "Export MP4"}</span>
              <span className="sm:hidden">{project.isExporting ? "Rendering" : "Export"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-4 pb-20 pt-6 md:px-6 lg:px-8 lg:pt-8">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.55fr)] xl:gap-12">
          <div className="order-1 lg:sticky lg:top-24">
            <TextMotionToolbar
              isExporting={project.isExporting}
              isGenerating={project.isGenerating}
              onAspectChange={(aspect) => {
                project.setProject((previous) => ({
                  ...previous,
                  aspect,
                }));
              }}
              onGenerate={() => {
                void project.onGenerate();
              }}
              onLoadTemplate={project.loadTemplate}
              onPromptChange={project.setPrompt}
              onUseAlexanderDemo={() => {
                project.setPrompt(ALEXANDER_DEMO_PROMPT);
                project.setStatusMessage(
                  "Example brief loaded. Generate to replace the current storyboard.",
                );
              }}
              project={project.safeProject}
              prompt={project.prompt}
              statusMessage={project.statusMessage}
              templateDefinitions={project.templateDefinitions}
            />
          </div>

          <section aria-labelledby="preview-heading" className="order-2 min-w-0">
            <div className="flex items-end justify-between border-b border-[#f2ede3]/15 pb-3">
              <div>
                <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-[#ff4f1f]">Live cut</p>
                <h2 id="preview-heading" className="app-title mt-1 text-2xl font-semibold uppercase tracking-[-0.015em]">
                  Program monitor
                </h2>
              </div>
              <div className="app-data flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[#f2ede3]/45">
                <Film aria-hidden="true" className="h-3.5 w-3.5" />
                {preset.width} × {preset.height} / {preset.fps} fps
              </div>
            </div>

            <div className="relative flex min-h-[23rem] items-center justify-center overflow-hidden border-b border-[#f2ede3]/15 bg-[#080706] p-3 sm:min-h-[32rem] sm:p-6 lg:min-h-[min(66vh,46rem)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(242,237,227,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(242,237,227,0.05)_1px,transparent_1px)] [background-size:40px_40px]"
              />
              <div
                className="relative w-full overflow-hidden border border-[#f2ede3]/20 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
                style={{
                  aspectRatio: `${preset.width} / ${preset.height}`,
                  maxWidth:
                    project.safeProject.aspect === "reel_9_16"
                      ? `min(100%, calc(64vh * ${preset.width} / ${preset.height}))`
                      : "min(100%, 62rem)",
                }}
              >
                <ElahTextMotionPreview project={project.safeProject} />
              </div>
            </div>

            <div className="grid border-b border-[#f2ede3]/15 xl:grid-cols-2">
              <TextMotionThemePanel theme={project.safeProject.theme} onChange={project.updateTheme} />

              <section aria-labelledby="image-assets-heading" className="border-t border-[#f2ede3]/15 py-5 xl:border-l xl:border-t-0 xl:pl-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 id="image-assets-heading" className="app-eyebrow text-[10px] uppercase tracking-[0.2em] text-[#f2ede3]/45">
                      Source images
                    </h3>
                    <p className="mt-1 text-xs text-[#f2ede3]/48">
                      {project.safeProject.imageAssets.length === 0
                        ? "Optional backgrounds for photo-led scenes."
                        : `${project.safeProject.imageAssets.length} asset${project.safeProject.imageAssets.length === 1 ? "" : "s"} ready.`}
                    </p>
                  </div>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 border border-[#f2ede3]/20 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#f2ede3]/70 hover:border-[#ff4f1f] hover:text-[#f2ede3] focus-within:ring-2 focus-within:ring-[#ff4f1f]">
                    <ImagePlus aria-hidden="true" className="h-4 w-4" />
                    Add
                    <input
                      id="text-motion-image-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      disabled={project.isGenerating || project.isExporting}
                      onChange={(event) => {
                        void project.onImageFilesSelected(event.currentTarget.files);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>

                {project.safeProject.imageAssets.length > 0 ? (
                  <div className="mt-4 max-h-40 divide-y divide-[#f2ede3]/10 overflow-y-auto border-y border-[#f2ede3]/10">
                    {project.safeProject.imageAssets.map((asset) => (
                      <div key={asset.id} className="flex min-h-12 items-center gap-3 py-2">
                        <div
                          aria-hidden="true"
                          className="h-8 w-8 shrink-0 bg-cover bg-center"
                          style={{ backgroundImage: `url(${asset.dataUrl})` }}
                        />
                        <p className="min-w-0 flex-1 truncate text-xs text-[#f2ede3]/70">{asset.name}</p>
                        <button
                          type="button"
                          onClick={() => project.onUseImageInAllScenes(asset.id)}
                          className="min-h-11 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#f2ede3]/48 hover:text-[#f2ede3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f]"
                        >
                          Apply all
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${asset.name}`}
                          onClick={() => project.onRemoveImageAsset(asset.id)}
                          className="flex h-11 w-11 items-center justify-center text-[#f2ede3]/38 hover:bg-[#ff4f1f] hover:text-[#0f0d0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f]"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            </div>
          </section>
        </div>

        <div className="mt-12 lg:mt-16">
          <TextMotionSceneList
            scenes={project.safeProject.scenes}
            imageAssets={project.safeProject.imageAssets}
            imagePreviewById={imagePreviewById}
            onAddScene={project.addScene}
            onChangeScene={project.updateScene}
            onDeleteScene={project.removeScene}
          />
        </div>
      </main>
    </div>
  );
};
