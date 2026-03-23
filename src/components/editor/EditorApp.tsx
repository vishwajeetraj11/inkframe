"use client";

import { AIChatDrawer } from "@/components/editor/AIChatDrawer";
import { EditorHeader } from "@/components/editor/EditorHeader";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { EditorMainContent } from "@/components/editor/EditorMainContent";
import { EditorRightSidebar } from "@/components/editor/EditorRightSidebar";
import { PreviewPane } from "@/components/editor/PreviewPane";
import { createDefaultTextOverlay } from "@/lib/editor/defaults";
import { nanoid } from "nanoid";
import { useEditorSession } from "./hooks/use-editor-session";

interface EditorAppProps {
  enableAIChat: boolean;
}

export const EditorApp = ({ enableAIChat }: EditorAppProps) => {
  const session = useEditorSession();

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

  const aspectLabel = (value: typeof session.activeAspect): string =>
    value === "reel_9_16" ? "9:16" : "16:9";

  const workspaceStats = [
    {
      label: "Aspect",
      value: aspectLabel(session.activeAspect),
    },
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#23324b_0%,#0c1322_42%,#060914_100%)] px-3 py-3 text-neutral-100 md:px-4 lg:px-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1480px] flex-col gap-4">
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

        <main className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,540px)] xl:grid-cols-[minmax(0,1fr)_minmax(380px,560px)]">
          <div className="min-w-0 space-y-4 lg:max-w-[860px]">
            <EditorSidebar
              clips={session.activeVersion.clips}
              textOverlays={session.activeVersion.textOverlays}
              audioTracks={session.activeVersion.audioTracks}
              selectedClipId={session.selectedClipId}
              selectedTextId={session.selectedTextId}
              selectedAudioId={session.selectedAudioId}
              isExporting={session.isExporting}
              assetNames={session.assetNames}
              assets={session.assetList}
              onSelectClip={selectClip}
              onSelectText={selectText}
              onSelectAudio={selectAudio}
              onAddText={handleAddText}
              onFilesSelected={session.onFilesSelected}
              onRemoveAsset={session.onRemoveAsset}
            />

            <EditorMainContent
              aspect={session.activeAspect}
              version={session.activeVersion}
              assetNames={session.assetNames}
              previewAssetSources={session.previewAssetSources}
              selectedClipId={session.selectedClipId}
              selectedTextId={session.selectedTextId}
              selectedAudioId={session.selectedAudioId}
              isExporting={session.isExporting}
              onSelectClip={selectClip}
              onSelectText={selectText}
              onSelectAudio={selectAudio}
              onAddText={handleAddText}
              showPreview={false}
              onUpdateClip={(clipId, patch) => {
                session.dispatch({
                  type: "update-clip",
                  aspect: session.activeAspect,
                  clipId,
                  patch,
                });
              }}
              onMoveClip={(clipId, offset) => {
                session.dispatch({
                  type: "move-clip",
                  aspect: session.activeAspect,
                  clipId,
                  offset,
                });
              }}
              onRemoveClip={(clipId) => {
                session.dispatch({
                  type: "remove-clip",
                  aspect: session.activeAspect,
                  clipId,
                });
                if (session.selectedClipId === clipId) {
                  session.setSelectedClipId(null);
                }
              }}
              onSetTransition={(fromClipId, toClipId, durationInFrames) => {
                session.dispatch({
                  type: "set-transition",
                  aspect: session.activeAspect,
                  transition: {
                    id: `${fromClipId}-${toClipId}`,
                    type: "crossfade",
                    fromClipId,
                    toClipId,
                    durationInFrames,
                  },
                });
              }}
              onRemoveTransition={(fromClipId, toClipId) => {
                session.dispatch({
                  type: "remove-transition",
                  aspect: session.activeAspect,
                  fromClipId,
                  toClipId,
                });
              }}
              onUpdateText={(overlayId, patch) => {
                session.dispatch({
                  type: "update-text-overlay",
                  aspect: session.activeAspect,
                  overlayId,
                  patch,
                });
              }}
              onRemoveText={(overlayId) => {
                session.dispatch({
                  type: "remove-text-overlay",
                  aspect: session.activeAspect,
                  overlayId,
                });
                if (session.selectedTextId === overlayId) {
                  session.setSelectedTextId(null);
                }
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
                if (session.selectedAudioId === trackId) {
                  session.setSelectedAudioId(null);
                }
              }}
            />
          </div>

          <div className="space-y-4 lg:w-full lg:max-w-[560px] lg:justify-self-end">
            <PreviewPane
              aspect={session.activeAspect}
              version={session.activeVersion}
              assetSources={session.previewAssetSources}
            />

            <EditorRightSidebar
              selectedClip={session.selectedClip}
              selectedTextOverlay={session.selectedTextOverlay}
              selectedAudioTrack={session.selectedAudioTrack}
              isExporting={session.isExporting}
              activeMediaFootprintBytes={session.activeMediaFootprintBytes}
              onUpdateClip={(clipId, patch) => {
                session.dispatch({
                  type: "update-clip",
                  aspect: session.activeAspect,
                  clipId,
                  patch,
                });
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
            />
          </div>
        </main>
      </div>

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
