"use client";

import type { AIEditorActions } from "@/lib/editor/ai-actions";
import {
  ASPECT_PRESETS,
  DEFAULT_CLIP_DURATION_FRAMES,
  FPS,
  MAX_DURATION_FRAMES,
} from "@/lib/editor/constants";
import {
  createDefaultAudioTrack,
  createDefaultClip,
  createDefaultTextOverlay,
} from "@/lib/editor/defaults";
import {
  ELAH_BROWSER_EXPORT_PROFILE,
  exportElahProjectInBrowser,
} from "@/lib/export/elah-browser";
import { verifyBrowserVideo } from "@/lib/export/verify-browser-video";
import { toElahProject } from "@/lib/editor/elah-adapter";
import { detectElahBrowserCapabilities } from "@/lib/editor/elah-browser-capabilities";
import {
  createInitialEditorHistory,
  editorHistoryReducer,
} from "@/lib/editor/history";
import { isSupportedImageMimeType, assetKindFromMimeType } from "@/lib/editor/schema";
import { getTemplateDefinition, instantiateTemplate } from "@/lib/editor/templates";
import {
  collectUsedAssetIds,
  getTimelineDurationInFrames,
  getVersionRenderDurationInFrames,
} from "@/lib/editor/timeline";
import {
  getProjectStorageErrorMessage,
  loadProjectSnapshot,
  saveProjectSnapshot,
} from "@/lib/editor/project-storage";
import type { AspectPreset } from "@/lib/editor/types";
import type { AudioUrlImportInput } from "@/lib/editor/webmcp/tools";
import type { LicensedAudioImportInput } from "@/lib/editor/webmcp/tools";
import {
  chooseMp4Rendition,
  importVideoFromUrl,
  type PexelsPhotoResult,
  type PexelsPhotoSearchResult,
  type PexelsVideoRendition,
  type PexelsVideoResult,
  type PexelsVideoSearchResult,
} from "@/lib/pexels";
import type {
  LicensedAudioProvider,
  LicensedAudioResult,
  LicensedAudioSearchResult,
} from "@/lib/stock-audio";
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
import type {
  EditorExportState,
  EditorStorageStatus,
  ExportActionResult,
  LocalAsset,
} from "./editor-session-types";

const EMPTY_EXPORT_STATE: EditorExportState = {
  jobId: null,
  status: "idle",
  progress: 0,
  startedAt: null,
  completedAt: null,
  message: null,
  artifact: null,
};

const getStarterAssetFilename = (publicPath: string): string => {
  const filename = publicPath.split("/").filter(Boolean).pop();
  return filename ? sanitizeUploadFilename(filename) : "starter-asset";
};

const RESTORE_STATUS_MESSAGE = "Restored your last local project.";
const RESTORE_STATUS_DISMISS_MS = 4500;

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
  const [exportState, setExportState] = useState<EditorExportState>(EMPTY_EXPORT_STATE);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [storageStatus, setStorageStatus] = useState<EditorStorageStatus>("loading");

  const objectUrlsRef = useRef<Set<string>>(new Set());
  const hydratedTemplateIdRef = useRef<string | null>(null);
  const projectRef = useRef(project);
  const assetsRef = useRef(assets);
  const exportStateRef = useRef<EditorExportState>(EMPTY_EXPORT_STATE);
  const exportControllerRef = useRef<AbortController | null>(null);
  const exportInFlightRef = useRef(false);
  const exportArtifactUrlRef = useRef<string | null>(null);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const saveGenerationRef = useRef(0);

  useEffect(() => {
    if (statusMessage !== RESTORE_STATUS_MESSAGE) return;

    const timeoutId = window.setTimeout(() => {
      setStatusMessage(null);
    }, RESTORE_STATUS_DISMISS_MS);

    return () => window.clearTimeout(timeoutId);
  }, [statusMessage]);

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
      if (exportArtifactUrlRef.current) {
        URL.revokeObjectURL(exportArtifactUrlRef.current);
        exportArtifactUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (templateParam) {
      setStorageStatus("saved");
      setIsStorageReady(true);
      return;
    }
    let cancelled = false;

    void loadProjectSnapshot()
      .then((snapshot) => {
        if (!snapshot || cancelled) return;

        const restoredAssets: Record<string, LocalAsset> = {};
        for (const asset of snapshot.assets) {
          const objectUrl = asset.blob ? URL.createObjectURL(asset.blob) : undefined;
          if (objectUrl) objectUrlsRef.current.add(objectUrl);
          restoredAssets[asset.assetId] = {
            assetId: asset.assetId,
            kind: asset.kind,
            mimeType: asset.mimeType,
            name: asset.name,
            size: asset.size,
            externalUrl: asset.externalUrl,
            attribution: asset.attribution,
            file: asset.blob
              ? new File([asset.blob], asset.name, { type: asset.mimeType })
              : undefined,
            objectUrl,
          };
        }

        dispatch({
          type: "replace-version",
          aspect: "reel_9_16",
          version: snapshot.project.versions.reel_9_16,
        });
        dispatch({
          type: "replace-version",
          aspect: "widescreen_16_9",
          version: snapshot.project.versions.widescreen_16_9,
        });
        if (snapshot.project.activeVersion !== projectRef.current.activeVersion) {
          dispatch({ type: "switch-aspect", aspect: snapshot.project.activeVersion });
        }
        dispatch({ type: "history/clear" });
        setAssets(restoredAssets);
        setStatusMessage(RESTORE_STATUS_MESSAGE);
      })
      .then(() => {
        if (!cancelled) setStorageStatus("saved");
      })
      .catch((error) => {
        if (cancelled) return;
        setStorageStatus("unavailable");
        setStatusMessage(getProjectStorageErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setIsStorageReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [templateParam]);

  useEffect(() => {
    if (!isStorageReady || templateParam) return;
    const timeout = window.setTimeout(() => {
      const generation = ++saveGenerationRef.current;
      setStorageStatus("saving");
      const save = () => saveProjectSnapshot(project, Object.values(assets));
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(save)
        .then(() => {
          if (generation === saveGenerationRef.current) setStorageStatus("saved");
        })
        .catch((error) => {
          if (generation === saveGenerationRef.current) {
            setStorageStatus("error");
            setStatusMessage(getProjectStorageErrorMessage(error));
          }
          return undefined;
        });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [assets, isStorageReady, project, templateParam]);

  const retryProjectSave = async (): Promise<void> => {
    ++saveGenerationRef.current;
    setStorageStatus("saving");
    try {
      await saveProjectSnapshot(projectRef.current, Object.values(assetsRef.current));
      setStorageStatus("saved");
      setStatusMessage("Project saved locally.");
    } catch (error) {
      setStorageStatus("error");
      setStatusMessage(getProjectStorageErrorMessage(error));
    }
  };

  useEffect(() => {
    if (!initialTemplate) {
      return;
    }
    if (hydratedTemplateIdRef.current === initialTemplate.id) return;
    hydratedTemplateIdRef.current = initialTemplate.id;

    const starterAssets =
      initialTemplate.starterAssets?.map((asset) => ({
        assetId: nanoid(10),
        asset,
      })) ?? [];
    let cancelled = false;

    if (initialTemplate.blueprint) {
      const instantiated = instantiateTemplate(initialTemplate.id, () => nanoid(10));
      if (!instantiated) return;

      const placeholderAssetIds = Array.from(
        new Set([
          ...instantiated.clips.map((clip) => clip.assetId),
          ...instantiated.audioTracks.map((track) => track.assetId),
        ]),
      );
      const assetIdMap = new Map(
        placeholderAssetIds.map((placeholderId, index) => [
          placeholderId,
          starterAssets[index]?.assetId ?? placeholderId,
        ]),
      );
      const templateVersion = {
        ...instantiated,
        clips: instantiated.clips.map((clip) => ({
          ...clip,
          assetId: assetIdMap.get(clip.assetId) ?? clip.assetId,
        })),
        audioTracks: instantiated.audioTracks.map((track) => ({
          ...track,
          assetId: assetIdMap.get(track.assetId) ?? track.assetId,
        })),
      };

      setAssets(
        Object.fromEntries(
          starterAssets.map(({ assetId, asset }) => [
            assetId,
            {
              assetId,
              kind: asset.kind,
              mimeType: asset.mimeType,
              name: asset.name,
              size: 0,
              externalUrl: new URL(asset.publicPath, window.location.origin).toString(),
              attribution: asset.attribution,
            } satisfies LocalAsset,
          ]),
        ),
      );

      for (const aspect of ALL_ASPECTS) {
        dispatch({
          type: "replace-version",
          aspect,
          version: {
            ...templateVersion,
            aspect,
            clips: templateVersion.clips.map((clip) => ({ ...clip })),
            textOverlays: templateVersion.textOverlays.map((overlay) => ({ ...overlay })),
            audioTracks: templateVersion.audioTracks.map((track) => ({ ...track })),
            transitions: templateVersion.transitions.map((transition) => ({ ...transition })),
          },
        });
      }
      dispatch({ type: "history/clear" });
      setSelectedTextId(templateVersion.textOverlays[0]?.id ?? null);
      setSelectedClipId(null);
      setSelectedAudioId(null);
      setStatusMessage(`Elah template ready: ${initialTemplate.name}.`);

      void (async () => {
        try {
          const loadedAssets = await Promise.all(
            starterAssets.map(async ({ assetId, asset }) => {
              const response = await fetch(asset.publicPath);
              if (!response.ok) throw new Error(`Failed to load ${asset.publicPath}.`);
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
                  attribution: asset.attribution,
                } satisfies LocalAsset,
              ] as const;
            }),
          );
          if (cancelled) {
            loadedAssets.forEach(([, asset]) => asset.objectUrl && URL.revokeObjectURL(asset.objectUrl));
            return;
          }
          loadedAssets.forEach(([, asset]) => {
            if (asset.objectUrl) objectUrlsRef.current.add(asset.objectUrl);
          });
          setAssets((previous) => ({ ...previous, ...Object.fromEntries(loadedAssets) }));
        } catch (error) {
          console.error(error);
          if (!cancelled) setStatusMessage(`Some media for ${initialTemplate.name} could not load.`);
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    const styleDefaults = OVERLAY_DEFAULTS_BY_PRESET[initialTemplate.stylePreset];
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
            attribution: asset.attribution,
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

    dispatch({ type: "history/clear" });

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
                attribution: asset.attribution,
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

  const onDetachAudio = (clipId: string): void => {
    const clip = activeVersion.clips.find((item) => item.id === clipId);
    if (!clip || clip.kind !== "video") return;

    const trackId = nanoid(10);
    dispatch({
      type: "add-audio-track",
      aspect: activeAspect,
      track: {
        ...createDefaultAudioTrack(trackId, clip.assetId),
        startFrame: clip.startFrame,
        endFrame: clip.endFrame,
        trimStartFrame: clip.trimStartFrame,
        trimEndFrame: clip.trimEndFrame,
        volume: clip.volume,
      },
    });
    dispatch({
      type: "update-clip",
      aspect: activeAspect,
      clipId,
      patch: { volume: 0 },
    });
    setSelectedAudioId(trackId);
    setSelectedClipId(null);
    setSelectedTextId(null);
    setStatusMessage("Detached clip audio to its own timeline track.");
  };

  const onImportStockVideo = async (
    video: PexelsVideoResult,
    rendition: PexelsVideoRendition,
    signal?: AbortSignal,
  ): Promise<void> => {
    if (isExporting) return;
    const activeTimelineEnd = getTimelineDurationInFrames(
      projectRef.current.versions[activeAspect],
    );
    if (activeTimelineEnd >= MAX_DURATION_FRAMES) {
      const error = new Error("The timeline has reached its 60 second limit.");
      setStatusMessage(error.message);
      throw error;
    }
    setStatusMessage("Downloading Pexels footage to this browser… 0%");

    try {
      const imported = await importVideoFromUrl(rendition.url, {
        signal,
        fileName: `pexels-${video.id}-${video.photographer.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.mp4`,
        onProgress: (progress) => {
          setStatusMessage(`Downloading Pexels footage to this browser… ${Math.round(progress * 100)}%`);
        },
      });
      const tooLargeMessage = getAssetTooLargeMessage(
        imported.fileName,
        "video",
        imported.bytes,
      );
      if (tooLargeMessage) throw new Error(tooLargeMessage);

      const assetId = nanoid(10);
      const objectUrl = URL.createObjectURL(imported.file);
      objectUrlsRef.current.add(objectUrl);
      setAssets((previous) => ({
        ...previous,
        [assetId]: {
          assetId,
          kind: "video",
          mimeType: imported.mimeType,
          name: imported.fileName,
          size: imported.bytes,
          file: imported.file,
          objectUrl,
          attribution: {
            provider: "pexels",
            sourceUrl: video.pexelsUrl,
            creatorName: video.photographer,
            creatorUrl: video.photographerUrl,
          },
        },
      }));

      const sourceDuration = Math.max(
        1,
        Math.min(MAX_DURATION_FRAMES, Math.round(video.duration * FPS)),
      );
      let selectedId: string | null = null;
      for (const aspect of ALL_ASPECTS) {
        const target = projectRef.current.versions[aspect];
        const startFrame = getTimelineDurationInFrames(target);
        const available = MAX_DURATION_FRAMES - startFrame;
        if (available <= 0) continue;
        const duration = Math.min(sourceDuration, available);
        const clipId = nanoid(10);
        dispatch({
          type: "add-clip",
          aspect,
          clip: {
            ...createDefaultClip(clipId, assetId, "video"),
            startFrame,
            endFrame: startFrame + duration,
            trimEndFrame: duration,
          },
        });
        if (aspect === activeAspect) selectedId = clipId;
      }

      if (!selectedId) throw new Error("The timeline has reached its 60 second limit.");
      setSelectedClipId(selectedId);
      setSelectedTextId(null);
      setSelectedAudioId(null);
      setStatusMessage(`Added Pexels footage by ${video.photographer}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not import Pexels footage.";
      setStatusMessage(message);
      throw error;
    }
  };

  const searchStockVideos = async (
    query: string,
    aspect: AspectPreset = activeAspect,
    signal?: AbortSignal,
  ): Promise<PexelsVideoSearchResult> => {
    const params = new URLSearchParams({
      query,
      orientation: aspect === "reel_9_16" ? "portrait" : "landscape",
      page: "1",
      per_page: "24",
    });
    const response = await fetch(`/api/pexels/videos?${params.toString()}`, { signal });
    const payload = (await response.json()) as PexelsVideoSearchResult | { error?: string };
    if (!response.ok) {
      throw new Error("error" in payload && payload.error ? payload.error : "Pexels search failed.");
    }
    return payload as PexelsVideoSearchResult;
  };

  const onImportStockVideoById = async (
    query: string,
    videoId: number,
    aspect: AspectPreset,
    signal?: AbortSignal,
  ): Promise<ExportActionResult> => {
    try {
      const result = await searchStockVideos(query, aspect, signal);
      const video = result.videos.find((item) => item.id === videoId);
      if (!video) return { ok: false, message: "Pexels video was not found in this search." };
      const preset = ASPECT_PRESETS[aspect];
      const rendition = chooseMp4Rendition(video.renditions, {
        width: preset.width,
        height: preset.height,
      });
      if (!rendition) return { ok: false, message: "No compatible MP4 rendition was found." };
      await onImportStockVideo(video, rendition, signal);
      return { ok: true, message: `Imported Pexels video ${videoId}.` };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Pexels import failed.",
      };
    }
  };

  const searchStockPhotos = async (
    query: string,
    aspect: AspectPreset = activeAspect,
    signal?: AbortSignal,
  ): Promise<PexelsPhotoSearchResult> => {
    const params = new URLSearchParams({
      query,
      orientation: aspect === "reel_9_16" ? "portrait" : "landscape",
      page: "1",
      per_page: "24",
    });
    const response = await fetch(`/api/pexels/photos?${params.toString()}`, { signal });
    const payload = (await response.json()) as PexelsPhotoSearchResult | { error?: string };
    if (!response.ok) {
      throw new Error("error" in payload && payload.error ? payload.error : "Pexels photo search failed.");
    }
    return payload as PexelsPhotoSearchResult;
  };

  const onImportStockPhoto = async (
    photo: PexelsPhotoResult,
    signal?: AbortSignal,
  ): Promise<ExportActionResult> => {
    if (exportInFlightRef.current) {
      return { ok: false, message: "Wait for the current export to finish." };
    }
    try {
      setStatusMessage("Downloading Pexels photo to this browser…");
      const response = await fetch(photo.imageUrl, { signal, cache: "no-store" });
      if (!response.ok) throw new Error(`Photo download failed (${response.status}).`);
      const blob = await response.blob();
      const mimeType = blob.type || response.headers.get("content-type") || "image/jpeg";
      if (!isSupportedImageMimeType(mimeType)) {
        throw new Error("The Pexels source did not return a supported image.");
      }
      const extension = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
      const fileName = sanitizeUploadFilename(
        `pexels-${photo.id}-${photo.photographer.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${extension}`,
      );
      const tooLargeMessage = getAssetTooLargeMessage(fileName, "image", blob.size);
      if (tooLargeMessage) throw new Error(tooLargeMessage);
      const file = new File([blob], fileName, { type: mimeType });
      const assetId = nanoid(10);
      const objectUrl = URL.createObjectURL(file);
      objectUrlsRef.current.add(objectUrl);
      setAssets((previous) => ({
        ...previous,
        [assetId]: {
          assetId,
          kind: "image",
          mimeType,
          name: fileName,
          size: file.size,
          file,
          objectUrl,
          attribution: {
            provider: "pexels",
            sourceUrl: photo.pexelsUrl,
            creatorName: photo.photographer,
            creatorUrl: photo.photographerUrl,
          },
        },
      }));

      let selectedId: string | null = null;
      for (const aspect of ALL_ASPECTS) {
        const startFrame = getTimelineDurationInFrames(projectRef.current.versions[aspect]);
        const duration = Math.min(DEFAULT_CLIP_DURATION_FRAMES, MAX_DURATION_FRAMES - startFrame);
        if (duration <= 0) continue;
        const clipId = nanoid(10);
        dispatch({
          type: "add-clip",
          aspect,
          clip: {
            ...createDefaultClip(clipId, assetId, "image"),
            startFrame,
            endFrame: startFrame + duration,
            trimEndFrame: duration,
          },
        });
        if (aspect === activeAspect) selectedId = clipId;
      }
      if (!selectedId) throw new Error("The timeline has reached its 60 second limit.");
      setSelectedClipId(selectedId);
      setSelectedTextId(null);
      setSelectedAudioId(null);
      const message = `Imported Pexels photo ${photo.id} by ${photo.photographer}.`;
      setStatusMessage(message);
      return { ok: true, message };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pexels photo import failed.";
      setStatusMessage(message);
      return { ok: false, message };
    }
  };

  const onImportStockPhotoById = async (
    query: string,
    photoId: number,
    aspect: AspectPreset,
    signal?: AbortSignal,
  ): Promise<ExportActionResult> => {
    try {
      const result = await searchStockPhotos(query, aspect, signal);
      const photo = result.photos.find((item) => item.id === photoId);
      if (!photo) return { ok: false, message: "Pexels photo was not found in this search." };
      return await onImportStockPhoto(photo, signal);
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Pexels photo import failed.",
      };
    }
  };

  const onImportAudioFromUrl = async (
    input: AudioUrlImportInput,
    signal?: AbortSignal,
  ): Promise<ExportActionResult> => {
    if (isExporting) {
      return { ok: false, message: "Wait for the current export to finish." };
    }

    const aspect = input.aspect ?? activeAspect;
    const version = projectRef.current.versions[aspect];
    const startFrame = Math.min(input.startFrame ?? 0, MAX_DURATION_FRAMES - 1);
    const timelineEnd = Math.max(startFrame + 1, getTimelineDurationInFrames(version));
    const endFrame = Math.min(input.endFrame ?? timelineEnd, MAX_DURATION_FRAMES);
    if (endFrame <= startFrame) {
      return { ok: false, message: "Audio end must be after its start." };
    }

    try {
      setStatusMessage("Downloading licensed audio to this browser…");
      const response = await fetch(input.url, { signal });
      if (!response.ok) throw new Error(`Audio download failed (${response.status}).`);
      const blob = await response.blob();
      const mimeType = blob.type || response.headers.get("content-type") || "audio/mpeg";
      if (!mimeType.toLowerCase().startsWith("audio/")) {
        throw new Error("The remote source did not return an audio file.");
      }

      const fallbackName =
        new URL(input.url).pathname.split("/").filter(Boolean).pop() ??
        "soundtrack.mp3";
      const fileName = sanitizeUploadFilename(input.name ?? fallbackName);
      const tooLargeMessage = getAssetTooLargeMessage(fileName, "audio", blob.size);
      if (tooLargeMessage) throw new Error(tooLargeMessage);

      const file = new File([blob], fileName, { type: mimeType });
      const assetId = nanoid(10);
      const trackId = nanoid(10);
      const objectUrl = URL.createObjectURL(file);
      objectUrlsRef.current.add(objectUrl);
      setAssets((previous) => ({
        ...previous,
        [assetId]: {
          assetId,
          kind: "audio",
          mimeType,
          name: fileName,
          size: file.size,
          file,
          objectUrl,
          ...(input.sourceUrl
            ? {
                attribution: {
                  provider: input.provider ?? ("mixkit" as const),
                  sourceUrl: input.sourceUrl,
                  creatorName: input.creatorName ?? "Audio creator",
                  creatorUrl: input.creatorUrl ?? input.sourceUrl,
                  ...(input.licenseName ? { licenseName: input.licenseName } : {}),
                  ...(input.licenseUrl ? { licenseUrl: input.licenseUrl } : {}),
                  ...(input.attributionRequired !== undefined
                    ? { attributionRequired: input.attributionRequired }
                    : {}),
                },
              }
            : {}),
        },
      }));

      const durationInFrames = endFrame - startFrame;
      const trimStartFrame = input.trimStartFrame ?? 0;
      dispatch({
        type: "add-audio-track",
        aspect,
        track: {
          ...createDefaultAudioTrack(trackId, assetId),
          startFrame,
          endFrame,
          trimStartFrame,
          trimEndFrame: trimStartFrame + durationInFrames,
          volume: input.volume ?? 0.32,
          fadeInFrames: 12,
          fadeOutFrames: 24,
        },
      });
      setSelectedAudioId(trackId);
      setSelectedClipId(null);
      setSelectedTextId(null);
      setStatusMessage(`Added ${fileName}.`);
      return { ok: true, message: `Imported ${fileName}.` };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not import remote audio.";
      setStatusMessage(message);
      return { ok: false, message };
    }
  };

  const searchLicensedAudio = async (
    provider: LicensedAudioProvider,
    query: string,
    signal?: AbortSignal,
  ): Promise<LicensedAudioSearchResult> => {
    const endpoint = provider === "jamendo" ? "music" : "sfx";
    const params = new URLSearchParams({ query });
    const response = await fetch(`/api/stock-audio/${endpoint}?${params.toString()}`, { signal });
    const payload = (await response.json()) as LicensedAudioSearchResult | { error?: string };
    if (!response.ok) {
      throw new Error("error" in payload && payload.error ? payload.error : "Licensed audio search failed.");
    }
    return payload as LicensedAudioSearchResult;
  };

  const searchLicensedMusic = (query: string, signal?: AbortSignal) =>
    searchLicensedAudio("jamendo", query, signal);

  const searchLicensedSoundEffects = (query: string, signal?: AbortSignal) =>
    searchLicensedAudio("freesound", query, signal);

  const importLicensedAudio = async (
    provider: LicensedAudioProvider,
    input: LicensedAudioImportInput,
    signal?: AbortSignal,
  ): Promise<ExportActionResult> => {
    try {
      const result = await searchLicensedAudio(provider, input.query, signal);
      const audio = result.results.find((item: LicensedAudioResult) => item.id === input.audioId);
      if (!audio) return { ok: false, message: "Licensed audio was not found in this search." };
      const aspect = input.aspect ?? activeAspect;
      const defaultStart = provider === "jamendo"
        ? 0
        : getTimelineDurationInFrames(projectRef.current.versions[aspect]);
      const startFrame = Math.min(input.startFrame ?? defaultStart, MAX_DURATION_FRAMES - 1);
      const endFrame = Math.min(
        input.endFrame ?? startFrame + Math.max(1, Math.round(audio.durationSeconds * FPS)),
        MAX_DURATION_FRAMES,
      );
      return await onImportAudioFromUrl({
        url: audio.audioUrl,
        name: `${audio.title.replace(/[^a-z0-9._-]+/gi, "-")}.mp3`,
        aspect,
        startFrame,
        endFrame,
        volume: input.volume ?? (provider === "jamendo" ? 0.24 : 0.65),
        sourceUrl: audio.sourceUrl,
        creatorName: audio.creatorName,
        creatorUrl: audio.creatorUrl,
        provider,
        licenseName: audio.licenseName,
        licenseUrl: audio.licenseUrl,
        attributionRequired: audio.attributionRequired,
      }, signal);
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Licensed audio import failed.",
      };
    }
  };

  const onImportLicensedMusic = (input: LicensedAudioImportInput, signal?: AbortSignal) =>
    importLicensedAudio("jamendo", input, signal);

  const onImportLicensedSoundEffect = (input: LicensedAudioImportInput, signal?: AbortSignal) =>
    importLicensedAudio("freesound", input, signal);

  const commitExportState = (
    next:
      | EditorExportState
      | ((current: EditorExportState) => EditorExportState),
  ): EditorExportState => {
    const resolved =
      typeof next === "function" ? next(exportStateRef.current) : next;
    exportStateRef.current = resolved;
    setExportState(resolved);
    return resolved;
  };

  const performExport = async (
    jobId: string,
    signal: AbortSignal,
  ): Promise<ExportActionResult> => {
    const currentProject = projectRef.current;
    const currentAssets = assetsRef.current;
    const currentAspect = currentProject.activeVersion;
    const currentVersion = currentProject.versions[currentAspect];

    if (exportInFlightRef.current) {
      return { ok: false, message: "Render already in progress." };
    }

    exportInFlightRef.current = true;
    if (exportArtifactUrlRef.current) {
      URL.revokeObjectURL(exportArtifactUrlRef.current);
      exportArtifactUrlRef.current = null;
    }
    const startedAt = new Date().toISOString();
    commitExportState({
      jobId,
      status: "rendering",
      progress: 0,
      startedAt,
      completedAt: null,
      message: "Preparing browser render.",
      artifact: null,
    });

    const hasRenderableVisual =
      currentVersion.clips.length > 0 || currentVersion.textOverlays.length > 0;

    if (!hasRenderableVisual) {
      const message = "Add a clip or text overlay before export.";
      setStatusMessage(message);
      exportInFlightRef.current = false;
      commitExportState((current) => ({
        ...current,
        status: "failed",
        completedAt: new Date().toISOString(),
        message,
      }));
      return { ok: false, message };
    }

    const usedAssetIds = collectUsedAssetIds(currentVersion);
    for (const usedAssetId of usedAssetIds) {
      if (!currentAssets[usedAssetId]) {
        const message = `Missing asset ${usedAssetId}. Re-add the media and try again.`;
        setStatusMessage(message);
        exportInFlightRef.current = false;
        commitExportState((current) => ({
          ...current,
          status: "failed",
          completedAt: new Date().toISOString(),
          message,
        }));
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

      const filename = `inkframe-${currentAspect}-${Date.now()}.mp4`;
      const durationInFrames = getVersionRenderDurationInFrames(currentVersion);
      const blob = await exportElahProjectInBrowser(projection.project, {
        filename,
        signal,
        onProgress: ({ frame, totalFrames }) => {
          const percent = totalFrames > 0 ? Math.round((frame / totalFrames) * 100) : 0;
          setStatusMessage(`Rendering locally in Elah… ${percent}%`);
          if (percent !== exportStateRef.current.progress) {
            commitExportState((current) => ({
              ...current,
              progress: percent,
              message: `Rendering locally in Elah… ${percent}%`,
            }));
          }
        },
      });

      const objectUrl = URL.createObjectURL(blob);
      exportArtifactUrlRef.current = objectUrl;
      const verification = await verifyBrowserVideo(blob, objectUrl);
      const message = verification.playable && verification.containerSignature === "mp4"
        ? "Video rendered, verified in this browser, and downloaded."
        : "Video rendered and downloaded, but browser playback verification needs review.";
      const completedAt = new Date().toISOString();
      const artifact = {
        jobId,
        filename,
        mimeType: blob.type || "video/mp4",
        bytes: blob.size,
        durationInFrames,
        durationSeconds: Number((durationInFrames / FPS).toFixed(3)),
        ...ELAH_BROWSER_EXPORT_PROFILE,
        audioCodec: currentVersion.audioTracks.some((track) => !track.muted)
          ? ELAH_BROWSER_EXPORT_PROFILE.audioCodec
          : null,
        audioBitrate: currentVersion.audioTracks.some((track) => !track.muted)
          ? ELAH_BROWSER_EXPORT_PROFILE.audioBitrate
          : null,
        width: ASPECT_PRESETS[currentAspect].width,
        height: ASPECT_PRESETS[currentAspect].height,
        fps: FPS,
        completedAt,
        objectUrl,
        retainedUntil: "next-export-or-page-close" as const,
        sha256: verification.sha256,
        verification: {
          playable: verification.playable,
          containerSignature: verification.containerSignature,
          durationSeconds: verification.durationSeconds,
          width: verification.width,
          height: verification.height,
          error: verification.error,
        },
      };
      setStatusMessage(message);
      commitExportState((current) => ({
        ...current,
        status: "completed",
        progress: 100,
        completedAt,
        message,
        artifact,
      }));
      return { ok: true, message, export: artifact };
    } catch (error) {
      const cancelled = signal.aborted;
      const message = cancelled
        ? "Video export cancelled."
        : error instanceof Error
          ? error.message
          : "Failed to export video.";
      setStatusMessage(message);
      commitExportState((current) => ({
        ...current,
        status: cancelled ? "cancelled" : "failed",
        completedAt: new Date().toISOString(),
        message,
      }));
      return { ok: false, message };
    } finally {
      exportInFlightRef.current = false;
      exportControllerRef.current = null;
      setIsExporting(false);
    }
  };

  const onExport = async (signal?: AbortSignal): Promise<ExportActionResult> => {
    if (exportInFlightRef.current) {
      return { ok: false, message: "Render already in progress." };
    }
    const controller = new AbortController();
    exportControllerRef.current = controller;
    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal?.aborted) abortFromCaller();
    else signal?.addEventListener("abort", abortFromCaller, { once: true });

    try {
      return await performExport(`export-${nanoid(10)}`, controller.signal);
    } finally {
      signal?.removeEventListener("abort", abortFromCaller);
    }
  };

  const onRequestExport = (): { ok: boolean; message: string; jobId?: string } => {
    if (exportInFlightRef.current) {
      return {
        ok: false,
        message: "Render already in progress.",
        jobId: exportStateRef.current.jobId ?? undefined,
      };
    }
    const jobId = `export-${nanoid(10)}`;
    const controller = new AbortController();
    exportControllerRef.current = controller;
    void performExport(jobId, controller.signal);
    return {
      ok: true,
      message: "Export started. Poll editor_get_export_status for progress and artifact metadata.",
      jobId,
    };
  };

  const onCancelExport = (): ExportActionResult => {
    const controller = exportControllerRef.current;
    if (!controller || !exportInFlightRef.current) {
      return { ok: false, message: "No export is currently running." };
    }
    controller.abort(new DOMException("Export cancelled", "AbortError"));
    return { ok: true, message: "Export cancellation requested." };
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

  const getRenderDiagnostics = (aspect: AspectPreset = activeAspect) => {
    const currentAssets = Object.values(assetsRef.current);
    const assetSources = Object.fromEntries(
      currentAssets
        .map((asset) => [asset.assetId, asset.objectUrl ?? asset.externalUrl] as const)
        .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
    );
    const projection = toElahProject(projectRef.current.versions[aspect], {
      assets: currentAssets,
      assetSources,
      projectId: `inkframe-diagnostics-${aspect}`,
    });
    const capabilities = detectElahBrowserCapabilities();
    return {
      aspect,
      adapter: projection.diagnostics,
      browser: {
        ready: capabilities.ready,
        missing: capabilities.missing,
      },
    };
  };

  const undo = () => dispatch({ type: "history/undo" });
  const redo = () => dispatch({ type: "history/redo" });

  return {
    history,
    activeAspect,
    activeVersion,
    assetList,
    assetNames,
    exportState,
    getRenderDiagnostics,
    isExporting,
    canRedo: history.future.length > 0,
    canUndo: history.past.length > 0,
    onApplyEditorActions,
    onDetachAudio,
    onImportStockVideo,
    onImportStockVideoById,
    onImportStockPhotoById,
    onImportAudioFromUrl,
    onImportLicensedMusic,
    onImportLicensedSoundEffect,
    onExport,
    onRequestExport,
    onCancelExport,
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
    storageStatus,
    retryProjectSave,
    searchStockVideos,
    searchStockPhotos,
    searchLicensedMusic,
    searchLicensedSoundEffects,
    switchAspect,
    timelineDurationInFrames,
    undo,
    dispatch,
    activeMediaFootprintBytes: assetList.reduce((sum, asset) => sum + asset.size, 0),
  };
};
