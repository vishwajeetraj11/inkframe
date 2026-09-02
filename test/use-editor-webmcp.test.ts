import { describe, expect, it, vi } from "vitest";
import { startEditorWebMcpExport } from "@/components/editor/hooks/use-editor-webmcp";

describe("editor WebMCP export", () => {
  it("returns the export job acknowledgement", () => {
    const requestExport = vi.fn(() => ({
      ok: true,
      message: "Export started",
      jobId: "export-1",
    }));

    expect(startEditorWebMcpExport(requestExport)).toEqual({
      ok: true,
      message: "Export started",
      jobId: "export-1",
    });
    expect(requestExport).toHaveBeenCalledOnce();
  });
});
