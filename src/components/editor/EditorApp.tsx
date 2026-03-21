"use client";

import { AIChatDrawer } from "@/components/editor/AIChatDrawer";
import { AspectSwitcher } from "@/components/editor/AspectSwitcher";
import { Inspector } from "@/components/editor/Inspector";
import { MediaLibrary } from "@/components/editor/MediaLibrary";
import { PreviewPane } from "@/components/editor/PreviewPane";
import { Timeline } from "@/components/editor/Timeline";
import { createDefaultTextOverlay } from "@/lib/editor/defaults";
import { TEXT_OVERLAY_STYLE_PRESET_LABELS } from "@/lib/editor/types";
import { nanoid } from "nanoid";
import { bytesToLabel } from "./hooks/editor-session-config";
import { useEditorSession } from "./hooks/use-editor-session";

const aspectLabel = (value: "reel_9_16" | "widescreen_16_9"): string =>
  value === "reel_9_16" ? "9:16" : "16:9";

const kindPillClassName = (kind: "clip" | "text" | "audio"): string =>
  kind === "clip"
    ? "border-emerald-300/20 bg-emerald-300/12 text-emerald-100"
    : kind === "text"
      ? "border-cyan-300/20 bg-cyan-300/12 text-cyan-100"
      : "border-amber-300/20 bg-amber-300/12 text-amber-100";

export const EditorApp = () => {
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#23324b_0%,#0c1322_42%,#060914_100%)] px-3 py-3 text-neutral-100 md:px-4 lg:px-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1800px] flex-col gap-4">
        <header className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(28,33,45,0.96),rgba(13,17,27,0.9))] px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.32)] backdrop-blur-md md:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="app-eyebrow rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-cyan-200">
                  Ephemeral Studio
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                  Session-only
                </span>
              </div>

              <h1 className="app-title mt-3 text-2xl font-semibold tracking-[-0.05em] text-white md:text-3xl">
                Video editor with a real studio workspace
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
                Cut footage, manage overlays, preview Remotion output, and export without leaving
                the same workspace.
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
                className="rounded-xl bg-[linear-gradient(135deg,#67e8f9,#34d399)] px-4 py-2.5 text-sm font-semibold text-neutral-950 shadow-[0_16px_38px_rgba(52,211,153,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {session.isExporting ? "Rendering..." : "Export MP4"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {workspaceStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2"
              >
                <p className="app-eyebrow text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                  {stat.label}
                </p>
                <p className="app-data mt-1 text-sm font-medium text-neutral-100">{stat.value}</p>
              </div>
            ))}

            <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2">
              <p className="app-eyebrow text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                Upload Caps
              </p>
              <p className="mt-1 text-sm text-neutral-300">
                Video 100MB, image 10MB, audio 100MB
              </p>
            </div>
          </div>

          {session.statusMessage ? (
            <p className="mt-4 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-neutral-200">
              {session.statusMessage}
            </p>
          ) : null}
        </header>

        <main className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
          <aside className="space-y-4 xl:min-h-0">
            <section className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(28,33,45,0.9),rgba(12,15,23,0.88))] p-4 shadow-[0_18px_52px_rgba(0,0,0,0.22)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-neutral-500">
                    Project
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-white">Workspace Navigator</h2>
                </div>

                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                  {session.activeVersion.clips.length + session.activeVersion.textOverlays.length + session.activeVersion.audioTracks.length} layers
                </span>
              </div>

              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Use the left rail to manage assets and jump between clips, overlays, and audio.
              </p>
            </section>

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

            <section className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(28,33,45,0.9),rgba(12,15,23,0.88))] p-4 shadow-[0_18px_52px_rgba(0,0,0,0.22)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-neutral-500">
                    Layers
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-white">Active Timeline Items</h2>
                </div>

                <button
                  type="button"
                  disabled={session.isExporting}
                  onClick={() => {
                    const overlayId = nanoid(10);
                    selectText(overlayId);
                    session.dispatch({
                      type: "add-text-overlay",
                      aspect: session.activeAspect,
                      overlay: createDefaultTextOverlay(overlayId),
                    });
                  }}
                  className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/16 disabled:opacity-60"
                >
                  Add Text
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="app-eyebrow text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                      Clips
                    </p>
                    <span className="text-xs text-neutral-500">
                      {session.activeVersion.clips.length}
                    </span>
                  </div>

                  {session.activeVersion.clips.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-white/8 px-3 py-3 text-sm text-neutral-500">
                      No clips yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {session.activeVersion.clips.map((clip, index) => (
                        <button
                          key={clip.id}
                          type="button"
                          onClick={() => selectClip(clip.id)}
                          className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                            session.selectedClipId === clip.id
                              ? "border-emerald-300/35 bg-emerald-300/10 shadow-[0_0_0_1px_rgba(110,231,183,0.14)]"
                              : "border-white/8 bg-white/[0.03] hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">
                                {session.assetNames[clip.assetId] ?? `Clip ${index + 1}`}
                              </p>
                              <p className="mt-1 text-xs text-neutral-500">
                                {clip.kind} • {((clip.endFrame - clip.startFrame) / 30).toFixed(2)}s
                              </p>
                            </div>

                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${kindPillClassName("clip")}`}
                            >
                              clip
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="app-eyebrow text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                      Text Overlays
                    </p>
                    <span className="text-xs text-neutral-500">
                      {session.activeVersion.textOverlays.length}
                    </span>
                  </div>

                  {session.activeVersion.textOverlays.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-white/8 px-3 py-3 text-sm text-neutral-500">
                      No text overlays.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {session.activeVersion.textOverlays.map((overlay, index) => (
                        <button
                          key={overlay.id}
                          type="button"
                          onClick={() => selectText(overlay.id)}
                          className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                            session.selectedTextId === overlay.id
                              ? "border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(103,232,249,0.14)]"
                              : "border-white/8 bg-white/[0.03] hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">
                                {overlay.text.split("\n")[0] || `Text ${index + 1}`}
                              </p>
                              <p className="mt-1 text-xs text-neutral-500">
                                {TEXT_OVERLAY_STYLE_PRESET_LABELS[overlay.stylePreset]}
                              </p>
                            </div>

                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${kindPillClassName("text")}`}
                            >
                              text
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="app-eyebrow text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                      Audio
                    </p>
                    <span className="text-xs text-neutral-500">
                      {session.activeVersion.audioTracks.length}
                    </span>
                  </div>

                  {session.activeVersion.audioTracks.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-white/8 px-3 py-3 text-sm text-neutral-500">
                      No audio tracks.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {session.activeVersion.audioTracks.map((track, index) => (
                        <button
                          key={track.id}
                          type="button"
                          onClick={() => selectAudio(track.id)}
                          className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                            session.selectedAudioId === track.id
                              ? "border-amber-300/35 bg-amber-300/10 shadow-[0_0_0_1px_rgba(252,211,77,0.14)]"
                              : "border-white/8 bg-white/[0.03] hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">
                                {session.assetNames[track.assetId] ?? `Audio ${index + 1}`}
                              </p>
                              <p className="mt-1 text-xs text-neutral-500">
                                {((track.endFrame - track.startFrame) / 30).toFixed(2)}s
                              </p>
                            </div>

                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${kindPillClassName("audio")}`}
                            >
                              audio
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </aside>

          <section className="space-y-4 xl:min-h-0">
            <PreviewPane
              aspect={session.activeAspect}
              version={session.activeVersion}
              assetSources={session.previewAssetSources}
            />

            <Timeline
              version={session.activeVersion}
              assetNames={session.assetNames}
              selectedClipId={session.selectedClipId}
              selectedTextId={session.selectedTextId}
              selectedAudioId={session.selectedAudioId}
              disabled={session.isExporting}
              onSelectClip={selectClip}
              onSelectText={selectText}
              onSelectAudio={selectAudio}
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
                selectText(overlayId);
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
          </section>

          <aside className="space-y-4 xl:min-h-0">
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

            <section className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(28,33,45,0.9),rgba(12,15,23,0.88))] p-4 shadow-[0_18px_52px_rgba(0,0,0,0.22)]">
              <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-neutral-500">
                Session Memory
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {session.activeMediaFootprintBytes > 0
                  ? bytesToLabel(session.activeMediaFootprintBytes)
                  : "0 B"}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Assets live only in browser memory and temporary server folders during export.
              </p>
            </section>
          </aside>
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
