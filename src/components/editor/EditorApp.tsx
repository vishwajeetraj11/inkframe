"use client";

import { AIChatDrawer } from "@/components/editor/AIChatDrawer";
import { AspectSwitcher } from "@/components/editor/AspectSwitcher";
import { Inspector } from "@/components/editor/Inspector";
import { MediaLibrary } from "@/components/editor/MediaLibrary";
import { PreviewPane } from "@/components/editor/PreviewPane";
import { Timeline } from "@/components/editor/Timeline";
import { createDefaultTextOverlay } from "@/lib/editor/defaults";
import { nanoid } from "nanoid";
import { bytesToLabel } from "./hooks/editor-session-config";
import { useEditorSession } from "./hooks/use-editor-session";

export const EditorApp = () => {
  const session = useEditorSession();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937,_#020617_65%)] px-4 py-6 text-neutral-100 md:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="rounded-2xl border border-neutral-700/60 bg-neutral-900/60 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="app-title text-2xl font-semibold tracking-tight md:text-3xl">
                Ephemeral Video Editor
              </h1>
              <p className="text-sm text-neutral-300">
                Session-only project. No assets or exports are persisted after render.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <AspectSwitcher
                activeAspect={session.activeAspect}
                disabled={session.isExporting}
                onChange={session.switchAspect}
              />

              <button
                type="button"
                disabled={
                  session.isExporting ||
                  (session.activeVersion.clips.length === 0 &&
                    session.activeVersion.textOverlays.length === 0)
                }
                onClick={() => {
                  void session.onExport();
                }}
                className="rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {session.isExporting ? "Rendering..." : "Export MP4"}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-300">
            <span className="app-data rounded bg-neutral-800 px-2 py-1">
              Timeline: {(session.timelineDurationInFrames / 30).toFixed(2)}s
            </span>
            <span className="app-data rounded bg-neutral-800 px-2 py-1">
              Remaining: {(session.remainingFrames / 30).toFixed(2)}s
            </span>
            <span className="app-data rounded bg-neutral-800 px-2 py-1">
              Assets: {session.assetList.length}
            </span>
            <span className="app-data rounded bg-neutral-800 px-2 py-1">
              Upload caps: video 100MB, image 10MB (JPG/PNG/WEBP), audio 100MB
            </span>
          </div>

          {session.statusMessage ? (
            <p className="mt-3 rounded-lg border border-neutral-700 bg-neutral-800/70 px-3 py-2 text-sm text-neutral-200">
              {session.statusMessage}
            </p>
          ) : null}
        </header>

        <main className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <MediaLibrary
              assets={session.assetList.map((asset) => ({
                assetId: asset.assetId,
                kind: asset.kind,
                name: asset.name,
                size: asset.size,
              }))}
              disabled={session.isExporting}
              onFilesSelected={session.onFilesSelected}
              onRemoveAsset={session.onRemoveAsset}
            />

            <Timeline
              version={session.activeVersion}
              assetNames={session.assetNames}
              selectedClipId={session.selectedClipId}
              selectedTextId={session.selectedTextId}
              selectedAudioId={session.selectedAudioId}
              disabled={session.isExporting}
              onSelectClip={(clipId) => {
                session.setSelectedClipId(clipId);
                session.setSelectedTextId(null);
                session.setSelectedAudioId(null);
              }}
              onSelectText={(textId) => {
                session.setSelectedTextId(textId);
                session.setSelectedClipId(null);
                session.setSelectedAudioId(null);
              }}
              onSelectAudio={(audioId) => {
                session.setSelectedAudioId(audioId);
                session.setSelectedClipId(null);
                session.setSelectedTextId(null);
              }}
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
              onAddText={() => {
                const overlayId = nanoid(10);
                session.setSelectedTextId(overlayId);
                session.setSelectedClipId(null);
                session.setSelectedAudioId(null);
                session.dispatch({
                  type: "add-text-overlay",
                  aspect: session.activeAspect,
                  overlay: createDefaultTextOverlay(overlayId),
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

          <div className="space-y-4">
            <PreviewPane
              aspect={session.activeAspect}
              version={session.activeVersion}
              assetSources={session.previewAssetSources}
            />

            <Inspector
              clip={session.selectedClip}
              textOverlay={session.selectedTextOverlay}
              audioTrack={session.selectedAudioTrack}
              disabled={session.isExporting}
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

            <section className="rounded-2xl border border-neutral-700/60 bg-neutral-900/50 p-4 text-xs text-neutral-400">
              <p>
                Active media footprint: {session.activeMediaFootprintBytes > 0 ? bytesToLabel(session.activeMediaFootprintBytes) : "0 B"}
              </p>
              <p className="mt-1">
                Data lifecycle: files exist only in browser memory and temporary server folders during export.
              </p>
            </section>
          </div>
        </main>
      </div>
      <AIChatDrawer
        editorContext={session.editorChatContext}
        onApplyEditorActions={session.onApplyEditorActions}
        onRenderVideoRequest={session.onExport}
      />
    </div>
  );
};
