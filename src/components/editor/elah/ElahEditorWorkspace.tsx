"use client";

import type { Project as ElahProject } from "@elah/editor";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AssetRef, VersionTimeline, VideoFilter } from "@/lib/editor/types";
import { sanitizeVersion } from "@/lib/editor/timeline";
import {
  fromElahProject,
  toElahProject,
  type InkframeElahSidecar,
} from "@/lib/editor/elah-adapter";
import { ElahEditorProvider } from "./ElahEditorProvider";
import { ElahMediaLibraryBridge } from "./ElahMediaLibraryBridge";

interface ElahEditorWorkspaceProps {
  colorPreview?: Readonly<Record<string, VideoFilter>> | null;
  version: VersionTimeline;
  assets: readonly AssetRef[];
  assetSources: Readonly<Record<string, string>>;
  onVersionChange: (version: VersionTimeline) => void;
  children: ReactNode;
}

export const ElahEditorWorkspace = ({
  colorPreview,
  version,
  assets,
  assetSources,
  onVersionChange,
  children,
}: ElahEditorWorkspaceProps) => {
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
      // A temporary comparison must never enter saved history through native edits.
      if (colorPreview) {
        next.version.clips = next.version.clips.map((clip) => colorPreview[clip.id]
          ? { ...clip, videoFilter: version.clips.find((original) => original.id === clip.id)?.videoFilter }
          : clip);
      }
      const sanitizedVersion = sanitizeVersion(next.version);
      if (!sanitizedVersion || next.rejected) {
        // A fresh accepted projection forces the native engine back to the
        // canonical timeline even when the parent version did not change.
        const accepted = toElahProject(sidecarRef.current.canonicalVersion, {
          assets,
          assetSources,
          projectId: project.id,
        });
        sidecarRef.current = accepted.sidecar;
        setElahEcho({
          project: accepted.project,
          syncSignature: `${JSON.stringify(accepted.sidecar.canonicalVersion)}:${sourceSignature}`,
        });
        return;
      }
      const accepted = toElahProject(sanitizedVersion, {
        assets,
        assetSources,
        projectId: project.id,
      });
      sidecarRef.current = accepted.sidecar;
      setElahEcho({
        // Regenerate linked embedded audio after native moves, trims and splits.
        project: accepted.project,
        syncSignature: `${JSON.stringify(sanitizedVersion)}:${sourceSignature}`,
      });
      onVersionChange(sanitizedVersion);
    },
    [assetSources, assets, onVersionChange, sourceSignature, colorPreview, version],
  );

  const syncSignature = `${versionSignature}:${sourceSignature}`;
  const projectForProvider =
    elahEcho?.syncSignature === syncSignature ? elahEcho.project : projection.project;
  const previewProject = useMemo(() => {
    if (!colorPreview) return projectForProvider;
    const project = structuredClone(projectForProvider);
    for (const clips of Object.values(project.clips)) {
      for (const clip of clips) {
        if (colorPreview[clip.id] && (clip.type === "video" || clip.type === "image")) {
          (clip as typeof clip & { videoFilter?: VideoFilter }).videoFilter = colorPreview[clip.id];
        }
      }
    }
    return project;
  }, [colorPreview, projectForProvider]);

  return (
    <ElahEditorProvider
      className="contents"
      project={previewProject}
      onProjectChange={handleProjectChange}
    >
      <ElahMediaLibraryBridge
        assets={assets}
        assetSources={assetSources}
        version={version}
      />
      {children}
    </ElahEditorProvider>
  );
};
