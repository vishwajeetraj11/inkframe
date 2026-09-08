import { describe, expect, it } from "vitest";
import { createEditorWebMcpTools } from "@/lib/editor/webmcp/tools";
import { createInkframeWebMcpTools } from "@/lib/webmcp/inkframe-tools";
import { createInitialEditorHistory } from "@/lib/editor/history";

const compactMetadata = (tool: ReturnType<typeof createEditorWebMcpTools>[number]) => {
  const { title: _title, ...withoutTitle } = tool;
  const { $schema: _schema, ...inputSchema } = tool.inputSchema;
  return { ...withoutTitle, inputSchema };
};

describe("WebMCP catalog budget", () => {
  it("keeps the combined root and editor metadata under the browser limit", () => {
    const editor = createEditorWebMcpTools({ getState: createInitialEditorHistory });
    const root = createInkframeWebMcpTools({ navigate: () => undefined });
    const bytes = new TextEncoder().encode(JSON.stringify([...root, ...editor].map(compactMetadata))).byteLength;
    expect(bytes).toBeLessThanOrEqual(65_536);
  });
});
