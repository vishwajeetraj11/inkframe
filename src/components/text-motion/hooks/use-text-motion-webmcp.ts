"use client";

import { useWebMcpTools, type WebMcpToolFactory } from "@/components/webmcp/use-webmcp-tools";
import type { TextMotionProject } from "@/lib/text-motion/types";
import type { TextMotionTemplate } from "@/lib/text-motion/types";
import { createTextMotionWebMcpTools } from "@/lib/text-motion/webmcp";
import { flushSync } from "react-dom";

export interface TextMotionWebMcpBridge {
  project: TextMotionProject;
  setProject: (project: TextMotionProject) => void;
  loadTemplate: (template: TextMotionTemplate) => void;
  exportProject: (signal: AbortSignal) => Promise<{ ok: boolean; message: string }>;
  requestImagePicker: () => void;
}

export const startTextMotionWebMcpExport = (
  exportProject: () => Promise<{ ok: boolean; message: string }>,
): void => {
  void exportProject().catch(() => undefined);
};

const createTools: WebMcpToolFactory<TextMotionWebMcpBridge> = (getCurrent) =>
  createTextMotionWebMcpTools({
    getProject: () => getCurrent().project,
    setProject: (project) => flushSync(() => getCurrent().setProject(project)),
    loadTemplate: (template) => flushSync(() => getCurrent().loadTemplate(template)),
    exportProject: () =>
      startTextMotionWebMcpExport(() =>
        getCurrent().exportProject(new AbortController().signal),
      ),
    requestImagePicker: () => getCurrent().requestImagePicker(),
  });

export const useTextMotionWebMcp = (bridge: TextMotionWebMcpBridge): void => {
  useWebMcpTools(bridge, createTools);
};
