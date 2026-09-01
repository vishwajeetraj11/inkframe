"use client";

import {
  Timeline as ElahTimeline,
  useSelectionStore,
  type Project as ElahProject,
} from "@elah/editor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AssetRef, VersionTimeline } from "@/lib/editor/types";
import { sanitizeVersion } from "@/lib/editor/timeline";
import {
  fromElahProject,
  toElahProject,
  type InkframeElahSidecar,
} from "@/lib/editor/elah-adapter";
import { detectElahBrowserCapabilities } from "@/lib/editor/elah-browser-capabilities";
import { ElahEditorProvider } from "./ElahEditorProvider";
import "./inkframe-elah.css";

interface ElahTimelineDockProps {
  version: VersionTimeline;
  assets: readonly AssetRef[];
  assetSources: Readonly<Record<string, string>>;
  onVersionChange: (version: VersionTimeline) => void;
  onSelectClip: (clipId: string | null) => void;
  onSelectText: (overlayId: string | null) => void;
  onSelectAudio: (trackId: string | null) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const SelectionBridge = ({
  version,
  onSelectClip,
  onSelectText,
  onSelectAudio,
}: Pick<
  ElahTimelineDockProps,
  "version" | "onSelectClip" | "onSelectText" | "onSelectAudio"
>) => {
  const selectedClipIds = useSelectionStore((state) => state.selectedClipIds);

  useEffect(() => {
    const selectedId = selectedClipIds.values().next().value as string | undefined;
    if (!selectedId) return;

    if (version.clips.some((clip) => clip.id === selectedId)) {
      onSelectClip(selectedId);
    } else if (version.textOverlays.some((overlay) => overlay.id === selectedId)) {
      onSelectText(selectedId);
    } else if (version.audioTracks.some((track) => track.id === selectedId)) {
      onSelectAudio(selectedId);
    }
  }, [onSelectAudio, onSelectClip, onSelectText, selectedClipIds, version]);

  return null;
};

const ElahHistoryControls = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Pick<ElahTimelineDockProps, "canUndo" | "canRedo" | "onUndo" | "onRedo">) => {
  return (
    <div className="flex items-center gap-1 border-l border-white/10 pl-2">
      <button
        type="button"
        disabled={!canUndo}
        onClick={onUndo}
        className="min-h-10 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-300 outline-none transition hover:bg-white/[0.05] hover:text-neutral-50 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-35"
      >
        Undo
      </button>
      <button
        type="button"
        disabled={!canRedo}
        onClick={onRedo}
        className="min-h-10 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-300 outline-none transition hover:bg-white/[0.05] hover:text-neutral-50 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-35"
      >
        Redo
      </button>
    </div>
  );
};

export const ElahTimelineDock = ({
  version,
  assets,
  assetSources,
  onVersionChange,
  onSelectClip,
  onSelectText,
  onSelectAudio,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: ElahTimelineDockProps) => {
  const capabilities = useMemo(() => detectElahBrowserCapabilities(), []);
  const versionSignature = useMemo(() => JSON.stringify(version), [version]);
  const sourceSignature = useMemo(
    () =>
      JSON.stringify({
        assets: assets.map(({ assetId, externalUrl }) => ({ assetId, externalUrl })),
        assetSources,
      }),
    [assetSources, assets],
  );
  const projection = useMemo(
    () =>
      toElahProject(version, {
        assets,
        assetSources,
        projectId: `inkframe-${version.aspect}`,
      }),
    [assetSources, assets, version],
  );
  const sidecarRef = useRef<InkframeElahSidecar>(projection.sidecar);
  const [elahEcho, setElahEcho] = useState<{
    project: ElahProject;
    syncSignature: string;
  } | null>(null);

  useEffect(() => {
    sidecarRef.current = projection.sidecar;
  }, [projection.sidecar]);

  const handleProjectChange = useCallback(
    (project: ElahProject) => {
      const next = fromElahProject(project, sidecarRef.current);
      const sanitizedVersion = sanitizeVersion(next.version);
      if (!sanitizedVersion) return;
      sidecarRef.current = {
        ...sidecarRef.current,
        canonicalVersion: sanitizedVersion,
      };
      setElahEcho({
        project,
        syncSignature: `${JSON.stringify(sanitizedVersion)}:${sourceSignature}`,
      });
      onVersionChange(sanitizedVersion);
    },
    [onVersionChange, sourceSignature],
  );

  // Keep Elah's own project object after an Elah-originated edit. Reloading the
  // freshly projected echo would churn the engine while session history remains canonical.
  const syncSignature = `${versionSignature}:${sourceSignature}`;
  const projectForProvider =
    elahEcho?.syncSignature === syncSignature ? elahEcho.project : projection.project;

  if (!capabilities.ready.timeline) {
    return (
      <div className="flex min-h-40 items-center justify-center border border-dashed border-white/15 p-6 text-center text-sm text-neutral-400">
        This browser cannot start the interactive timeline. The Remotion editor remains available.
      </div>
    );
  }

  return (
    <ElahEditorProvider
      className="inkframe-elah flex h-full min-h-[360px] flex-col xl:min-h-0"
      project={projectForProvider}
      onProjectChange={handleProjectChange}
    >
      <SelectionBridge
        version={version}
        onSelectClip={onSelectClip}
        onSelectText={onSelectText}
        onSelectAudio={onSelectAudio}
      />
      <div className="flex min-h-12 items-center justify-between border-b border-white/10 px-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 bg-cyan-300" />
          <span className="app-eyebrow text-[10px] uppercase tracking-[0.16em] text-neutral-300">
            Elah interactive timeline
          </span>
        </div>
        <ElahHistoryControls
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <ElahTimeline fps={projectForProvider.fps} compactSidebar sidebarWidth={136} />
      </div>
    </ElahEditorProvider>
  );
};
