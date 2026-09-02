import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

interface ToolResult {
  ok: boolean;
  [key: string]: unknown;
}

const invoke = async (page: Page, name: string, input: Record<string, unknown>): Promise<ToolResult> =>
  page.evaluate(async ({ toolName, toolInput }) => {
    const tools = (window as typeof window & {
      __inkframeWebMcpTools?: Map<string, { execute: (input: unknown) => string | Promise<string> }>;
    }).__inkframeWebMcpTools;
    const tool = tools?.get(toolName);
    if (!tool) throw new Error(`WebMCP tool ${toolName} was not registered.`);
    return JSON.parse(await tool.execute(toolInput)) as ToolResult;
  }, { toolName: name, toolInput: input });

test("WebMCP composes, inspects, exports, and verifies a playable browser MP4", async ({ page }) => {
  await page.addInitScript(() => {
    const tools = new Map<string, { name: string; execute: (input: unknown) => string | Promise<string> }>();
    Object.defineProperty(window, "__inkframeWebMcpTools", { configurable: true, value: tools });
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool(tool: { name: string; execute: (input: unknown) => string | Promise<string> }) {
          tools.set(tool.name, tool);
        },
        unregisterTool(name: string) {
          tools.delete(name);
        },
      },
    });
  });

  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("inkframe-editor");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
  await page.goto("/editor");
  await page.waitForFunction(() => {
    const tools = (window as typeof window & { __inkframeWebMcpTools?: Map<string, unknown> }).__inkframeWebMcpTools;
    return tools?.has("editor_compose_storyboard") && tools.has("editor_request_export");
  });

  const storyboard = {
    aspect: "reel_9_16",
    scenes: [
      { text: "MAKE THE FIRST SECOND COUNT", durationSeconds: 1.2, y: 42, fontSize: 72, animationIn: "punch", animationOut: "fade" },
      { text: "EDIT WITH AN AGENT", durationSeconds: 1.2, y: 50, fontSize: 66, animationIn: "word-reveal", animationOut: "rise" },
      { text: "EXPORT IN YOUR BROWSER", durationSeconds: 1.2, y: 58, fontSize: 62, animationIn: "slide-left", animationOut: "fade" },
    ],
    transition: { kind: "fade", direction: "left", easing: "ease-out", durationSeconds: 0 },
    preserveAudio: false,
  };
  const plan = await invoke(page, "editor_plan_storyboard", storyboard);
  expect(plan).toMatchObject({
    ok: true,
    requiresConfirmation: true,
    approvalToken: expect.any(String),
  });
  const compose = await invoke(page, "editor_compose_storyboard", {
    ...storyboard,
    confirmed: true,
    approvalToken: plan.approvalToken,
  });
  expect(compose.ok).toBe(true);

  expect((await invoke(page, "editor_add_sound_effect", { effectId: "impact" })).ok).toBe(true);
  const project = await invoke(page, "editor_get_project", { aspect: "reel_9_16", maxItems: 10 });
  const versions = project.versions as { reel_9_16: { audioTracks: { items: Array<{ id: string }> } } };
  const audioId = versions.reel_9_16.audioTracks.items[0]?.id;
  expect(audioId).toBeTruthy();
  expect((await invoke(page, "editor_update_audio_track", {
    trackId: audioId,
    fadeInFrames: 4,
    fadeOutFrames: 8,
  })).ok).toBe(true);

  const validation = await invoke(page, "editor_validate_project", {});
  expect((validation.report as { readyForExport: boolean }).readyForExport).toBe(true);
  const capture = await invoke(page, "editor_capture_frame", { frame: 18, includeImage: false });
  const contrastChecks = (capture.capture as { contrastChecks: Array<{ passes: boolean; contrastRatio: number }> }).contrastChecks;
  expect(contrastChecks.length).toBeGreaterThan(0);
  expect(contrastChecks[0]?.contrastRatio).toBeGreaterThan(0);

  const corrected = await invoke(page, "editor_auto_fix_project", {
    confirmed: true,
    contrastFrame: 18,
  });
  expect(corrected.ok).toBe(true);
  const credits = await invoke(page, "editor_get_attribution_report", {});
  expect((credits.report as { readyToPublish: boolean }).readyToPublish).toBe(true);

  const downloadPromise = page.waitForEvent("download", { timeout: 120_000 });
  const started = await invoke(page, "editor_request_export", { confirmed: true });
  expect(started).toMatchObject({ ok: true, jobId: expect.any(String) });

  await expect.poll(async () => {
    const status = await invoke(page, "editor_get_export_status", {});
    return (status.export as { status: string }).status;
  }, { timeout: 120_000 }).toBe("completed");

  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  if (!downloadPath) throw new Error("Browser export did not produce a local download path.");

  const exportStatus = await invoke(page, "editor_get_export_status", {});
  const artifact = (exportStatus.export as { artifact: Record<string, unknown> }).artifact;
  const fileStats = await stat(downloadPath);
  expect(artifact).toMatchObject({
    filename: download.suggestedFilename(),
    mimeType: "video/mp4",
    bytes: fileStats.size,
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    width: 1080,
    height: 1920,
    fps: 30,
  });

  const header = await readFile(downloadPath);
  expect(header.subarray(4, 12).toString("ascii")).toContain("ftyp");

  try {
    const probe = JSON.parse(execFileSync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration:stream=codec_name,codec_type,width,height",
      "-of", "json",
      downloadPath,
    ], { encoding: "utf8" })) as {
      streams: Array<{ codec_name: string; codec_type: string; width?: number; height?: number }>;
      format: { duration: string };
    };
    expect(probe.streams).toEqual(expect.arrayContaining([
      expect.objectContaining({ codec_type: "video", codec_name: "h264", width: 1080, height: 1920 }),
      expect.objectContaining({ codec_type: "audio", codec_name: "aac" }),
    ]));
    expect(Number(probe.format.duration)).toBeGreaterThan(3);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      test.info().annotations.push({ type: "ffprobe", description: "ffprobe unavailable; MP4 container header verified" });
    } else {
      throw error;
    }
  }
});
