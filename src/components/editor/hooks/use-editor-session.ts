"use client";

import type { AIChatEditorContext } from "@/components/editor/AIChatDrawer";
import type { AIEditorActions } from "@/lib/editor/ai-actions";
import {
  DEFAULT_CLIP_DURATION_FRAMES,
  FPS,
  MAX_DURATION_FRAMES,
} from "@/lib/editor/constants";
import {
  createDefaultAudioTrack,
  createDefaultClip,
  createDefaultTextOverlay,
} from "@/lib/editor/defaults";
import { exportElahProjectInBrowser } from "@/lib/export/elah-browser";
import { toElahProject } from "@/lib/editor/elah-adapter";
import { detectElahBrowserCapabilities } from "@/lib/editor/elah-browser-capabilities";
import {
  createInitialEditorHistory,
  editorHistoryReducer,
} from "@/lib/editor/history";
import {
  getSoundEffectById,
  getSoundEffectDataUrl,
  type SoundEffectId,
} from "@/lib/editor/sound-effects";
import { isSupportedImageMimeType, assetKindFromMimeType } from "@/lib/editor/schema";
import { getTemplateDefinition } from "@/lib/editor/templates";
import { collectUsedAssetIds, getTimelineDurationInFrames } from "@/lib/editor/timeline";
import type { AspectPreset } from "@/lib/editor/types";
import { useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { applyAIEditorActions } from "./editor-session-ai";
import {
  ALL_ASPECTS,
  getAssetTooLargeMessage,
  OVERLAY_DEFAULTS_BY_PRESET,
  sanitizeUploadFilename,
} from "./editor-session-config";
import type { ExportActionResult, LocalAsset } from "./editor-session-types";

const getStarterAssetFilename = (publicPath: string): string => {
  const filename = publicPath.split("/").filter(Boolean).pop();
  return filename ? sanitizeUploadFilename(filename) : "starter-asset";
};

export const useEditorSession = () => {
  const searchParams = useSearchParams();
  const [history, dispatch] = useReducer(
    editorHistoryReducer,
    undefined,
    createInitialEditorHistory,
  );
  const project = history.present;
  const [assets, setAssets] = useState<Record<string, LocalAsset>>({});
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const objectUrlsRef = useRef<Set<string>>(new Set());
  const hasHydratedTemplateRef = useRef(false);
  const projectRef = useRef(project);
  const assetsRef = useRef(assets);

  projectRef.current = project;
  assetsRef.current = assets;

  const activeAspect = project.activeVersion;
  const activeVersion = project.versions[activeAspect];
  const templateParam = searchParams.get("template");
  const initialTemplate = getTemplateDefinition(templateParam);

  useEffect(() => {
    setSelectedClipId(null);
    setSelectedTextId(null);
    setSelectedAudioId(null);
  }, [activeAspect]);

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    return () => {
      for (const url of objectUrls) {
        URL.revokeObjectURL(url);
      }
      objectUrls.clear();
    };
  }, []);

  useEffect(() => {
    if (hasHydratedTemplateRef.current) {
      return;
    }

    hasHydratedTemplateRef.current = true;

    if (!initialTemplate) {
      return;
    }

    const styleDefaults = OVERLAY_DEFAULTS_BY_PRESET[initialTemplate.stylePreset];
    const starterAssets =
      initialTemplate.starterAssets?.map((asset) => ({
        assetId: nanoid(10),
        asset,
      })) ?? [];
    let cancelled = false;
    const templateDurationInFrames = Math.max(
      DEFAULT_CLIP_DURATION_FRAMES,
      starterAssets.length * DEFAULT_CLIP_DURATION_FRAMES,
    );

    let nextSelectedOverlayId: string | null = null;
    let nextAssets: Record<string, LocalAsset> | null = null;

    if (starterAssets.length > 0) {
      nextAssets = Object.fromEntries(
        starterAssets.map(({ asset, assetId }) => [
          assetId,
          {
            assetId,
            kind: asset.kind,
            mimeType: asset.mimeType,
            name: asset.name,
            size: 0,
            externalUrl: new URL(asset.publicPath, window.location.origin).toString(),
          } satisfies LocalAsset,
        ]),
      );
    }

    for (const aspect of ALL_ASPECTS) {
      const overlayId = nanoid(10);

      dispatch({
        type: "add-text-overlay",
        aspect,
        overlay: {
          ...createDefaultTextOverlay(overlayId),
          text: initialTemplate.sampleText,
          endFrame: templateDurationInFrames,
          x: styleDefaults.x,
          y: styleDefaults.y,
          fontSize: styleDefaults.fontSize,
          color: styleDefaults.color,
          fontFamily: styleDefaults.fontFamily,
          fontWeight: styleDefaults.fontWeight,
          fontStyle: styleDefaults.fontStyle,
          stylePreset: initialTemplate.stylePreset,
          createdaleyTexture:
            initialTemplate.stylePreset === "editorial-seat-arc"
              ? "warm-editorial"
              : "plain",
        },
      });

      if (aspect === activeAspect) {
        nextSelectedOverlayId = overlayId;
      }

      for (const { assetId, asset } of starterAssets) {
        if (asset.kind !== "image") {
          continue;
        }

        const clipId = nanoid(10);

        dispatch({
          type: "add-clip",
          aspect,
          clip: {
            ...createDefaultClip(clipId, assetId, "image"),
            endFrame: DEFAULT_CLIP_DURATION_FRAMES,
            trimEndFrame: DEFAULT_CLIP_DURATION_FRAMES,
          },
        });
      }
    }

    if (nextAssets) {
      setAssets((previous) => ({
        ...previous,
        ...nextAssets,
      }));
    }

    setSelectedTextId(nextSelectedOverlayId);
    setSelectedClipId(null);
    setSelectedAudioId(null);
    setStatusMessage(`Template ready: ${initialTemplate.name}.`);

    if (starterAssets.length === 0) {
      return;
    }

    void (async () => {
      try {
        const loadedAssets = await Promise.all(
          starterAssets.map(async ({ assetId, asset }) => {
            const response = await fetch(asset.publicPath);

            if (!response.ok) {
              throw new Error(`Failed to load starter asset ${asset.publicPath}.`);
            }

            const blob = await response.blob();
            const file = new File([blob], getStarterAssetFilename(asset.publicPath), {
              type: asset.mimeType || blob.type,
            });
            const objectUrl = URL.createObjectURL(file);

            return [
              assetId,
              {
                assetId,
                kind: asset.kind,
                mimeType: asset.mimeType,
                name: asset.name,
                size: file.size,
                file,
                objectUrl,
              } satisfies LocalAsset,
            ] as const;
          }),
        );

        if (cancelled) {
          for (const [, asset] of loadedAssets) {
            if (asset.objectUrl) {
              URL.revokeObjectURL(asset.objectUrl);
            }
          }
          return;
        }

        for (const [, asset] of loadedAssets) {
          if (asset.objectUrl) {
            objectUrlsRef.current.add(asset.objectUrl);
          }
        }

        setAssets((previous) => ({
          ...previous,
          ...Object.fromEntries(loadedAssets),
        }));
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setStatusMessage(`Template media could not be loaded for ${initialTemplate.name}.`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeAspect, initialTemplate]);

  const timelineDurationInFrames = useMemo(
    () => getTimelineDurationInFrames(activeVersion),
    [activeVersion],
  );
  const remainingFrames = Math.max(0, MAX_DURATION_FRAMES - timelineDurationInFrames);
  const assetList = useMemo(() => Object.values(assets), [assets]);
  const editorChatContext = useMemo<AIChatEditorContext>(
    () => ({
      activeAspect,
      timelineDurationInFrames,
      timelineDurationSeconds: timelineDurationInFrames / FPS,
      clipCount: activeVersion.clips.length,
      textOverlayCount: activeVersion.textOverlays.length,
      audioTrackCount: activeVersion.audioTracks.length,
      assetCount: assetList.length,
    }),
    [
      activeAspect,
      timelineDurationInFrames,
      activeVersion.clips.length,
      activeVersion.textOverlays.length,
      activeVersion.audioTracks.length,
      assetList.length,
    ],
  );

  const assetNames = useMemo(
    () =>
      Object.fromEntries(assetList.map((asset) => [asset.assetId, asset.name])) as Record<
        string,
        string
      >,
    [assetList],
  );

  const previewAssetSources = useMemo(
    () =>
      Object.fromEntries(
        assetList
          .map((asset) => [asset.assetId, asset.objectUrl ?? asset.externalUrl] as const)
          .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
      ) as Record<string, string>,
    [assetList],
  );

  const selectedClip = activeVersion.clips.find((clip) => clip.id === selectedClipId) ?? null;
  const selectedTextOverlay =
    activeVersion.textOverlays.find((overlay) => overlay.id === selectedTextId) ?? null;
  const selectedAudioTrack =
    activeVersion.audioTracks.find((track) => track.id === selectedAudioId) ?? null;

  const onFilesSelected = (files: FileList | null): void => {
    if (!files || files.length === 0) {
      return;
    }

    const rejectedMessages: string[] = [];
    const acceptedAssets: Record<string, LocalAsset> = {};

    let latestClipId: string | null = null;
    let latestAudioId: string | null = null;

    for (const file of Array.from(files)) {
      const kind = assetKindFromMimeType(file.type);

      if (!kind) {
        rejectedMessages.push(`Unsupported file type for ${file.name}.`);
        continue;
      }

      if (kind === "image" && file.type && !isSupportedImageMimeType(file.type)) {
        rejectedMessages.push(`Image ${file.name} must be JPG, PNG, or WEBP.`);
        continue;
      }

      const tooLargeMessage = getAssetTooLargeMessage(file.name, kind, file.size);
      if (tooLargeMessage) {
        rejectedMessages.push(tooLargeMessage);
        continue;
      }

      const assetId = nanoid(10);
      const objectUrl = URL.createObjectURL(file);
      objectUrlsRef.current.add(objectUrl);

      acceptedAssets[assetId] = {
        assetId,
        kind,
        mimeType: file.type || "application/octet-stream",
        name: file.name,
        size: file.size,
        file,
        objectUrl,
      };

      if (kind === "video" || kind === "image") {
        for (const aspect of ALL_ASPECTS) {
          const clipId = nanoid(10);
          dispatch({
            type: "add-clip",
            aspect,
            clip: createDefaultClip(clipId, assetId, kind),
          });

          if (aspect === activeAspect) {
            latestClipId = clipId;
          }
        }
      }

      if (kind === "audio") {
        const trackId = nanoid(10);
        latestAudioId = trackId;
        dispatch({
          type: "add-audio-track",
          aspect: activeAspect,
          track: createDefaultAudioTrack(trackId, assetId),
        });
      }
    }

    if (Object.keys(acceptedAssets).length > 0) {
      setAssets((previous) => ({
        ...previous,
        ...acceptedAssets,
      }));
    }

    if (latestClipId) {
      setSelectedClipId(latestClipId);
      setSelectedTextId(null);
      setSelectedAudioId(null);
    } else if (latestAudioId) {
      setSelectedAudioId(latestAudioId);
      setSelectedTextId(null);
      setSelectedClipId(null);
    }

    setStatusMessage(rejectedMessages.length > 0 ? rejectedMessages.join(" ") : null);
  };

  const onAddSoundEffect = (
    effectId: SoundEffectId,
    targetAspect: AspectPreset = activeAspect,
  ): void => {
    if (isExporting) {
      return;
    }

    const effect = getSoundEffectById(effectId);

    if (!effect) {
      setStatusMessage("Could not find that sound effect.");
      return;
    }

    const assetId = nanoid(10);
    const trackId = nanoid(10);

    setAssets((previous) => ({
      ...previous,
      [assetId]: {
        assetId,
        kind: "audio",
        mimeType: "audio/wav",
        name: effect.label,
        size: 0,
        externalUrl: getSoundEffectDataUrl(effect),
      },
    }));

    dispatch({
      type: "add-audio-track",
      aspect: targetAspect,
      track: {
        ...createDefaultAudioTrack(trackId, assetId),
        endFrame: effect.defaultDurationInFrames,
        trimEndFrame: effect.defaultDurationInFrames,
      },
    });

    setSelectedAudioId(trackId);
    setSelectedClipId(null);
    setSelectedTextId(null);
    setStatusMessage(`Added ${effect.label}.`);
  };

  const onExport = async (signal?: AbortSignal): Promise<ExportActionResult> => {
    const currentProject = projectRef.current;
    const currentAssets = assetsRef.current;
    const currentAspect = currentProject.activeVersion;
    const currentVersion = currentProject.versions[currentAspect];

    if (isExporting) {
      return { ok: false, message: "Render already in progress." };
    }

    const hasRenderableVisual =
      currentVersion.clips.length > 0 || currentVersion.textOverlays.length > 0;

    if (!hasRenderableVisual) {
      const message = "Add a clip or text overlay before export.";
      setStatusMessage(message);
      return { ok: false, message };
    }

    const usedAssetIds = collectUsedAssetIds(currentVersion);
    for (const usedAssetId of usedAssetIds) {
      if (!currentAssets[usedAssetId]) {
        const message = `Missing asset ${usedAssetId}. Re-add the media and try again.`;
        setStatusMessage(message);
        return { ok: false, message };
      }
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

      const assetSources = Object.fromEntries(
        Object.values(currentAssets)
          .map((asset) => [asset.assetId, asset.objectUrl ?? asset.externalUrl] as const)
          .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
      );
      const projection = toElahProject(currentVersion, {
        assets: Object.values(currentAssets),
        assetSources,
        projectId: `inkframe-export-${currentAspect}`,
      });
      const missingSources = projection.diagnostics.filter(
        (diagnostic) => diagnostic.code === "missing-asset-source",
      );
      if (missingSources.length > 0) {
        throw new Error(missingSources[0]?.message ?? "A media source is unavailable.");
      }

      await exportElahProjectInBrowser(projection.project, {
        filename: `inkframe-${currentAspect}-${Date.now()}.mp4`,
        signal,
        onProgress: ({ frame, totalFrames }) => {
          const percent = totalFrames > 0 ? Math.round((frame / totalFrames) * 100) : 0;
          setStatusMessage(`Rendering locally in Elah… ${percent}%`);
        },
      });

      const message = "Video rendered locally and download started.";
      setStatusMessage(message);
      return { ok: true, message };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export video.";
      setStatusMessage(message);
      return { ok: false, message };
    } finally {
      setIsExporting(false);
    }
  };

  const onRemoveAsset = (assetId: string): void => {
    if (isExporting) {
      return;
    }

    const currentProject = projectRef.current;
    const currentAssets = assetsRef.current;
    const targetAsset = currentAssets[assetId];

    if (!targetAsset) {
      return;
    }

    if (targetAsset.objectUrl) {
      URL.revokeObjectURL(targetAsset.objectUrl);
      objectUrlsRef.current.delete(targetAsset.objectUrl);
    }

    let removedClipCount = 0;
    let removedAudioTrackCount = 0;

    for (const aspect of ALL_ASPECTS) {
      const version = currentProject.versions[aspect];
      const nextClips = version.clips.filter((clip) => clip.assetId !== assetId);
      const clipIds = new Set(nextClips.map((clip) => clip.id));
      const nextTransitions = version.transitions.filter(
        (transition) =>
          clipIds.has(transition.fromClipId) && clipIds.has(transition.toClipId),
      );
      const nextAudioTracks = version.audioTracks.filter((track) => track.assetId !== assetId);

      removedClipCount += version.clips.length - nextClips.length;
      removedAudioTrackCount += version.audioTracks.length - nextAudioTracks.length;

      dispatch({
        type: "replace-version",
        aspect,
        version: {
          ...version,
          clips: nextClips,
          transitions: nextTransitions,
          audioTracks: nextAudioTracks,
        },
      });
    }

    setAssets((previous) => {
      const next = { ...previous };
      delete next[assetId];
      return next;
    });

    // Deleted browser assets cannot be reconstructed by project-only history.
    dispatch({ type: "history/clear" });

    if (
      selectedClipId &&
      currentProject.versions[currentProject.activeVersion].clips.some(
        (clip) => clip.id === selectedClipId && clip.assetId === assetId,
      )
    ) {
      setSelectedClipId(null);
    }

    if (
      selectedAudioId &&
      currentProject.versions[currentProject.activeVersion].audioTracks.some(
        (track) => track.id === selectedAudioId && track.assetId === assetId,
      )
    ) {
      setSelectedAudioId(null);
    }

    const removalSummary = [];
    if (removedClipCount > 0) {
      removalSummary.push(`${removedClipCount} clip${removedClipCount === 1 ? "" : "s"}`);
    }
    if (removedAudioTrackCount > 0) {
      removalSummary.push(
        `${removedAudioTrackCount} audio track${removedAudioTrackCount === 1 ? "" : "s"}`,
      );
    }

    const details =
      removalSummary.length > 0
        ? ` and removed ${removalSummary.join(" + ")} from timelines`
        : "";
    setStatusMessage(`Removed asset ${targetAsset.name}${details}.`);
  };

  const onApplyEditorActions = async (
    actions: AIEditorActions,
  ): Promise<ExportActionResult> => {
    const currentProject = projectRef.current;
    const result = applyAIEditorActions({
      actions,
      currentProject,
      currentAssets: assetsRef.current,
    });

    if (!result.ok) {
      return result;
    }

    flushSync(() => {
      dispatch({
        type: "replace-version",
        aspect: result.targetAspect,
        version: result.nextVersion,
      });

      if (result.targetAspect !== currentProject.activeVersion) {
        dispatch({
          type: "switch-aspect",
          aspect: result.targetAspect,
        });
      }
    });

    setSelectedClipId(result.selectedClipId);
    setSelectedTextId(result.selectedTextId);
    setSelectedAudioId(null);
    setStatusMessage(
      `Applied AI edit: ${actions.scenes.filter((scene) => scene.text.trim().length > 0).length} scenes on ${result.targetAspect.replaceAll("_", " ")}.`,
    );
    return result;
  };

  const switchAspect = (aspect: AspectPreset) => {
    dispatch({ type: "switch-aspect", aspect });
  };

  const undo = () => dispatch({ type: "history/undo" });
  const redo = () => dispatch({ type: "history/redo" });

  return {
    history,
    activeAspect,
    activeVersion,
    assetList,
    assetNames,
    editorChatContext,
    isExporting,
    canRedo: history.future.length > 0,
    canUndo: history.past.length > 0,
    onApplyEditorActions,
    onAddSoundEffect,
    onExport,
    onFilesSelected,
    onRemoveAsset,
    previewAssetSources,
    remainingFrames,
    redo,
    selectedAudioId,
    selectedAudioTrack,
    selectedClip,
    selectedClipId,
    selectedTextId,
    selectedTextOverlay,
    setSelectedAudioId,
    setSelectedClipId,
    setSelectedTextId,
    statusMessage,
    switchAspect,
    timelineDurationInFrames,
    undo,
    dispatch,
    activeMediaFootprintBytes: assetList.reduce((sum, asset) => sum + asset.size, 0),
  };
};
