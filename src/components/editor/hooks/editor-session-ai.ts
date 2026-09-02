import type { AIEditorActions } from "@/lib/editor/ai-actions";
import { FPS } from "@/lib/editor/constants";
import { buildRenderTrack } from "@/lib/editor/timeline";
import type { AspectPreset, ProjectSession, VersionTimeline } from "@/lib/editor/types";
import { nanoid } from "nanoid";
import {
  fitSceneFramesToBudget,
  getAdaptiveFontSize,
  getPresetPositionFallback,
  normalizeFontWeight,
  OVERLAY_DEFAULTS_BY_PRESET,
  secondsToFrames,
  STYLE_PRESET_SEQUENCE,
} from "./editor-session-config";
import type { LocalAsset } from "./editor-session-types";

interface ApplyAIEditorActionsFailure {
  ok: false;
  message: string;
}

export interface ApplyAIEditorActionsSuccess {
  ok: true;
  message: string;
  targetAspect: AspectPreset;
  nextVersion: VersionTimeline;
  selectedClipId: string | null;
  selectedTextId: string | null;
}

export type ApplyAIEditorActionsResult =
  | ApplyAIEditorActionsFailure
  | ApplyAIEditorActionsSuccess;

export const applyAIEditorActions = ({
  actions,
  currentProject,
  currentAssets,
}: {
  actions: AIEditorActions;
  currentProject: ProjectSession;
  currentAssets: Record<string, LocalAsset>;
}): ApplyAIEditorActionsResult => {
  const targetAspect: AspectPreset =
    actions.targetAspect && actions.targetAspect !== "active"
      ? actions.targetAspect
      : currentProject.activeVersion;

  const targetVersion = currentProject.versions[targetAspect];
  const visualAssets = Object.values(currentAssets).filter(
    (asset) => asset.kind === "video" || asset.kind === "image",
  );

  let chosenVisualAsset =
    targetVersion.clips.length > 0 ? currentAssets[targetVersion.clips[0].assetId] : undefined;

  if (!chosenVisualAsset) {
    chosenVisualAsset = visualAssets[0];
  }

  if (actions.assetNameHint) {
    const normalizedHint = actions.assetNameHint.trim().toLowerCase();
    const matchedByName = visualAssets.find((asset) =>
      asset.name.toLowerCase().includes(normalizedHint),
    );

    if (matchedByName) {
      chosenVisualAsset = matchedByName;
    }
  }

  if (
    chosenVisualAsset &&
    chosenVisualAsset.kind !== "video" &&
    chosenVisualAsset.kind !== "image"
  ) {
    return {
      ok: false,
      message: "AI could not resolve a visual asset for the timeline.",
    };
  }

  const scenes = actions.scenes.filter((scene) => scene.text.trim().length > 0);
  if (scenes.length === 0) {
    return {
      ok: false,
      message: "AI did not provide any valid scenes to apply.",
    };
  }

  const requestedFrames = scenes.map((scene) =>
    scene.durationSeconds ? secondsToFrames(scene.durationSeconds) : 4 * FPS,
  );
  const sceneFrames = fitSceneFramesToBudget(requestedFrames);

  let cursor = 0;
  const clips = chosenVisualAsset
    ? scenes.map((_, index) => {
        const durationInFrames = sceneFrames[index];
        const clip = {
          id: nanoid(10),
          assetId: chosenVisualAsset.assetId,
          kind: chosenVisualAsset.kind,
          startFrame: cursor,
          endFrame: cursor + durationInFrames,
          trimStartFrame: 0,
          trimEndFrame: durationInFrames,
          volume: 1,
        } as VersionTimeline["clips"][number];

        cursor += durationInFrames;
        return clip;
      })
    : [];

  const requestedTransitionFrames =
    actions.transitionSeconds === undefined
      ? 0
      : Math.max(0, secondsToFrames(actions.transitionSeconds));
  const usesSingleVisualAsset =
    new Set(clips.map((clip) => `${clip.kind}:${clip.assetId}`)).size <= 1;
  const transitionFrames = usesSingleVisualAsset ? 0 : requestedTransitionFrames;

  const transitions =
    transitionFrames > 0
      ? clips.slice(0, -1).map((clip, index) => ({
          id: nanoid(10),
          type: "crossfade" as const,
          fromClipId: clip.id,
          toClipId: clips[index + 1].id,
          durationInFrames: transitionFrames,
        }))
      : [];

  const provisionalVersion: VersionTimeline = {
    ...targetVersion,
    clips,
    transitions,
    textOverlays: [],
  };

  const trackEntries = buildRenderTrack(provisionalVersion).entries;

  const textOverlays = scenes.map((scene, index) => {
    const matchingEntry = trackEntries[index];
    const durationInFrames = matchingEntry?.durationInFrames ?? sceneFrames[index];
    const startFrame =
      matchingEntry?.startFrame ?? sceneFrames.slice(0, index).reduce((sum, value) => sum + value, 0);
    const fallbackStylePreset = STYLE_PRESET_SEQUENCE[index % STYLE_PRESET_SEQUENCE.length];
    const resolvedStylePreset = scene.stylePreset ?? fallbackStylePreset;
    const styleDefaults = OVERLAY_DEFAULTS_BY_PRESET[resolvedStylePreset];
    const fallbackPosition = getPresetPositionFallback(resolvedStylePreset, index);
    const fontSize = scene.fontSize
      ? Math.round(scene.fontSize)
      : getAdaptiveFontSize(styleDefaults.fontSize, scene.text);
    const requestedFontFamily = scene.fontFamily ?? styleDefaults.fontFamily;
    const readableFontFamily = requestedFontFamily === "cursive" ? "sans" : requestedFontFamily;
    const estimatedLineCount = Math.max(
      1,
      Math.ceil(scene.text.trim().split(/\s+/).filter(Boolean).length / 3),
    );
    const maxSafeY = Math.max(58, 80 - (estimatedLineCount - 1) * 6);
    const motionSequence = ["punch", "rise", "slide-left", "word-reveal"] as const;
    const defaultMotion = motionSequence[index % motionSequence.length];

    return {
      id: nanoid(10),
      text: scene.text,
      startFrame,
      endFrame: startFrame + durationInFrames,
      x: Math.min(Math.max(scene.x ?? fallbackPosition.x, 12), 88),
      y: Math.min(Math.max(scene.y ?? fallbackPosition.y, 16), maxSafeY),
      fontSize: Math.min(Math.max(fontSize, 32), 170),
      color: scene.color ?? styleDefaults.color,
      fontFamily: readableFontFamily,
      fontWeight: normalizeFontWeight(scene.fontWeight ?? styleDefaults.fontWeight),
      fontStyle: scene.fontStyle ?? styleDefaults.fontStyle,
      textAlign: scene.textAlign ?? "center",
      animation: {
        in: scene.animation?.in ?? defaultMotion,
        out: scene.animation?.out ?? "fade",
        durationFrames: secondsToFrames(scene.animation?.durationSeconds ?? 0.4),
      },
      stylePreset: resolvedStylePreset,
      createdaleyTexture:
        resolvedStylePreset === "editorial-seat-arc" ? "warm-editorial" : "plain",
    } satisfies VersionTimeline["textOverlays"][number];
  });

  return {
    ok: true,
    message: `Applied AI edit with ${scenes.length} scenes.`,
    targetAspect,
    nextVersion: {
      ...targetVersion,
      clips,
      textOverlays,
      transitions,
    },
    selectedClipId: clips[0]?.id ?? null,
    selectedTextId: textOverlays[0]?.id ?? null,
  };
};
