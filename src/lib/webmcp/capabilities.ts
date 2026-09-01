import type { WebMCPDocument, WebMCPModelContext } from "./types";

export interface WebMCPCapabilities {
  modelContext: boolean;
  registerTool: boolean;
  unregisterTool: boolean;
}

export function getWebMCPModelContext(
  documentLike?: WebMCPDocument | null,
): WebMCPModelContext | null {
  const context = documentLike?.modelContext;
  return context && typeof context.registerTool === "function" ? context : null;
}

/** Detect WebMCP without touching browser globals during SSR. */
export function detectWebMCPCapabilities(
  documentLike?: WebMCPDocument | null,
): WebMCPCapabilities {
  const context = getWebMCPModelContext(
    documentLike ?? (typeof document !== "undefined" ? (document as WebMCPDocument) : null),
  );

  return {
    modelContext: context !== null,
    registerTool: context !== null,
    unregisterTool: context?.unregisterTool !== undefined,
  };
}

export const isWebMCPSupported = (
  documentLike?: WebMCPDocument | null,
): boolean => detectWebMCPCapabilities(documentLike).registerTool;
