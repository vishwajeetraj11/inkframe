import { describe, expect, it, vi } from "vitest";
import { createInkframeWebMcpTools } from "@/lib/webmcp/inkframe-tools";

const executeOptions = { signal: new AbortController().signal };

const setup = () => {
  const navigate = vi.fn();
  const tools = createInkframeWebMcpTools({ navigate });
  return { tools, navigate };
};

describe("Inkframe WebMCP tools", () => {
  it("exposes capabilities, routes, and bounded catalog tools", async () => {
    const { tools } = setup();
    expect(tools.map((tool) => tool.name)).toEqual([
      "get_capabilities",
      "list_templates",
      "navigate_workspace",
      "open_template",
    ]);

    const capabilities = tools[0];
    const capabilitiesResult = JSON.parse(await capabilities.execute({}, executeOptions));
    expect(capabilitiesResult.editorTools.availableOn).toBe("/editor");
    expect(capabilitiesResult.routes.map((route: { path: string }) => route.path)).toEqual([
      "/",
      "/editor",
      "/templates",
    ]);
    expect(capabilitiesResult.routes.map((route: { path: string }) => route.path)).not.toContain("/remote-renderer");
    expect(capabilitiesResult.routes.map((route: { path: string }) => route.path)).not.toContain("https://example.com");

    const list = tools[1];
    const result = JSON.parse(await list.execute({ kind: "editor", limit: 20 }, executeOptions));
    expect(result.templates.every((template: { kind: string }) => template.kind === "editor")).toBe(true);
    expect(result.templates).toEqual([
      expect.objectContaining({
        id: "agent-demo-reel",
        kind: "editor",
        editable: true,
        aspect: "reel_9_16",
      }),
      expect.objectContaining({
        id: "one-number",
        kind: "editor",
        editable: true,
        editableTextLayers: 9,
        durationSeconds: 358 / 30,
      }),
    ]);
    expect(result.returned).toBeLessThanOrEqual(20);
    expect((await list.execute({ query: "does-not-exist" }, executeOptions))).toContain('"total":0');
    expect(list.inputSchema).toMatchObject({ type: "object", additionalProperties: false });
  });

  it("navigates only to known routes and validated editor templates", async () => {
    const { tools, navigate } = setup();
    const navigateTool = tools.find((tool) => tool.name === "navigate_workspace")!;
    const openTemplate = tools.find((tool) => tool.name === "open_template")!;

    await navigateTool.execute({ route: "templates", confirmed: true }, executeOptions);
    expect(navigate).toHaveBeenCalledWith("/templates");
    await openTemplate.execute({ templateId: "agent-demo-reel", confirmed: true }, executeOptions);
    expect(navigate).toHaveBeenCalledWith("/editor?template=agent-demo-reel");
    const openResult = JSON.parse(
      await openTemplate.execute({ templateId: "one-number", confirmed: true }, executeOptions),
    );
    expect(navigate).toHaveBeenCalledWith("/editor?template=one-number");
    expect(openResult.nextAction).toContain("editor_* tools");
    await expect(openTemplate.execute({ templateId: "documentary-cut", confirmed: true }, executeOptions)).rejects.toThrow();

    await expect(navigateTool.execute({ route: "https://example.com", confirmed: true }, executeOptions)).rejects.toThrow();
    await expect(openTemplate.execute({ templateId: "../../admin", confirmed: true }, executeOptions)).rejects.toThrow();
    await expect(navigateTool.execute({ route: "home" }, executeOptions)).rejects.toThrow();
  });

  it("honors cancellation before invoking a handler", async () => {
    const { tools, navigate } = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(
      tools[2].execute({ route: "home", confirmed: true }, { signal: controller.signal }),
    ).rejects.toThrow();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("supports WebMCP hosts that omit execution options", async () => {
    const { tools } = setup();
    const result = await tools[0].execute({});
    expect(JSON.parse(result).ok).toBe(true);
  });
});
