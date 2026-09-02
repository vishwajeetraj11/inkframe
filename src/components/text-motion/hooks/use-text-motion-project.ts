"use client";

import { exportElahProjectInBrowser } from "@/lib/export/elah-browser";
import { detectElahBrowserCapabilities } from "@/lib/editor/elah-browser-capabilities";
import { toElahTextMotionProject } from "@/lib/text-motion/elah-adapter";
import { createDefaultTextMotionProject } from "@/lib/text-motion/defaults";
import {
  MAX_TEXT_MOTION_DURATION_FRAMES,
  MAX_TEXT_MOTION_SCENE_COUNT,
  TEXT_MOTION_FPS,
} from "@/lib/text-motion/constants";
import { getTextMotionDurationInFrames, sanitizeTextMotionProject } from "@/lib/text-motion/utils";
import type { TextMotionProject, TextMotionScene, TextMotionTemplate } from "@/lib/text-motion/types";
import {
  getTextMotionTemplateDefinition,
  TEXT_MOTION_TEMPLATE_DEFINITIONS,
} from "@/lib/text-motion/templates";
import { useMemo, useState } from "react";
import {
  createImageAssetsFromFiles,
  createTextMotionScene,
  mergeGeneratedProject,
  mergeTemplateProject,
} from "./text-motion-project-helpers";

export interface TextMotionActionResult {
  ok: boolean;
  message: string;
}

export const useTextMotionProject = () => {
  const [project, setProject] = useState<TextMotionProject>(() =>
    createDefaultTextMotionProject("reel_9_16"),
  );
  const [prompt, setPrompt] = useState(
    "Create a high-energy promo for a new AI video tool with a strong hook and CTA.",
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const safeProject = useMemo(() => sanitizeTextMotionProject(project), [project]);
  const durationInFrames = getTextMotionDurationInFrames(safeProject);
  const imageAssetMap = useMemo(
    () => new Map(safeProject.imageAssets.map((asset) => [asset.id, asset])),
    [safeProject.imageAssets],
  );

  const onImageFilesSelected = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0 || isGenerating || isExporting) {
      return;
    }

    const nextFiles = Array.from(files).filter((file) =>
      (file.type || "").toLowerCase().startsWith("image/"),
    );

    if (nextFiles.length === 0) {
      setStatusMessage("Select image files only.");
      return;
    }

    try {
      const imageAssets = await createImageAssetsFromFiles(nextFiles);

      setProject((previous) => ({
        ...previous,
        imageAssets: [...previous.imageAssets, ...imageAssets],
      }));
      setStatusMessage(`Added ${imageAssets.length} image asset${imageAssets.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to load image files.");
    }
  };

  const onRemoveImageAsset = (assetId: string): void => {
    setProject((previous) => ({
      ...previous,
      imageAssets: previous.imageAssets.filter((asset) => asset.id !== assetId),
      scenes: previous.scenes.map((scene) =>
        scene.imageAssetId === assetId ? { ...scene, imageAssetId: undefined } : scene,
      ),
    }));
  };

  const onUseImageInAllScenes = (assetId: string): void => {
    setProject((previous) => ({
      ...previous,
      scenes: previous.scenes.map((scene) => ({
        ...scene,
        imageAssetId: assetId,
      })),
    }));
    setStatusMessage("Applied image to all scenes.");
  };

  const loadTemplate = (template: TextMotionTemplate): void => {
    if (isGenerating || isExporting) {
      return;
    }

    const definition = getTextMotionTemplateDefinition(template);
    setProject(
      mergeTemplateProject({
        nextProject: definition.createProject(safeProject.aspect),
        safeProject,
        applyFirstImageToAllScenes: definition.applyFirstImageToAllScenes,
      }),
    );
    setStatusMessage(definition.statusMessage);
  };

  const onGenerate = async (
    promptOverride?: string,
    signal?: AbortSignal,
  ): Promise<TextMotionActionResult> => {
    const nextPrompt = (promptOverride ?? prompt).trim();
    if (nextPrompt.length < 3) {
      return { ok: false, message: "A prompt of at least 3 characters is required." };
    }
    if (isGenerating) {
      return { ok: false, message: "Generation is already in progress." };
    }

    setIsGenerating(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/text-motion/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: nextPrompt,
          aspect: safeProject.aspect,
          template: safeProject.template,
        }),
        signal,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Failed to generate motion script.",
        );
      }

      if (!payload?.project) {
        throw new Error("Generation response missing project.");
      }

      setProject(
        mergeGeneratedProject({
          generatedProject: payload.project as TextMotionProject,
          safeProject,
          template: safeProject.template,
        }),
      );
      const message = "New text motion storyboard generated.";
      setStatusMessage(message);
      return { ok: true, message };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed.";
      setStatusMessage(message);
      return { ok: false, message };
    } finally {
      setIsGenerating(false);
    }
  };

  const onExport = async (signal?: AbortSignal): Promise<TextMotionActionResult> => {
    if (isExporting) {
      return { ok: false, message: "Export is already in progress." };
    }

    setIsExporting(true);
    setStatusMessage(null);

    try {
      const capabilities = detectElahBrowserCapabilities();
      if (!capabilities.ready.videoExport) {
        throw new Error(
          `This browser cannot export video yet. Missing: ${capabilities.missing.videoExport.join(", ")}.`,
        );
      }

      await exportElahProjectInBrowser(toElahTextMotionProject(safeProject), {
        filename: `text-motion-${safeProject.aspect}-${Date.now()}.mp4`,
        signal,
        onProgress: ({ frame, totalFrames }) => {
          const percent = totalFrames > 0 ? Math.round((frame / totalFrames) * 100) : 0;
          setStatusMessage(`Rendering locally in Elah… ${percent}%`);
        },
      });

      const message = "Text motion video exported.";
      setStatusMessage(message);
      return { ok: true, message };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed.";
      setStatusMessage(message);
      return { ok: false, message };
    } finally {
      setIsExporting(false);
    }
  };

  const updateTheme = (
    patch: Partial<TextMotionProject["theme"]>,
  ) => {
    setProject((previous) => ({
      ...previous,
      theme: {
        ...previous.theme,
        ...patch,
      },
    }));
  };

  const updateScene = (sceneId: string, patch: Partial<TextMotionScene>) => {
    setProject((previous) => ({
      ...previous,
      scenes: previous.scenes.map((item) =>
        item.id === sceneId ? { ...item, ...patch } : item,
      ),
    }));
  };

  const removeScene = (sceneId: string) => {
    setProject((previous) => ({
      ...previous,
      scenes:
        previous.scenes.length > 1
          ? previous.scenes.filter((item) => item.id !== sceneId)
          : previous.scenes,
    }));
  };

  const addScene = () => {
    if (safeProject.scenes.length >= MAX_TEXT_MOTION_SCENE_COUNT) {
      setStatusMessage(
        `Reached the maximum of ${MAX_TEXT_MOTION_SCENE_COUNT} scenes for the ${Math.round(
          MAX_TEXT_MOTION_DURATION_FRAMES / TEXT_MOTION_FPS,
        )}-second export limit.`,
      );
      return;
    }

    setProject((previous) => ({
      ...previous,
      scenes: [...previous.scenes, createTextMotionScene()],
    }));
  };

  const updatePrompt = (nextPrompt: string) => {
    setPrompt(nextPrompt);
    setStatusMessage(null);
  };

  return {
    durationInFrames,
    imageAssetMap,
    isExporting,
    isGenerating,
    loadTemplate,
    onExport,
    onGenerate,
    onImageFilesSelected,
    onRemoveImageAsset,
    onUseImageInAllScenes,
    prompt,
    safeProject,
    setPrompt: updatePrompt,
    setProject,
    statusMessage,
    updateScene,
    removeScene,
    addScene,
    updateTheme,
    setStatusMessage,
    templateDefinitions: TEXT_MOTION_TEMPLATE_DEFINITIONS,
  };
};
