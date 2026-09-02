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
import type { AssetRef, VersionTimeline } from "@/lib/editor/types";
import { sanitizeVersion } from "@/lib/editor/timeline";
import {
  fromElahProject,
  toElahProject,
  type InkframeElahSidecar,
} from "@/lib/editor/elah-adapter";
import { ElahEditorProvider } from "./ElahEditorProvider";
import { ElahMediaLibraryBridge } from "./ElahMediaLibraryBridge";

interface ElahEditorWorkspaceProps {
  version: VersionTimeline;
  assets: readonly AssetRef[];
  assetSources: Readonly<Record<string, string>>;
  onVersionChange: (version: VersionTimeline) => void;
  children: ReactNode;
}

export const ElahEditorWorkspace = ({
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

  const syncSignature = `${versionSignature}:${sourceSignature}`;
  const projectForProvider =
    elahEcho?.syncSignature === syncSignature ? elahEcho.project : projection.project;

  return (
    <ElahEditorProvider
      className="contents"
      project={projectForProvider}
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
