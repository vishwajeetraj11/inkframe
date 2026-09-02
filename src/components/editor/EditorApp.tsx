"use client";

import { EditorHeader } from "@/components/editor/EditorHeader";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { EditorRightSidebar } from "@/components/editor/EditorRightSidebar";
import { PreviewPane } from "@/components/editor/PreviewPane";
import { TimelineResizeHandle } from "@/components/editor/TimelineResizeHandle";
import {
  ElahEditorWorkspace,
  ElahTimelineDock,
} from "@/components/editor/elah";
import { createDefaultTextOverlay } from "@/lib/editor/defaults";
import {
  DEFAULT_TEXT_TRACK_ID,
  createEditorTrack,
  ensureEditorTracks,
} from "@/lib/editor/tracks";
import type { EditorTrackKind } from "@/lib/editor/types";
import type { EditorFrameCapture, EditorVisualReview } from "@/lib/editor/export-state";
import { analyzeFrameContrast } from "@/lib/editor/webmcp/contrast";
import { usePlaybackStore, type PreviewHandle } from "@elah/editor";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useEditorWebMcp } from "./hooks/use-editor-webmcp";
import { useEditorSession } from "./hooks/use-editor-session";

const DEFAULT_TIMELINE_HEIGHT = 188;
const MIN_TIMELINE_HEIGHT = 140;
const MAX_TIMELINE_HEIGHT = 360;

export const EditorApp = () => {
  const session = useEditorSession();
  const [timelineHeight, setTimelineHeight] = useState(DEFAULT_TIMELINE_HEIGHT);
  const [visualReview, setVisualReview] = useState<EditorVisualReview | null>(null);
  const previewRef = useRef<PreviewHandle | null>(null);

  useEffect(() => {
    if (!session.statusMessage) {
      toast.dismiss("editor-status");
      return;
    }

    toast(session.statusMessage, {
      id: "editor-status",
      duration: 4500,
    });
  }, [session.statusMessage]);

  const capturePreviewFrame = async (frame: number, includeImage: boolean) => {
    const playback = usePlaybackStore.getState();
    playback.pause();
    playback.setCurrentFrame(frame);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const canvas = previewRef.current?.getCanvas();
    if (!canvas) throw new Error("The preview canvas is not ready.");
    const capture: EditorFrameCapture = {
      frame,
      width: canvas.width,
      height: canvas.height,
      contrastChecks: [],
    };

    try {
      const maximumWidth = 480;
      const scale = Math.min(1, maximumWidth / Math.max(1, canvas.width));
      const snapshot = document.createElement("canvas");
      snapshot.width = Math.max(1, Math.round(canvas.width * scale));
      snapshot.height = Math.max(1, Math.round(canvas.height * scale));
      const context = snapshot.getContext("2d");
      if (!context) throw new Error("The browser could not create a frame snapshot.");
      context.drawImage(canvas, 0, 0, snapshot.width, snapshot.height);
      capture.contrastChecks = analyzeFrameContrast({
        pixels: context.getImageData(0, 0, snapshot.width, snapshot.height).data,
        width: snapshot.width,
        height: snapshot.height,
        version: session.activeVersion,
        frame,
      });
      if (includeImage) {
        capture.mimeType = "image/jpeg";
        capture.dataUrl = snapshot.toDataURL("image/jpeg", 0.72);
      }
    } catch (error) {
      capture.imageError =
        error instanceof Error ? error.message : "Frame image capture failed.";
    }
    return capture;
  };

  const selectClip = (clipId: string | null) => {
    session.setSelectedClipId(clipId);
    session.setSelectedTextId(null);
    session.setSelectedAudioId(null);
  };

  const selectText = (textId: string | null) => {
    session.setSelectedTextId(textId);
    session.setSelectedClipId(null);
    session.setSelectedAudioId(null);
  };

  const selectAudio = (audioId: string | null) => {
    session.setSelectedAudioId(audioId);
    session.setSelectedClipId(null);
    session.setSelectedTextId(null);
  };

  useEditorWebMcp({
    history: session.history,
    dispatch: session.dispatch,
    undo: session.undo,
    redo: session.redo,
    assets: session.assetList,
    selectClip: (clipId) => selectClip(clipId),
    selectText: (overlayId) => selectText(overlayId),
    selectAudio: (trackId) => selectAudio(trackId),
    applyAIEditorActions: session.onApplyEditorActions,
    requestExport: () => session.onRequestExport(),
    getExportState: () => session.exportState,
    cancelExport: session.onCancelExport,
    captureFrame: capturePreviewFrame,
    publishVisualReview: setVisualReview,
    getRenderDiagnostics: session.getRenderDiagnostics,
    removeAsset: session.onRemoveAsset,
    requestMediaPicker: () => {
      const input = document.getElementById("media-upload");
      if (!(input instanceof HTMLInputElement) || input.disabled) {
        throw new Error("Media picker is unavailable while the editor is busy.");
      }
      input.click();
    },
    searchStockVideos: session.searchStockVideos,
    importStockVideo: session.onImportStockVideoById,
    searchStockPhotos: session.searchStockPhotos,
    importStockPhoto: session.onImportStockPhotoById,
    searchLicensedMusic: session.searchLicensedMusic,
    importLicensedMusic: session.onImportLicensedMusic,
    searchLicensedSoundEffects: session.searchLicensedSoundEffects,
    importLicensedSoundEffect: session.onImportLicensedSoundEffect,
    importAudioFromUrl: session.onImportAudioFromUrl,
  });

  const workspaceStats = [
    {
      label: "Timeline",
      value: `${(session.timelineDurationInFrames / 30).toFixed(2)}s`,
    },
    {
      label: "Remaining",
      value: `${(session.remainingFrames / 30).toFixed(2)}s`,
    },
    {
      label: "Assets",
      value: String(session.assetList.length),
    },
  ];

  const canExport =
    session.activeVersion.clips.length > 0 ||
    session.activeVersion.textOverlays.length > 0;

  const handleAddText = (trackId?: string) => {
    const overlayId = nanoid(10);
    const textTrackId = ensureEditorTracks(session.activeVersion).some(
      (track) => track.id === trackId && track.kind === "text",
    )
      ? trackId
      : DEFAULT_TEXT_TRACK_ID;
    selectText(overlayId);
    session.dispatch({
      type: "add-text-overlay",
      aspect: session.activeAspect,
      overlay: {
        ...createDefaultTextOverlay(overlayId),
        trackId: textTrackId,
      },
    });
  };

  const handleAddTrack = (kind: EditorTrackKind) => {
    const trackId = `inkframe-track-${nanoid(10)}`;
    const existing = ensureEditorTracks(session.activeVersion);
    session.dispatch({
      type: "add-track",
      aspect: session.activeAspect,
      track: createEditorTrack(trackId, kind, existing),
    });
    return trackId;
  };

  return (
    <div className="min-h-screen bg-[#0f0d0a] text-neutral-100 xl:h-screen xl:overflow-hidden">
      <EditorHeader
        activeAspect={session.activeAspect}
        isExporting={session.isExporting}
        workspaceStats={workspaceStats}
        canExport={canExport}
        onSwitchAspect={session.switchAspect}
        onExport={() => {
          void session.onExport();
        }}
        storageStatus={session.storageStatus}
        onRetrySave={() => {
          void session.retryProjectSave();
        }}
      />

      <ElahEditorWorkspace
        version={session.activeVersion}
        assets={session.assetList}
        assetSources={session.previewAssetSources}
        onVersionChange={(version) => {
          session.dispatch({
            type: "replace-version",
            aspect: session.activeAspect,
            version,
          });
        }}
      >
        <main
          className="mx-auto grid w-full max-w-[1800px] xl:h-[calc(100dvh-54px)] xl:grid-cols-[264px_minmax(0,1fr)_320px] xl:grid-rows-[minmax(0,1fr)_var(--timeline-height)]"
          style={{ "--timeline-height": `${timelineHeight}px` } as CSSProperties}
        >
        <div className="order-1 min-h-0 xl:order-none xl:col-start-1 xl:row-start-1">
          <EditorSidebar
            activeAspect={session.activeAspect}
            isExporting={session.isExporting}
            assets={session.assetList}
            onFilesSelected={session.onFilesSelected}
            onRemoveAsset={session.onRemoveAsset}
            onAddStockVideo={session.onImportStockVideo}
            onAddStockSoundEffect={(query, audio) =>
              session.onImportLicensedSoundEffect({
                query,
                audioId: audio.id,
                aspect: session.activeAspect,
              })
            }
          />
        </div>

        <div className="order-2 min-w-0 border-b border-white/10 xl:order-none xl:col-start-2 xl:row-start-1">
          <PreviewPane
            previewRef={previewRef}
            aspect={session.activeAspect}
            version={session.activeVersion}
            canUndo={session.canUndo}
            canRedo={session.canRedo}
            onUndo={session.undo}
            onRedo={session.redo}
            visualReview={visualReview}
            onDismissVisualReview={() => setVisualReview(null)}
          />
        </div>

        <div className="order-4 min-h-0 xl:order-none xl:col-start-3 xl:row-start-1">
          <EditorRightSidebar
            selectedClip={session.selectedClip}
            selectedTextOverlay={session.selectedTextOverlay}
            selectedAudioTrack={session.selectedAudioTrack}
            assetNames={session.assetNames}
            isExporting={session.isExporting}
            onDetachAudio={session.onDetachAudio}
            onUpdateClip={(clipId, patch) => {
              session.dispatch({ type: "update-clip", aspect: session.activeAspect, clipId, patch });
            }}
            onUpdateText={(overlayId, patch) => {
              session.dispatch({
                type: "update-text-overlay",
                aspect: session.activeAspect,
                overlayId,
                patch,
              });
            }}
            onUpdateAudio={(trackId, patch) => {
              session.dispatch({
                type: "update-audio-track",
                aspect: session.activeAspect,
                trackId,
                patch,
              });
            }}
            onRemoveAudio={(trackId) => {
              session.dispatch({
                type: "remove-audio-track",
                aspect: session.activeAspect,
                trackId,
              });
              if (session.selectedAudioId === trackId) session.setSelectedAudioId(null);
            }}
          />
        </div>

        <div className="relative order-3 min-h-[240px] min-w-0 border-b border-white/10 xl:order-none xl:col-span-3 xl:col-start-1 xl:row-start-2 xl:min-h-0 xl:border-b-0 xl:border-t">
          <TimelineResizeHandle
            height={timelineHeight}
            minHeight={MIN_TIMELINE_HEIGHT}
            maxHeight={MAX_TIMELINE_HEIGHT}
            defaultHeight={DEFAULT_TIMELINE_HEIGHT}
            onHeightChange={setTimelineHeight}
          />
          <ElahTimelineDock
            version={session.activeVersion}
            onAddText={handleAddText}
            onAddTrack={handleAddTrack}
            onSelectClip={selectClip}
            onSelectText={selectText}
            onSelectAudio={selectAudio}
          />
        </div>
        </main>
      </ElahEditorWorkspace>

    </div>
  );
};
