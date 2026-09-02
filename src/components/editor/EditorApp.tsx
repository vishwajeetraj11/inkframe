"use client";

import { AIChatDrawer } from "@/components/editor/AIChatDrawer";
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
import { nanoid } from "nanoid";
import { useState, type CSSProperties } from "react";
import { useEditorWebMcp } from "./hooks/use-editor-webmcp";
import { useEditorSession } from "./hooks/use-editor-session";

interface EditorAppProps {
  enableAIChat: boolean;
}

const DEFAULT_TIMELINE_HEIGHT = 188;
const MIN_TIMELINE_HEIGHT = 140;
const MAX_TIMELINE_HEIGHT = 360;

export const EditorApp = ({
  enableAIChat,
}: EditorAppProps) => {
  const session = useEditorSession();
  const [timelineHeight, setTimelineHeight] = useState(DEFAULT_TIMELINE_HEIGHT);

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
    addSoundEffect: session.onAddSoundEffect,
    applyAIEditorActions: session.onApplyEditorActions,
    requestExport: (signal) => session.onExport(signal),
    removeAsset: session.onRemoveAsset,
    requestMediaPicker: () => {
      const input = document.getElementById("media-upload");
      if (!(input instanceof HTMLInputElement) || input.disabled) {
        throw new Error("Media picker is unavailable while the editor is busy.");
      }
      input.click();
    },
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

  const handleAddText = () => {
    const overlayId = nanoid(10);
    selectText(overlayId);
    session.dispatch({
      type: "add-text-overlay",
      aspect: session.activeAspect,
      overlay: createDefaultTextOverlay(overlayId),
    });
  };

  return (
    <div className="min-h-screen bg-[#0f0d0a] text-neutral-100 xl:h-screen xl:overflow-hidden">
      <EditorHeader
        activeAspect={session.activeAspect}
        isExporting={session.isExporting}
        statusMessage={session.statusMessage}
        workspaceStats={workspaceStats}
        canExport={canExport}
        onSwitchAspect={session.switchAspect}
        onExport={() => {
          void session.onExport();
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
            isExporting={session.isExporting}
            assets={session.assetList}
            onFilesSelected={session.onFilesSelected}
            onAddSoundEffect={session.onAddSoundEffect}
            onRemoveAsset={session.onRemoveAsset}
          />
        </div>

        <div className="order-2 min-w-0 border-b border-white/10 xl:order-none xl:col-start-2 xl:row-start-1">
          <PreviewPane
            aspect={session.activeAspect}
            version={session.activeVersion}
          />
        </div>

        <div className="order-4 min-h-0 xl:order-none xl:col-start-3 xl:row-start-1">
          <EditorRightSidebar
            selectedClip={session.selectedClip}
            selectedTextOverlay={session.selectedTextOverlay}
            selectedAudioTrack={session.selectedAudioTrack}
            assetNames={session.assetNames}
            isExporting={session.isExporting}
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
            canUndo={session.canUndo}
            canRedo={session.canRedo}
            onUndo={session.undo}
            onRedo={session.redo}
            onAddTrack={handleAddText}
            onSelectClip={selectClip}
            onSelectText={selectText}
            onSelectAudio={selectAudio}
          />
        </div>
        </main>
      </ElahEditorWorkspace>

      {enableAIChat ? (
        <AIChatDrawer
          editorContext={session.editorChatContext}
          onApplyEditorActions={session.onApplyEditorActions}
          onRenderVideoRequest={session.onExport}
        />
      ) : null}
    </div>
  );
};
