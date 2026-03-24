"use client";

import {
  getFilenameFromContentDisposition,
  isExportDownloadPayload,
  triggerBrowserDownload,
} from "@/lib/export/download";
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
import type { TextMotionCompositionProps } from "@/remotion/TextMotionComposition";
import {
  createImageAssetsFromFiles,
  createTextMotionScene,
  mergeGeneratedProject,
  mergeTemplateProject,
} from "./text-motion-project-helpers";

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
  const inputProps = useMemo<TextMotionCompositionProps>(
    () => ({ project: safeProject }),
    [safeProject],
  );
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

  const onGenerate = async (): Promise<void> => {
    const nextPrompt = prompt.trim();
    if (nextPrompt.length < 3 || isGenerating) {
      return;
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
      setStatusMessage("New text motion storyboard generated.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const onExport = async (): Promise<void> => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/text-motion/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ project: safeProject }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Failed to export text motion video.",
        );
      }

      const contentType = response.headers.get("Content-Type") ?? "";

      if (contentType.includes("application/json")) {
        const payload = await response.json().catch(() => null);

        if (!isExportDownloadPayload(payload)) {
          throw new Error("Export finished, but the download link was malformed.");
        }

        triggerBrowserDownload({
          url: payload.downloadUrl,
          filename: payload.filename,
        });
      } else {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const filename =
          getFilenameFromContentDisposition(
            response.headers.get("Content-Disposition"),
          ) ?? `text-motion-${safeProject.aspect}.mp4`;
        triggerBrowserDownload({
          url,
          filename,
        });
        URL.revokeObjectURL(url);
      }

      setStatusMessage("Text motion video exported.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Export failed.");
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

  return {
    durationInFrames,
    imageAssetMap,
    inputProps,
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
    setPrompt,
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
