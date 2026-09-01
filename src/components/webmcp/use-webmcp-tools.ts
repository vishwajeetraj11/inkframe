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
      if (disposed) {
        void registration.cleanup();
      }
    });

    return () => {
      disposed = true;
      controller.abort();
      void cleanup?.();
    };
  }, [createTools]);
};
