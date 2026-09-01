"use client";

import "@elah/editor/styles/tokens.css";
import "./elah-vendor-scoped.css";

import {
  EditorProvider,
  useTimelineEngine,
  type Project as ElahProject,
  type TimelineEngine,
} from "@elah/editor";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { FPS } from "@/lib/editor/constants";

export interface ElahEditorProviderProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  project?: ElahProject;
  onProjectChange?: (project: ElahProject) => void;
  onEngineReady?: (engine: TimelineEngine) => void;
}

interface ProjectBridgeProps {
  project?: ElahProject;
  onProjectChange?: (project: ElahProject) => void;
  onEngineReady?: (engine: TimelineEngine) => void;
}

const ProjectBridge = ({
  project,
  onProjectChange,
  onEngineReady,
}: ProjectBridgeProps) => {
  const engine = useTimelineEngine();
  const onProjectChangeRef = useRef(onProjectChange);
  const onEngineReadyRef = useRef(onEngineReady);
  const isLoadingProjectRef = useRef(false);

  useEffect(() => {
    onProjectChangeRef.current = onProjectChange;
  }, [onProjectChange]);

  useEffect(() => {
    onEngineReadyRef.current = onEngineReady;
  }, [onEngineReady]);

  useLayoutEffect(() => {
    if (project && project !== engine.getProject()) {
      isLoadingProjectRef.current = true;
      try {
        engine.loadProject(project);
      } finally {
        isLoadingProjectRef.current = false;
      }
    }
  }, [engine, project]);

  useEffect(() => {
    const handleChange = (nextProject: ElahProject) => {
      if (isLoadingProjectRef.current) return;
      onProjectChangeRef.current?.(nextProject);
    };
    engine.on("change", handleChange);
    onEngineReadyRef.current?.(engine);
    return () => engine.off("change", handleChange);
  }, [engine]);

  return null;
};

/**
 * Client-only Elah boundary. It loads a projected Inkframe project into Elah's
 * engine and scopes Elah's design tokens beneath `.elah-root`.
 */
export const ElahEditorProvider = ({
  children,
  className,
  style,
  project,
  onProjectChange,
  onEngineReady,
}: ElahEditorProviderProps) => {
  const fps = project?.fps ?? FPS;
  const stage = project?.stage;
  const providerKey = project
    ? `${project.id}:${project.fps}:${project.stage.width}x${project.stage.height}`
    : `inkframe:${fps}`;

  return (
    <div className={["elah-root", className].filter(Boolean).join(" ")} style={style}>
      <EditorProvider key={providerKey} fps={fps} stage={stage}>
        <ProjectBridge
          project={project}
          onProjectChange={onProjectChange}
          onEngineReady={onEngineReady}
        />
        {children}
      </EditorProvider>
    </div>
  );
};
