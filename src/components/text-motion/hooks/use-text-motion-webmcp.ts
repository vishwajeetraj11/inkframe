"use client";

import { useWebMcpTools, type WebMcpToolFactory } from "@/components/webmcp/use-webmcp-tools";
import type { TextMotionProject } from "@/lib/text-motion/types";
import type { TextMotionTemplate } from "@/lib/text-motion/types";
import { createTextMotionWebMcpTools } from "@/lib/text-motion/webmcp";
import { flushSync } from "react-dom";

export interface TextMotionWebMcpBridge {
  project: TextMotionProject;
  setProject: (project: TextMotionProject) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  loadTemplate: (template: TextMotionTemplate) => void;
  generate: (prompt: string, signal: AbortSignal) => Promise<{ ok: boolean; message: string }>;
  exportProject: (signal: AbortSignal) => Promise<{ ok: boolean; message: string }>;
  requestImagePicker: () => void;
}

const createTools: WebMcpToolFactory<TextMotionWebMcpBridge> = (getCurrent) =>
  createTextMotionWebMcpTools({
    getProject: () => getCurrent().project,
    setProject: (project) => flushSync(() => getCurrent().setProject(project)),
    getPrompt: () => getCurrent().prompt,
    setPrompt: (prompt) => flushSync(() => getCurrent().setPrompt(prompt)),
    loadTemplate: (template) => flushSync(() => getCurrent().loadTemplate(template)),
    generate: async (prompt, signal) => {
      const result = await getCurrent().generate(prompt, signal);
      if (!result.ok) throw new Error(result.message);
    },
    exportProject: async (signal) => {
      const result = await getCurrent().exportProject(signal);
      if (!result.ok) throw new Error(result.message);
    },
    requestImagePicker: () => getCurrent().requestImagePicker(),
  });

export const useTextMotionWebMcp = (bridge: TextMotionWebMcpBridge): void => {
  useWebMcpTools(bridge, createTools);
};
