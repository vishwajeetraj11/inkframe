import { describe, expect, it, vi } from "vitest";
import { startEditorWebMcpExport } from "@/components/editor/hooks/use-editor-webmcp";

describe("editor WebMCP export", () => {
  it("acknowledges the request without waiting for the render", async () => {
    let finishRender: ((value: { ok: boolean; message: string }) => void) | undefined;
    const render = new Promise<{ ok: boolean; message: string }>((resolve) => {
      finishRender = resolve;
    });
    const requestExport = vi.fn(() => render);

    expect(startEditorWebMcpExport(requestExport)).toEqual({
      ok: true,
      message: "Export started. The MP4 download will begin when rendering completes.",
    });
    expect(requestExport).toHaveBeenCalledOnce();

    finishRender?.({ ok: true, message: "Exported" });
    await render;
  });
});
