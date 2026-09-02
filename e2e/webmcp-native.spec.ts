import { expect, test } from "@playwright/test";

test("native Chrome WebMCP discovers and executes Inkframe tools", async ({ page }) => {
  await page.goto("/editor");
  await expect(page.getByText("Program monitor")).toBeVisible();
  const supported = await page.evaluate(() => {
    const context = (document as Document & {
      modelContext?: { getTools?: unknown; executeTool?: unknown };
    }).modelContext;
    return typeof context?.getTools === "function" && typeof context?.executeTool === "function";
  });
  test.skip(!supported, "This Chrome build does not expose native WebMCP; run Chrome 150+ with --enable-features=WebMCP.");

  await page.waitForFunction(async () => {
    const context = (document as Document & {
      modelContext: { getTools: () => Promise<Array<{ name: string }>> };
    }).modelContext;
    return (await context.getTools()).some((tool) => tool.name === "editor_get_capabilities");
  });

  const result = await page.evaluate(async () => {
    const context = (document as Document & {
      modelContext: {
        getTools: () => Promise<Array<{ name: string }>>;
        executeTool: (tool: { name: string }, input: string) => Promise<string>;
      };
    }).modelContext;
    const tools = await context.getTools();
    const capabilityTool = tools.find((tool) => tool.name === "editor_get_capabilities");
    if (!capabilityTool) throw new Error("editor_get_capabilities was not registered natively");
    return {
      names: tools.map((tool) => tool.name),
      output: JSON.parse(await context.executeTool(capabilityTool, "{}")) as { ok: boolean; product: string },
    };
  });

  expect(result.names).toContain("editor_capture_contact_sheet");
  expect(result.names).toContain("editor_get_export_artifact");
  expect(result.output).toMatchObject({ ok: true, product: "Inkframe browser-native video editor" });
});
