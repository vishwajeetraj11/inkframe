import { describe, expect, it, vi } from "vitest";
import {
  detectWebMCPCapabilities,
  isWebMCPSupported,
} from "@/lib/webmcp/capabilities";
import { registerWebMCPTools } from "@/lib/webmcp/registry";
import type { WebMCPTool } from "@/lib/webmcp/types";

const tools: WebMCPTool[] = [
  { name: "one", description: "one", inputSchema: {}, execute: vi.fn() },
  { name: "two", description: "two", inputSchema: {}, execute: vi.fn() },
];

describe("WebMCP runtime", () => {
  it("is SSR-safe and reports unsupported without a model context", () => {
    expect(detectWebMCPCapabilities(null)).toEqual({
      modelContext: false,
      registerTool: false,
      unregisterTool: false,
      getTools: false,
      executeTool: false,
    });
    expect(isWebMCPSupported(null)).toBe(false);
  });

  it("registers tools independently and aborts them during cleanup", async () => {
    const signals: AbortSignal[] = [];
    const unregisterTool = vi.fn();
    const registerTool = vi.fn(async (tool: WebMCPTool, options?: { signal?: AbortSignal }) => {
      signals.push(options!.signal!);
      if (tool.name === "two") throw new Error("nope");
    });
    const registration = await registerWebMCPTools(tools, {
      modelContext: { registerTool, unregisterTool },
    });

    expect(registerTool).toHaveBeenCalledTimes(2);
    expect(registration.registered).toEqual(["one"]);
    expect(registration.failed.map(({ tool }) => tool.name)).toEqual(["two"]);
    expect(signals[0].aborted).toBe(false);
    await registration.cleanup();
    expect(signals[0].aborted).toBe(true);
    expect(unregisterTool).toHaveBeenCalledWith("one");
  });
});
