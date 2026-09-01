"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useWebMcpTools, type WebMcpToolFactory } from "./use-webmcp-tools";
import {
  createInkframeWebMcpTools,
  type InkframeWebMcpToolContext,
} from "@/lib/webmcp/inkframe-tools";

const createTools: WebMcpToolFactory<InkframeWebMcpToolContext> = (getCurrent) =>
  createInkframeWebMcpTools({
    navigate: (path) => getCurrent().navigate(path),
  });

/** Register site-wide tools while the root layout is mounted. */
export const InkframeWebMcp = () => {
  const router = useRouter();
  const bridge = useMemo<InkframeWebMcpToolContext>(
    () => ({ navigate: (path) => router.push(path) }),
    [router],
  );

  useWebMcpTools(bridge, createTools);
  return null;
};
