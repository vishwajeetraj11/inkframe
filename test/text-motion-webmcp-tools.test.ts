import { describe, expect, it, vi } from "vitest";
import { createDefaultTextMotionProject } from "@/lib/text-motion/defaults";
import { createTextMotionWebMcpTools } from "@/lib/text-motion/webmcp/tools";
import type { TextMotionProject } from "@/lib/text-motion/types";

const signal = () => new AbortController().signal;

const makeTools = (overrides: Partial<Parameters<typeof createTextMotionWebMcpTools>[0]> = {}) => {
  let project = createDefaultTextMotionProject("reel_9_16");
  let prompt = "A concise motion brief";
  const context = {
    getProject: () => project,
    setProject: (next: TextMotionProject) => { project = next; },
    getPrompt: () => prompt,
    setPrompt: (next: string) => { prompt = next; },
    ...overrides,
  };
  const tools = createTextMotionWebMcpTools(context);
  return { tools, getProject: () => project, getPrompt: () => prompt };
};

const tool = (tools: ReturnType<typeof createTextMotionWebMcpTools>, name: string) => {
  const found = tools.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing tool ${name}`);
  return found;
};

describe("Text Motion WebMCP tools", () => {
  it("exposes the complete safe catalog and sanitized reads", async () => {
    const { tools } = makeTools();
    expect(tools.map(({ name }) => name)).toEqual([
      "text_motion_get_capabilities",
      "text_motion_list_templates",
      "text_motion_list_animations",
      "text_motion_get_project_summary",
      "text_motion_set_aspect_template",
      "text_motion_load_template",
      "text_motion_set_prompt",
      "text_motion_set_title",
      "text_motion_add_scene",
      "text_motion_update_scene",
      "text_motion_update_theme",
      "text_motion_list_image_assets",
      "text_motion_assign_image_to_all_scenes",
      "text_motion_remove_image_asset",
      "text_motion_remove_scene",
      "text_motion_generate",
      "text_motion_export",
      "text_motion_request_image_picker",
    ]);
    const result = await tool(tools, "text_motion_get_project_summary").execute({}, { signal: signal() });
    expect(JSON.parse(result as string).project.imageAssets).toBeUndefined();
    expect((result as string).length).toBeLessThanOrEqual(1500);
  });

  it("lists capabilities, templates, and animations", async () => {
    const { tools } = makeTools();
    expect(JSON.parse(await tool(tools, "text_motion_get_capabilities").execute({}, { signal: signal() }) as string).capabilities)
      .toContain("confirmed_export");
    expect(JSON.parse(await tool(tools, "text_motion_list_templates").execute({}, { signal: signal() }) as string).templates)
      .toHaveLength(3);
    expect(JSON.parse(await tool(tools, "text_motion_list_animations").execute({}, { signal: signal() }) as string).animations)
      .toContain("zoom-spin");
  });

  it("rejects unknown input keys, invalid values, and missing confirmations", async () => {
    const { tools } = makeTools();
    const updateTheme = tool(tools, "text_motion_update_theme");
    await expect(updateTheme.execute({ accentColor: "red" }, { signal: signal() })).rejects.toThrow();
    await expect(updateTheme.execute({ accentColor: "#123456", extra: true }, { signal: signal() })).rejects.toThrow();
    await expect(tool(tools, "text_motion_remove_scene").execute({ sceneId: "scene-1" }, { signal: signal() })).rejects.toThrow();
    await expect(tool(tools, "text_motion_export").execute({ confirmed: false }, { signal: signal() })).rejects.toThrow();
    expect(updateTheme.inputSchema).toMatchObject({ type: "object", additionalProperties: false });
    expect(tool(tools, "text_motion_remove_image_asset").inputSchema).toMatchObject({ type: "object", additionalProperties: false });
  });

  it("reads current state at invocation time", async () => {
    let project = createDefaultTextMotionProject("reel_9_16");
    const tools = createTextMotionWebMcpTools({ getProject: () => project, setProject: (next) => { project = next; } });
    project = { ...project, title: "Changed after registration" };
    const result = await tool(tools, "text_motion_get_project_summary").execute({}, { signal: signal() });
    expect(JSON.parse(result as string).project.title).toBe("Changed after registration");
  });

  it("mutates scenes across the full editable surface and supports clearing image assignment", async () => {
    const { tools, getProject } = makeTools();
    const sceneId = getProject().scenes[0].id;
    const asset = { id: "asset-1", name: "hero.png", mimeType: "image/png", dataUrl: "data:image/png;base64,secret" };
    getProject().imageAssets.push(asset);
    await tool(tools, "text_motion_update_scene").execute({
      sceneId,
      text: " updated ",
      durationInFrames: 120,
      animation: "glitch",
      accentWord: "updated",
      fontFamily: "display",
      fontWeight: 800,
      fontStyle: "italic",
      keepOnScreen: true,
      imageAssetId: asset.id,
      imageScale: 1.4,
      imageOpacity: 0.8,
      imageX: 20,
      imageY: 70,
    }, { signal: signal() });
    expect(getProject().scenes[0]).toMatchObject({
      text: "updated", durationInFrames: 120, animation: "glitch", accentWord: "updated",
      fontFamily: "display", fontWeight: 800, fontStyle: "italic", keepOnScreen: true,
      imageAssetId: asset.id, imageScale: 1.4, imageOpacity: 0.8, imageX: 20, imageY: 70,
    });
    await expect(tool(tools, "text_motion_update_scene").execute({ sceneId, imageAssetId: "missing" }, { signal: signal() })).rejects.toThrow("Image asset not found");
    await tool(tools, "text_motion_update_scene").execute({ sceneId, imageAssetId: null }, { signal: signal() });
    expect(getProject().scenes[0].imageAssetId).toBeUndefined();
  });

  it("loads templates through the callback and can update prompt/title", async () => {
    const loadTemplate = vi.fn();
    const { tools, getProject } = makeTools({ loadTemplate });
    await tool(tools, "text_motion_load_template").execute({ template: "photo-card" }, { signal: signal() });
    expect(loadTemplate).toHaveBeenCalledWith("photo-card");
    await tool(tools, "text_motion_set_title").execute({ title: "  New title  " }, { signal: signal() });
    expect(getProject().title).toBe("New title");
    const setPrompt = vi.fn();
    const promptTools = makeTools({ setPrompt });
    await tool(promptTools.tools, "text_motion_set_prompt").execute({ prompt: "  A sharper brief  " }, { signal: signal() });
    expect(setPrompt).toHaveBeenCalledWith("A sharper brief");
  });

  it("lists metadata only, assigns/removes images, and removes confirmed scenes", async () => {
    const { tools, getProject } = makeTools();
    const asset = { id: "asset-1", name: "hero.png", mimeType: "image/png", dataUrl: "data:image/png;base64,secret" };
    getProject().imageAssets.push(asset);
    const metadata = await tool(tools, "text_motion_list_image_assets").execute({}, { signal: signal() });
    expect(metadata).not.toContain(asset.dataUrl);
    expect(JSON.parse(metadata as string).assets).toEqual([{ id: asset.id, name: asset.name, mimeType: asset.mimeType }]);
    await tool(tools, "text_motion_assign_image_to_all_scenes").execute({ assetId: asset.id }, { signal: signal() });
    expect(getProject().scenes.every((scene) => scene.imageAssetId === asset.id)).toBe(true);
    await tool(tools, "text_motion_remove_image_asset").execute({ assetId: asset.id, confirmed: true }, { signal: signal() });
    expect(getProject().imageAssets).toHaveLength(0);
    expect(getProject().scenes.every((scene) => scene.imageAssetId === undefined)).toBe(true);
    await tool(tools, "text_motion_remove_scene").execute({ sceneId: getProject().scenes[0].id, confirmed: true }, { signal: signal() });
    expect(getProject().scenes).toHaveLength(2);
  });

  it("runs confirmed side-effect callbacks and native picker", async () => {
    const generate = vi.fn(async () => undefined);
    const exportProject = vi.fn(async () => undefined);
    const requestImagePicker = vi.fn(async () => undefined);
    const { tools } = makeTools({ generate, exportProject, requestImagePicker });
    await tool(tools, "text_motion_generate").execute({ prompt: "Make a bold launch reel", confirmed: true }, { signal: signal() });
    await tool(tools, "text_motion_export").execute({ confirmed: true }, { signal: signal() });
    await tool(tools, "text_motion_request_image_picker").execute({}, { signal: signal() });
    expect(generate).toHaveBeenCalledWith("Make a bold launch reel", expect.any(AbortSignal));
    expect(exportProject).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(requestImagePicker).toHaveBeenCalledOnce();
  });

  it("honors cancellation before and after async callbacks", async () => {
    const controller = new AbortController();
    const generate = vi.fn(async () => { controller.abort(); });
    const { tools } = makeTools({ generate });
    await expect(tool(tools, "text_motion_generate").execute({ confirmed: true }, { signal: controller.signal })).rejects.toThrow();
  });
});
