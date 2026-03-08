"use client";

import type { AIChatEditorContext } from "@/components/editor/AIChatDrawer";
import type { AIEditorActions } from "@/lib/editor/ai-actions";
import { FPS, MAX_DURATION_FRAMES } from "@/lib/editor/constants";
import {
  createDefaultAudioTrack,
  createDefaultClip,
  createDefaultTextOverlay,
  createInitialProjectSession,
} from "@/lib/editor/defaults";
import { editorReducer } from "@/lib/editor/reducer";
import { isSupportedImageMimeType, assetKindFromMimeType } from "@/lib/editor/schema";
import { getTemplateDefinition } from "@/lib/editor/templates";
import { collectUsedAssetIds, getTimelineDurationInFrames } from "@/lib/editor/timeline";
import type { AspectPreset, ExportProject } from "@/lib/editor/types";
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
  toAssetRef,
} from "./editor-session-config";
import type { ExportActionResult, LocalAsset } from "./editor-session-types";

export const useEditorSession = () => {
  const searchParams = useSearchParams();
  const [project, dispatch] = useReducer(editorReducer, undefined, createInitialProjectSession);
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

    let nextSelectedOverlayId: string | null = null;

    for (const aspect of ALL_ASPECTS) {
      const overlayId = nanoid(10);

      dispatch({
        type: "add-text-overlay",
        aspect,
        overlay: {
          ...createDefaultTextOverlay(overlayId),
          text: initialTemplate.sampleText,
          x: styleDefaults.x,
          y: styleDefaults.y,
          fontSize: styleDefaults.fontSize,
          color: styleDefaults.color,
          fontFamily: styleDefaults.fontFamily,
          fontWeight: styleDefaults.fontWeight,
          fontStyle: styleDefaults.fontStyle,
          stylePreset: initialTemplate.stylePreset,
        },
      });

      if (aspect === activeAspect) {
        nextSelectedOverlayId = overlayId;
      }
    }

    setSelectedTextId(nextSelectedOverlayId);
    setSelectedClipId(null);
    setSelectedAudioId(null);
    setStatusMessage(
      `Template ready: ${initialTemplate.name}. Upload media and adjust text (works in 9:16 and 16:9).`,
    );
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
      Object.fromEntries(assetList.map((asset) => [asset.assetId, asset.objectUrl])) as Record<
        string,
        string
      >,
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

  const onExport = async (): Promise<ExportActionResult> => {
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
        const message = `Missing file for asset ${usedAssetId}. Re-upload media.`;
        setStatusMessage(message);
        return { ok: false, message };
      }
    }

    setIsExporting(true);
    setStatusMessage(null);

    try {
      const payload: ExportProject = {
        activeVersion: currentProject.activeVersion,
        versions: currentProject.versions,
        assets: Object.values(currentAssets).map(toAssetRef),
      };

      const formData = new FormData();
      formData.append("project", JSON.stringify(payload));

      for (const asset of Object.values(currentAssets)) {
        formData.append(
          "assets",
          asset.file,
          `${asset.assetId}__${sanitizeUploadFilename(asset.name)}`,
        );
      }

      const response = await fetch("/api/export", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const message =
          errorPayload && typeof errorPayload.error === "string"
            ? errorPayload.error
            : "Export failed.";

        throw new Error(message);
      }

      const renderedVideo = await response.blob();
      const url = URL.createObjectURL(renderedVideo);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${currentProject.activeVersion}-${Date.now()}.mp4`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      const message = "Video rendered successfully and download started.";
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

  return {
    activeAspect,
    activeVersion,
    assetList,
    assetNames,
    editorChatContext,
    isExporting,
    onApplyEditorActions,
    onExport,
    onFilesSelected,
    onRemoveAsset,
    previewAssetSources,
    remainingFrames,
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
    dispatch,
    activeMediaFootprintBytes: assetList.reduce((sum, asset) => sum + asset.size, 0),
  };
};
