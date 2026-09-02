"use client";

import { registerWebMCPTools } from "@/lib/webmcp/registry";
import type { WebMcpTool } from "@/lib/webmcp/types";
import { useEffect, useLayoutEffect, useRef } from "react";

export type WebMcpToolFactory<T> = (getCurrent: () => T) => readonly WebMcpTool[];

/**
 * Register page-scoped WebMCP tools while keeping their handlers connected to
 * the latest React state. The existing interface remains the fallback when the
 * draft browser API is unavailable.
 */
export const useWebMcpTools = <T>(
  current: T,
  createTools: WebMcpToolFactory<T>,
): void => {
  const currentRef = useRef(current);

  useLayoutEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let cleanup: (() => Promise<void>) | null = null;

    void registerWebMCPTools(createTools(() => currentRef.current), {
      signal: controller.signal,
    }).then((registration) => {
      cleanup = registration.cleanup;
      // If React Strict Mode disposed this effect while async registration was
      // settling, the aborted registration signal owns cleanup. Explicitly
      // unregistering by name here can delete the replacement registration
      // created by the second Strict Mode mount.
      if (disposed) cleanup = null;
    });

    return () => {
      disposed = true;
      controller.abort();
      void cleanup?.();
    };
  }, [createTools]);
};
