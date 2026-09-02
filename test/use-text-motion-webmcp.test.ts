import { describe, expect, it, vi } from "vitest";
import { startTextMotionWebMcpExport } from "@/components/text-motion/hooks/use-text-motion-webmcp";

describe("Text Motion WebMCP export", () => {
  it("starts local rendering without blocking the agent tool", () => {
    const exportProject = vi.fn(
      () => new Promise<{ ok: boolean; message: string }>(() => undefined),
    );

    expect(startTextMotionWebMcpExport(exportProject)).toBeUndefined();
    expect(exportProject).toHaveBeenCalledOnce();
  });
});
