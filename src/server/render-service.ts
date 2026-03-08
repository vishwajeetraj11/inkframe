import type { ExportProjectInput } from "@/lib/editor/schema";
import type { AspectPreset } from "@/lib/editor/types";
import { MAX_DURATION_FRAMES } from "@/lib/editor/constants";
import { getVersionRenderDurationInFrames } from "@/lib/editor/timeline";
import { getTextMotionDurationInFrames } from "@/lib/text-motion/utils";
import type { TextMotionProject } from "@/lib/text-motion/types";
import type { EditorCompositionProps } from "@/remotion/EditorComposition";
import type { TextMotionCompositionProps } from "@/remotion/TextMotionComposition";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "node:path";

let serveUrlPromise: Promise<string> | null = null;

const EDITOR_COMPOSITION_ID_BY_ASPECT: Record<AspectPreset, string> = {
  reel_9_16: "reel-9-16",
  widescreen_16_9: "widescreen-16-9",
};

const TEXT_MOTION_COMPOSITION_ID_BY_ASPECT: Record<AspectPreset, string> = {
  reel_9_16: "text-motion-reel-9-16",
  widescreen_16_9: "text-motion-widescreen-16-9",
};

const getEditorRenderDurationInFrames = (
  project: ExportProjectInput,
): number => {
  const version = project.versions[project.activeVersion];
  const duration = getVersionRenderDurationInFrames(version);
  return Math.max(1, Math.min(MAX_DURATION_FRAMES, duration));
};

const getServeUrl = async (): Promise<string> => {
  if (!serveUrlPromise) {
    serveUrlPromise = bundle({
      entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
    }).catch((error) => {
      // Allow follow-up requests to re-attempt bundling after a transient or stale failure.
      serveUrlPromise = null;
      throw error;
    });
  }

  try {
    return await serveUrlPromise;
  } catch (error) {
    serveUrlPromise = null;
    throw error;
  }
};

export const renderProjectToFile = async ({
  project,
  assetSources,
  outputLocation,
}: {
  project: ExportProjectInput;
  assetSources: Record<string, string>;
  outputLocation: string;
}): Promise<void> => {
  const serveUrl = await getServeUrl();
  const version = project.versions[project.activeVersion];
  const durationInFrames = getEditorRenderDurationInFrames(project);

  const inputProps: EditorCompositionProps = {
    version,
    assetSources,
    renderMode: "render",
  };

  const composition = await selectComposition({
    serveUrl,
    id: EDITOR_COMPOSITION_ID_BY_ASPECT[project.activeVersion],
    inputProps,
    logLevel: "error",
  });

  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    inputProps,
    outputLocation,
    overwrite: true,
    logLevel: "error",
    frameRange: [0, Math.max(0, durationInFrames - 1)],
  });
};

export const renderTextMotionProjectToFile = async ({
  project,
  outputLocation,
}: {
  project: TextMotionProject;
  outputLocation: string;
}): Promise<void> => {
  const serveUrl = await getServeUrl();
  const inputProps: TextMotionCompositionProps = {
    project,
  };

  const compositionId = TEXT_MOTION_COMPOSITION_ID_BY_ASPECT[project.aspect];
  const durationInFrames = getTextMotionDurationInFrames(project);

  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps,
    logLevel: "error",
  });

  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    inputProps,
    outputLocation,
    overwrite: true,
    logLevel: "error",
    frameRange: [0, Math.max(0, durationInFrames - 1)],
  });
};
