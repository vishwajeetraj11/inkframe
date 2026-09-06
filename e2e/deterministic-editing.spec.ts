import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { createDeterministicMedia, createHighFrameRateMedia, createTimeMappingMedia, decodeFrame, hasAudioStream, pixel, toneAmplitude, videoFrameCount } from "./helpers/deterministic-media";

const aspect = "widescreen_16_9";
type ToolResult = { ok: boolean; [key: string]: unknown };
type ClipSnapshot = { id: string; trackId: string; startFrame: number; endFrame: number; transform?: unknown };
type TimelineSnapshot = { clips: { items: ClipSnapshot[] }; tracks: { id: string }[] | { items: { id: string }[] } };

async function invoke(page: Page, name: string, input: Record<string, unknown> = {}): Promise<ToolResult> {
  if (["editor_add_track", "editor_place_clip", "editor_set_clip_transform", "editor_reorder_tracks", "editor_set_clip_keyframes", "editor_upsert_caption_cues", "editor_set_audio_ducking", "editor_freeze_clip_range", "editor_set_clip_speed_ramp"].includes(name)) {
    const project = await invoke(page, "editor_get_project", { aspect, maxItems: 25 });
    input = { ...input, expectedRevision: project.revision, operationId: `${name}-${crypto.randomUUID()}` };
  }
  const result = await page.evaluate(async ({ name, input }) => {
    const tool = (window as typeof window & {
      __inkframeWebMcpTools?: Map<string, { execute(input: unknown): string | Promise<string> }>;
    }).__inkframeWebMcpTools?.get(name);
    if (!tool) throw new Error(`Missing required acceptance tool: ${name}`);
    return JSON.parse(await tool.execute(input));
  }, { name, input });
  expect(result, `${name}: ${JSON.stringify(result)}`).toMatchObject({ ok: true });
  return result;
}

async function openEditor(page: Page) {
  await page.addInitScript(() => {
    const tools = new Map();
    Object.defineProperty(window, "__inkframeWebMcpTools", { configurable: true, value: tools });
    Object.defineProperty(document, "modelContext", { configurable: true, value: {
      registerTool(tool: { name: string }) { tools.set(tool.name, tool); },
      unregisterTool(name: string) { tools.delete(name); },
    } });
  });
  await page.goto("/editor");
  await page.waitForFunction(() => (window as typeof window & { __inkframeWebMcpTools?: Map<string, unknown> }).__inkframeWebMcpTools?.has("editor_set_clip_transform"));
  await invoke(page, "editor_switch_canvas", { aspect });
}

async function exportVideo(page: Page, path: string) {
  const downloadPromise = page.waitForEvent("download", { timeout: 180_000 });
  await invoke(page, "editor_request_export", { confirmed: true });
  await (await downloadPromise).saveAs(path);
}

async function timeline(page: Page, targetAspect = aspect): Promise<TimelineSnapshot> {
  const project = await invoke(page, "editor_get_project", { aspect: targetAspect, maxItems: 25 });
  return (project.versions as Record<string, TimelineSnapshot>)[targetAspect];
}

async function expectPreviewSelectionParity(page: Page, path: string, frame: number, x: number, y: number, targetAspect = aspect) {
  const captured = await invoke(page, "editor_capture_frame", { aspect: targetAspect, frame, includeImage: true });
  const source = (captured.capture as { dataUrl: string }).dataUrl;
  const preview = await page.evaluate(async ({ source, x, y }) => {
    const image = new Image(); image.src = source; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 180;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0, 320, 180);
    return [...context.getImageData(x, y, 1, 1).data].slice(0, 3);
  }, { source, x, y });
  const exported = pixel(decodeFrame(path, frame), x, y);
  expectSameSceneColor(exported, preview, frame);
}

function expectSameSceneColor(exported: number[], preview: number[], frame: number) {
  // Elah's MP4 currently tags SMPTE170M matrix/primaries with BT709 transfer;
  // decoding produces brightness differences from the RGB preview. This gate
  // verifies geometry/source selection through normalized channel ratios, not
  // colorimetric identity. Independent absolute color checks remain below.
  const exportPeak = Math.max(1, ...exported);
  const previewPeak = Math.max(1, ...preview);
  exported.forEach((value, channel) => expect(Math.abs(value / exportPeak - preview[channel] / previewPeak),
    `Frame ${frame}: export ${exported}; preview ${preview}`).toBeLessThan(0.12));
}

function expectRed(rgb: number[]) {
  expect(rgb[0]).toBeGreaterThan(200);
  expect(rgb[1]).toBeLessThan(40);
  expect(rgb[2]).toBeLessThan(40);
}

function expectBlue(rgb: number[]) {
  expect(rgb[0]).toBeLessThan(40);
  expect(rgb[1]).toBeLessThan(40);
  expect(rgb[2]).toBeGreaterThan(200);
}

test("overlapping transformed videos survive reload and export exact PiP boundaries with both audio sources", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const media = await createDeterministicMedia(testInfo.outputPath("media"));
  await page.addInitScript(() => {
    const tools = new Map();
    Object.defineProperty(window, "__inkframeWebMcpTools", { configurable: true, value: tools });
    Object.defineProperty(document, "modelContext", { configurable: true, value: {
      registerTool(tool: { name: string }) { tools.set(tool.name, tool); },
      unregisterTool(name: string) { tools.delete(name); },
    } });
  });
  await page.goto("/editor");
  await page.waitForFunction(() => (window as typeof window & {
    __inkframeWebMcpTools?: Map<string, unknown>;
  }).__inkframeWebMcpTools?.has("editor_set_clip_transform"));
  await invoke(page, "editor_switch_canvas", { aspect });
  await page.locator("#media-upload").setInputFiles(media.base);
  await expect.poll(async () => (await timeline(page)).clips.items.length).toBe(1);
  const base = (await timeline(page)).clips.items[0];
  if (base.startFrame !== 0 || base.endFrame !== 300) {
    await invoke(page, "editor_update_clip", { aspect, clipId: base.id, startFrame: 0, endFrame: 300, trimStartFrame: 0, trimEndFrame: 300 });
  }
  await page.locator("#media-upload").setInputFiles(media.overlay);
  await expect.poll(async () => (await timeline(page)).clips.items.length).toBe(2);
  const overlay = (await timeline(page)).clips.items.find((clip) => clip.id !== base.id)!;
  await invoke(page, "editor_add_track", { aspect, id: "acceptance-pip", kind: "video", name: "Picture in picture" });
  await invoke(page, "editor_place_clip", { aspect, clipId: overlay.id, trackId: "acceptance-pip", startFrame: 60 });
  const placed = (await timeline(page)).clips.items.find((clip) => clip.id === overlay.id)!;
  if (placed.endFrame !== 180) {
    await invoke(page, "editor_update_clip", { aspect, clipId: overlay.id, endFrame: 180, trimStartFrame: 0, trimEndFrame: 120 });
  }
  await invoke(page, "editor_set_clip_transform", {
    aspect, clipId: overlay.id,
    // Canonical scale uses source pixels: 320x180 * 3 = half of 1920x1080.
    transform: { x: 0.75, y: 0.25, scale: 3, rotation: 0, anchor: { x: 0.5, y: 0.5 } }, opacity: 1,
  });
  const tracks = (await timeline(page)).tracks;
  const trackItems = Array.isArray(tracks) ? tracks : tracks.items;
  await invoke(page, "editor_reorder_tracks", { aspect, trackIds: ["acceptance-pip", ...trackItems.filter((track) => track.id !== "acceptance-pip").map((track) => track.id)] });
  const accepted = (await timeline(page)).clips.items;
  expect(accepted.find((clip) => clip.id === base.id)).toMatchObject({ startFrame: 0, endFrame: 300 });
  expect(accepted.find((clip) => clip.id === overlay.id)).toMatchObject({ startFrame: 60, endFrame: 180, trackId: "acceptance-pip" });

  // Autosave has a debounce. Poll the persisted project instead of relying on sleep.
  await expect.poll(async () => page.evaluate(async (aspect) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("inkframe-editor", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const request = db.transaction("projects").objectStore("projects").get("latest");
        request.onsuccess = () => resolve(request.result?.project?.versions?.[aspect]?.clips);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }, aspect)).toEqual(accepted);
  await page.reload();
  await page.waitForFunction(() => (window as typeof window & { __inkframeWebMcpTools?: Map<string, unknown> }).__inkframeWebMcpTools?.has("editor_get_project"));
  await expect.poll(async () => (await timeline(page)).clips.items).toEqual(accepted);

  const previewPixels = new Map<number, number[]>();
  for (const frame of [59, 60, 179, 180]) {
    const capture = await invoke(page, "editor_capture_frame", { aspect, frame, includeImage: true });
    const dataUrl = (capture.capture as { dataUrl?: string }).dataUrl;
    expect(dataUrl, "Preview must return an actual captured image").toBeTruthy();
    const previewPath = testInfo.outputPath(`preview-${frame}.jpg`);
    await writeFile(previewPath, Buffer.from(dataUrl!.split(",")[1], "base64"));
    await testInfo.attach(`preview-${frame}`, { path: previewPath, contentType: "image/jpeg" });
    previewPixels.set(frame, await page.evaluate(async (source) => {
      const image = new Image();
      image.src = source!;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 320; canvas.height = 180;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0, 320, 180);
      return [...context.getImageData(240, 45, 1, 1).data].slice(0, 3);
    }, dataUrl));
  }

  const downloadPromise = page.waitForEvent("download", { timeout: 180_000 });
  await invoke(page, "editor_request_export", { confirmed: true });
  const download = await downloadPromise;
  const output = testInfo.outputPath("pip.mp4");
  await download.saveAs(output);
  expect(videoFrameCount(output)).toBe(300);
  for (const frameNumber of [59, 60, 179, 180]) {
    const decoded = decodeFrame(output, frameNumber);
    expect(decoded.length).toBe(320 * 180 * 3);
    const exportedPixel = pixel(decoded, 240, 45);
    const previewPixel = previewPixels.get(frameNumber)!;
    expectSameSceneColor(exportedPixel, previewPixel, frameNumber);
    expectRed(pixel(decoded, 80, 135));
    if (frameNumber >= 60 && frameNumber < 180) {
      expectBlue(pixel(decoded, 240, 45));
      expectRed(pixel(decoded, 150, 45));
      expectRed(pixel(decoded, 240, 100));
    } else expectRed(pixel(decoded, 240, 45));
  }
  const baseAmplitude = toneAmplitude(media.base, 1, 440);
  const overlayAmplitude = toneAmplitude(media.overlay, 1, 880);
  for (const second of [1, 3, 7]) {
    expect(toneAmplitude(output, second, 440) / baseAmplitude).toBeGreaterThan(0.8);
    expect(toneAmplitude(output, second, 440) / baseAmplitude).toBeLessThan(1.2);
  }
  expect(toneAmplitude(output, 3, 880) / overlayAmplitude).toBeGreaterThan(0.8);
  expect(toneAmplitude(output, 3, 880) / overlayAmplitude).toBeLessThan(1.2);
  expect(toneAmplitude(output, 1, 880)).toBeLessThan(0.005);
  expect(toneAmplitude(output, 7, 880)).toBeLessThan(0.005);
});

test("keyframe motion, exclusive captions, and narration ducking render into the actual MP4", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const media = await createDeterministicMedia(testInfo.outputPath("media"));
  await openEditor(page);
  await page.locator("#media-upload").setInputFiles(media.base);
  await expect.poll(async () => (await timeline(page)).clips.items.length).toBe(1);
  const base = (await timeline(page)).clips.items[0];
  if (base.startFrame !== 0 || base.endFrame !== 300) {
    await invoke(page, "editor_update_clip", { aspect, clipId: base.id, startFrame: 0, endFrame: 300, trimStartFrame: 0, trimEndFrame: 300 });
  }
  await page.locator("#media-upload").setInputFiles(media.overlay);
  await expect.poll(async () => (await timeline(page)).clips.items.length).toBe(2);
  const overlay = (await timeline(page)).clips.items.find((clip) => clip.id !== base.id)!;
  await invoke(page, "editor_add_track", { aspect, id: "animated", kind: "video", name: "Animated video" });
  await invoke(page, "editor_place_clip", { aspect, clipId: overlay.id, trackId: "animated", startFrame: 60 });
  if ((await timeline(page)).clips.items.find((clip) => clip.id === overlay.id)!.endFrame !== 180) {
    await invoke(page, "editor_update_clip", { aspect, clipId: overlay.id, endFrame: 180, trimStartFrame: 0, trimEndFrame: 120 });
  }
  await invoke(page, "editor_set_clip_transform", { aspect, clipId: overlay.id,
    transform: { x: 0.25, y: 0.25, scale: 1.5, rotation: 0, anchor: { x: 0.5, y: 0.5 } } });
  await invoke(page, "editor_set_clip_keyframes", { aspect, clipId: overlay.id, keyframes: { x: [
    { id: "x-start", frame: 0, value: 0.25, interpolation: "linear" },
    { id: "x-end", frame: 120, value: 0.75, interpolation: "linear" },
  ] } });
  await invoke(page, "editor_add_track", { aspect, id: "captions", kind: "caption", name: "Captions" });
  await invoke(page, "editor_upsert_caption_cues", { aspect, cues: [
    { id: "caption-boundary", trackId: "captions", startFrame: 30, endFrame: 60, text: "CAPTION TEST" },
  ] });
  await invoke(page, "editor_set_audio_ducking", { aspect, rule: { id: "music-duck", target: { kind: "video", id: base.id },
    triggers: [{ kind: "video", id: overlay.id }], attenuationDb: -12, attackFrames: 0, releaseFrames: 0 } });
  const tracks = (await timeline(page)).tracks;
  const ids = (Array.isArray(tracks) ? tracks : tracks.items).map((track) => track.id);
  await invoke(page, "editor_reorder_tracks", { aspect, trackIds: ["animated", ...ids.filter((id) => id !== "animated")] });
  const output = testInfo.outputPath("animated-caption-duck.mp4");
  await exportVideo(page, output);
  expect(videoFrameCount(output)).toBe(300);
  expectBlue(pixel(decodeFrame(output, 60), 80, 45));
  expectRed(pixel(decodeFrame(output, 60), 160, 45));
  expectBlue(pixel(decodeFrame(output, 120), 160, 45));
  expectRed(pixel(decodeFrame(output, 120), 80, 45));
  const captionPixels = (frame: number) => {
    const data = decodeFrame(output, frame);
    let bright = 0;
    for (let y = 135; y < 179; y++) for (let x = 30; x < 290; x++) {
      const [r, g, b] = pixel(data, x, y);
      if (r > 150 && g > 150 && b > 150) bright++;
    }
    return bright;
  };
  expect(captionPixels(29)).toBe(0);
  expect(captionPixels(30)).toBeGreaterThan(20);
  expect(captionPixels(59)).toBeGreaterThan(20);
  expect(captionPixels(60)).toBe(0);
  const before = toneAmplitude(output, 1, 440);
  const during = toneAmplitude(output, 3, 440);
  const after = toneAmplitude(output, 7, 440);
  expect(20 * Math.log10(during / before)).toBeCloseTo(-12, 0);
  expect(after / before).toBeCloseTo(1, 1);
  expect(toneAmplitude(output, 3, 880) / toneAmplitude(media.overlay, 1, 880)).toBeCloseTo(1, 1);
  await expectPreviewSelectionParity(page, output, 60, 80, 45);
  await expectPreviewSelectionParity(page, output, 120, 160, 45);
});

for (const vfr of [false, true]) {
  test(`${vfr ? "VFR" : "CFR"} source supports exact freeze sampling and integrated speed export`, async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const source = await createTimeMappingMedia(testInfo.outputPath("media"), vfr);
    await openEditor(page);
    await page.locator("#media-upload").setInputFiles(source);
    await expect.poll(async () => (await timeline(page)).clips.items.length).toBe(1);
    const original = (await timeline(page)).clips.items[0];
    await invoke(page, "editor_update_clip", { aspect, clipId: original.id, endFrame: 120, trimEndFrame: 120 });
    // VFR holds just before the next sparse frame, requiring interval coverage
    // rather than an arbitrary two-project-frame nearest-neighbor limit.
    await invoke(page, "editor_freeze_clip_range", { aspect, clipId: original.id, startFrame: 30, endFrame: 60,
      sourceTimeUs: vfr ? 3_399_000 : 3_200_000 });
    const freeze = testInfo.outputPath("freeze.mp4");
    await exportVideo(page, freeze);
    expect(videoFrameCount(freeze)).toBe(120);
    expectRed(pixel(decodeFrame(freeze, 29), 160, 90));
    for (const frame of [30, 45, 59, 60]) {
      const rgb = pixel(decodeFrame(freeze, frame), 160, 90);
      expect(rgb[0]).toBeLessThan(40); expect(rgb[1]).toBeGreaterThan(200); expect(rgb[2]).toBeLessThan(40);
    }
    expect(toneAmplitude(freeze, 0.5, 440)).toBeGreaterThan(0.08);
    expect(toneAmplitude(freeze, 1.25, 440)).toBeLessThan(0.005);
    expect(toneAmplitude(freeze, 2.5, 440)).toBeGreaterThan(0.08);
    await expectPreviewSelectionParity(page, freeze, 30, 160, 90);
    await expectPreviewSelectionParity(page, freeze, 60, 160, 90);
    await invoke(page, "editor_undo");
    await invoke(page, "editor_set_clip_speed_ramp", { aspect, clipId: original.id, audioPolicy: "mute", points: [
      { frame: 0, speed: 1, interpolation: "linear" },
      { frame: 120, speed: 2, interpolation: "linear" },
    ] });
    const ramp = testInfo.outputPath("ramp.mp4");
    await exportVideo(page, ramp);
    expect(videoFrameCount(ramp)).toBe(120);
    // Integral source time is t + t*t/8; an instantaneous-rate multiplication
    // would incorrectly sample blue at output t=2.5 instead of green.
    expectRed(pixel(decodeFrame(ramp, 30), 160, 90));
    const midpoint = pixel(decodeFrame(ramp, 75), 160, 90);
    expect(midpoint[0]).toBeLessThan(40); expect(midpoint[1]).toBeGreaterThan(200); expect(midpoint[2]).toBeLessThan(40);
    expectBlue(pixel(decodeFrame(ramp, 105), 160, 90));
    // All retimed embedded audio is intentionally muted; an absent stream is
    // valid. Verify it with ffprobe rather than calling a PCM decoder blindly.
    if (hasAudioStream(ramp)) expect(toneAmplitude(ramp, 1, 440)).toBeLessThan(0.005);
    await expectPreviewSelectionParity(page, ramp, 75, 160, 90);
    await expectPreviewSelectionParity(page, ramp, 105, 160, 90);
  });
}

test("portrait layers and captions export after cancellation and replacement export", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const media = await createDeterministicMedia(testInfo.outputPath("media"));
  await openEditor(page);
  const portrait = "reel_9_16";
  await invoke(page, "editor_switch_canvas", { aspect: portrait });
  await page.locator("#media-upload").setInputFiles(media.base);
  await expect.poll(async () => (await timeline(page, portrait)).clips.items.length).toBe(1);
  const base = (await timeline(page, portrait)).clips.items[0];
  await page.locator("#media-upload").setInputFiles(media.overlay);
  await expect.poll(async () => (await timeline(page, portrait)).clips.items.length).toBe(2);
  const overlay = (await timeline(page, portrait)).clips.items.find((clip) => clip.id !== base.id)!;
  await invoke(page, "editor_add_track", { aspect: portrait, id: "portrait-pip", kind: "video", name: "Portrait overlay" });
  await invoke(page, "editor_place_clip", { aspect: portrait, clipId: overlay.id, trackId: "portrait-pip", startFrame: 30 });
  await invoke(page, "editor_update_clip", { aspect: portrait, clipId: overlay.id, endFrame: 60, trimEndFrame: 30 });
  await invoke(page, "editor_set_clip_transform", { aspect: portrait, clipId: overlay.id,
    transform: { x: 0.75, y: 0.5, scale: 1.6875, rotation: 0, anchor: { x: 0.5, y: 0.5 } } });
  await invoke(page, "editor_add_track", { aspect: portrait, id: "portrait-captions", kind: "caption", name: "Portrait captions" });
  await invoke(page, "editor_upsert_caption_cues", { aspect: portrait, cues: [
    { id: "portrait-caption", trackId: "portrait-captions", startFrame: 30, endFrame: 60, text: "PORTRAIT" },
  ] });
  const tracks = (await timeline(page, portrait)).tracks;
  const ids = (Array.isArray(tracks) ? tracks : tracks.items).map((track) => track.id);
  await invoke(page, "editor_reorder_tracks", { aspect: portrait, trackIds: ["portrait-pip", ...ids.filter((id) => id !== "portrait-pip")] });
  await invoke(page, "editor_request_export", { confirmed: true });
  await invoke(page, "editor_cancel_export", { confirmed: true });
  await expect.poll(async () => ((await invoke(page, "editor_get_export_status")).export as { status: string }).status).toBe("cancelled");
  const first = testInfo.outputPath("portrait-first.mp4");
  await exportVideo(page, first);
  expect(videoFrameCount(first)).toBe(90);
  expectRed(pixel(decodeFrame(first, 29), 240, 90));
  expectBlue(pixel(decodeFrame(first, 30), 240, 90));
  expectBlue(pixel(decodeFrame(first, 59), 240, 90));
  expectRed(pixel(decodeFrame(first, 60), 240, 90));
  const whiteCount = (frame: number) => {
    const pixels = decodeFrame(first, frame);
    let count = 0;
    for (let y = 140; y < 179; y++) for (let x = 20; x < 300; x++) {
      const [r, g, b] = pixel(pixels, x, y);
      if (r > 130 && g > 130 && b > 130) count++;
    }
    return count;
  };
  expect(whiteCount(29)).toBe(0); expect(whiteCount(30)).toBeGreaterThan(10);
  expect(whiteCount(59)).toBeGreaterThan(10); expect(whiteCount(60)).toBe(0);
  await expectPreviewSelectionParity(page, first, 30, 240, 90, portrait);
  const artifact = (await invoke(page, "editor_get_export_artifact")).artifact as { objectUrl: string };
  const second = testInfo.outputPath("portrait-repeated.mp4");
  await exportVideo(page, second);
  expect(videoFrameCount(second)).toBe(90);
  const nextArtifact = (await invoke(page, "editor_get_export_artifact")).artifact as { objectUrl: string };
  expect(nextArtifact.objectUrl).not.toBe(artifact.objectUrl);
  expect(await page.evaluate(async (url) => { try { await fetch(url); return true; } catch { return false; } }, artifact.objectUrl)).toBe(false);
});

test("unreadable required audio fails export instead of silently dropping the soundtrack", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const media = await createDeterministicMedia(testInfo.outputPath("media"));
  await openEditor(page);
  await page.locator("#media-upload").setInputFiles(media.base);
  await expect.poll(async () => (await timeline(page)).clips.items.length).toBe(1);
  await page.locator("#media-upload").setInputFiles({ name: "unreadable.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("This is intentionally not an MP3.") });
  await expect.poll(async () => {
    const project = await invoke(page, "editor_get_project", { aspect, maxItems: 25 });
    return (project.versions as Record<string, { audioTracks: { items: unknown[] } }>)[aspect].audioTracks.items.length;
  }).toBe(1);
  let downloads = 0;
  page.on("download", () => downloads++);
  await invoke(page, "editor_request_export", { confirmed: true });
  await expect.poll(async () => ((await invoke(page, "editor_get_export_status")).export as { status: string }).status,
    { timeout: 60_000 }).toBe("failed");
  expect(downloads).toBe(0);
});

test("60 fps source holds the actual timestamp despite project-frame cache collisions", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const source = await createHighFrameRateMedia(testInfo.outputPath("media"));
  await openEditor(page);
  await page.locator("#media-upload").setInputFiles(source);
  await expect.poll(async () => (await timeline(page)).clips.items.length).toBe(1);
  const clip = (await timeline(page)).clips.items[0];
  await invoke(page, "editor_update_clip", { aspect, clipId: clip.id, endFrame: 30, trimEndFrame: 30 });
  // At60fps, frame1 is blue on[16.667ms,33.333ms). Rounded30fps
  // cache keys collide with the subsequent red frame2; timestamp selection must
  // retain both source intervals and choose the requested blue one.
  await invoke(page, "editor_freeze_clip_range", { aspect, clipId: clip.id,
    startFrame: 0, endFrame: 30, sourceTimeUs: 20_833 });
  const output = testInfo.outputPath("high-fps-hold.mp4");
  await exportVideo(page, output);
  expect(videoFrameCount(output)).toBe(30);
  for (const frame of [0, 15, 29]) expectBlue(pixel(decodeFrame(output, frame), 160, 90));
  await expectPreviewSelectionParity(page, output, 0, 160, 90);
  await expectPreviewSelectionParity(page, output, 29, 160, 90);
});
