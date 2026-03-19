import {
  MAX_SCENE_DURATION_FRAMES,
  MAX_TEXT_MOTION_SCENE_COUNT,
  MAX_TEXT_MOTION_DURATION_FRAMES,
  MIN_SCENE_DURATION_FRAMES,
} from "./constants";
import type { TextMotionProject, TextMotionTemplate } from "./types";

const normalizeTemplate = (value: unknown): TextMotionTemplate => {
  if (value === "grid-kinetic" || value === "photo-card") {
    return value;
  }

  return "default";
};

const toSafeInt = (value: number, fallback: number): number => {
  const normalized = Number.isFinite(value) ? value : fallback;
  return Math.round(normalized);
};

export const clampDuration = (frames: number): number => {
  return Math.max(
    MIN_SCENE_DURATION_FRAMES,
    Math.min(MAX_SCENE_DURATION_FRAMES, toSafeInt(frames, MIN_SCENE_DURATION_FRAMES)),
  );
};

const normalizeFontFamily = (
  value: unknown,
): "sans" | "serif" | "mono" | "display" | "condensed" | "slab" | "modern" => {
  if (
    value === "serif" ||
    value === "mono" ||
    value === "display" ||
    value === "condensed" ||
    value === "slab" ||
    value === "modern"
  ) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "sans-serif") return "sans";
    if (normalized === "monospace") return "mono";
    if (normalized === "slab-serif") return "slab";
  }

  return "sans";
};

const normalizeFontStyle = (value: unknown): "normal" | "italic" =>
  value === "italic" ? "italic" : "normal";

const normalizeFontWeight = (value: unknown): number => {
  const numeric = typeof value === "number" ? value : 700;
  const rounded = Math.round(numeric / 100) * 100;
  return Math.max(100, Math.min(900, rounded));
};

const normalizeKeepOnScreen = (value: unknown): boolean => value === true;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const normalizeSceneImageAssetId = (
  value: unknown,
  validImageAssetIds: Set<string>,
): string | undefined => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return validImageAssetIds.has(value) ? value : undefined;
};

const fitScenesWithinDuration = (
  scenes: TextMotionProject["scenes"],
): TextMotionProject["scenes"] => {
  const limitedScenes = scenes.slice(0, MAX_TEXT_MOTION_SCENE_COUNT);
  const totalFrames = limitedScenes.reduce(
    (sum, scene) => sum + scene.durationInFrames,
    0,
  );

  if (totalFrames <= MAX_TEXT_MOTION_DURATION_FRAMES) {
    return limitedScenes;
  }

  const minimumTotalFrames = limitedScenes.length * MIN_SCENE_DURATION_FRAMES;
  if (minimumTotalFrames >= MAX_TEXT_MOTION_DURATION_FRAMES) {
    return limitedScenes.map((scene) => ({
      ...scene,
      durationInFrames: MIN_SCENE_DURATION_FRAMES,
    }));
  }

  const availableExtraFrames =
    MAX_TEXT_MOTION_DURATION_FRAMES - minimumTotalFrames;
  const totalHeadroom = totalFrames - minimumTotalFrames;
  const allocations = limitedScenes.map((scene, index) => {
    const headroom = scene.durationInFrames - MIN_SCENE_DURATION_FRAMES;
    const scaledHeadroom = (headroom * availableExtraFrames) / totalHeadroom;
    const wholeFrames = Math.min(headroom, Math.floor(scaledHeadroom));

    return {
      fractionalHeadroom: scaledHeadroom - wholeFrames,
      index,
      maxDurationInFrames: scene.durationInFrames,
      nextDurationInFrames: MIN_SCENE_DURATION_FRAMES + wholeFrames,
    };
  });

  let remainingFrames =
    MAX_TEXT_MOTION_DURATION_FRAMES -
    allocations.reduce(
      (sum, allocation) => sum + allocation.nextDurationInFrames,
      0,
    );

  allocations
    .slice()
    .sort((left, right) => {
      if (right.fractionalHeadroom !== left.fractionalHeadroom) {
        return right.fractionalHeadroom - left.fractionalHeadroom;
      }

      if (right.maxDurationInFrames !== left.maxDurationInFrames) {
        return right.maxDurationInFrames - left.maxDurationInFrames;
      }

      return left.index - right.index;
    })
    .forEach((allocation) => {
      if (
        remainingFrames > 0 &&
        allocation.nextDurationInFrames < allocation.maxDurationInFrames
      ) {
        allocation.nextDurationInFrames += 1;
        remainingFrames -= 1;
      }
    });

  return limitedScenes.map((scene, index) => ({
    ...scene,
    durationInFrames:
      allocations[index]?.nextDurationInFrames ?? scene.durationInFrames,
  }));
};

export const sanitizeTextMotionProject = (
  project: TextMotionProject,
): TextMotionProject => {
  const template = normalizeTemplate((project as { template?: unknown }).template);
  const imageAssets = (project.imageAssets ?? [])
    .filter(
      (asset) =>
        asset &&
        typeof asset.id === "string" &&
        asset.id.trim().length > 0 &&
        typeof asset.dataUrl === "string" &&
        asset.dataUrl.trim().length > 0,
    )
    .map((asset) => ({
      id: asset.id,
      name: typeof asset.name === "string" && asset.name.trim().length > 0 ? asset.name : asset.id,
      mimeType:
        typeof asset.mimeType === "string" && asset.mimeType.trim().length > 0
          ? asset.mimeType
          : "image/png",
      dataUrl: asset.dataUrl,
    }));
  const validImageAssetIds = new Set(imageAssets.map((asset) => asset.id));

  const scenes = project.scenes
    .map((scene) => ({
      ...scene,
      text: scene.text.trim(),
      durationInFrames: clampDuration(scene.durationInFrames),
      fontFamily: normalizeFontFamily((scene as { fontFamily?: unknown }).fontFamily),
      fontWeight: normalizeFontWeight((scene as { fontWeight?: unknown }).fontWeight),
      fontStyle: normalizeFontStyle((scene as { fontStyle?: unknown }).fontStyle),
      keepOnScreen: normalizeKeepOnScreen(
        (scene as { keepOnScreen?: unknown }).keepOnScreen,
      ),
      imageAssetId: normalizeSceneImageAssetId(
        (scene as { imageAssetId?: unknown }).imageAssetId,
        validImageAssetIds,
      ),
      imageScale: clamp(
        typeof (scene as { imageScale?: unknown }).imageScale === "number"
          ? (scene as { imageScale: number }).imageScale
          : 1,
        0.2,
        2.5,
      ),
      imageOpacity: clamp(
        typeof (scene as { imageOpacity?: unknown }).imageOpacity === "number"
          ? (scene as { imageOpacity: number }).imageOpacity
          : 0.65,
        0,
        1,
      ),
      imageX: clamp(
        typeof (scene as { imageX?: unknown }).imageX === "number"
          ? (scene as { imageX: number }).imageX
          : 50,
        0,
        100,
      ),
      imageY: clamp(
        typeof (scene as { imageY?: unknown }).imageY === "number"
          ? (scene as { imageY: number }).imageY
          : 50,
        0,
        100,
      ),
    }))
    .filter((scene) => scene.text.length > 0);

  if (scenes.length === 0) {
    return {
      ...project,
      template,
      imageAssets,
      scenes: [
        {
          id: "scene-fallback",
          text: "Add your first text scene.",
          durationInFrames: MIN_SCENE_DURATION_FRAMES * 2,
          animation: "fade",
          fontFamily: "sans",
          fontWeight: 700,
          fontStyle: "normal",
          keepOnScreen: false,
          imageScale: 1,
          imageOpacity: 0.65,
          imageX: 50,
          imageY: 50,
        },
      ],
    };
  }

  const fittedScenes = fitScenesWithinDuration(scenes);

  return {
    ...project,
    template,
    imageAssets,
    scenes: fittedScenes,
  };
};

export const getTextMotionDurationInFrames = (
  project: TextMotionProject,
): number => {
  const total = project.scenes.reduce(
    (sum, scene) => sum + clampDuration(scene.durationInFrames),
    0,
  );

  return Math.max(1, Math.min(MAX_TEXT_MOTION_DURATION_FRAMES, total));
};
