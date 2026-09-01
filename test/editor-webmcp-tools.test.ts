import { describe, expect, it, vi } from "vitest";
import { createInitialEditorHistory } from "@/lib/editor/history";
import { editorReducer } from "@/lib/editor/reducer";
import { createDefaultAudioTrack, createDefaultClip } from "@/lib/editor/defaults";
import { createEditorWebMcpTools } from "@/lib/editor/webmcp/tools";
import type { AssetRef } from "@/lib/editor/types";

const setup = () => {
  let state = createInitialEditorHistory();
  const assets: AssetRef[] = [
    { assetId: "video-1", kind: "video", mimeType: "video/mp4", name: "Video 1", size: 12 },
    { assetId: "audio-1", kind: "audio", mimeType: "audio/wav", name: "Audio 1", size: 8 },
  ];
  const selected: string[] = [];
  const dispatch = (action: Parameters<typeof editorReducer>[1]) => {
    state = { ...state, present: editorReducer(state.present, action) };
  };
  const callbacks = {
    addRemotionSfx: async () => undefined,
    applyAIEditorActions: async () => ({ ok: true, message: "Applied" }),
    requestExport: vi.fn(async () => ({ ok: true, message: "Exported" })),
    removeAsset: async () => ({ ok: true, message: "Removed" }),
    requestMediaPicker: async () => undefined,
  };
  const tools = createEditorWebMcpTools({
    getState: () => state,
    getAssets: () => assets,
    dispatch,
    undo: () => undefined,
    redo: () => undefined,
    createId: () => "overlay-1",
    selectClip: (id) => selected.push(`clip:${id}`),
    selectText: (id) => selected.push(`text:${id}`),
    selectAudio: (id) => selected.push(`audio:${id}`),
    ...callbacks,
  });
  return { tools, getState: () => state, dispatch, assets, selected, callbacks };
};

const executeOptions = { signal: new AbortController().signal };

describe("editor WebMCP tools", () => {
  it("exposes the safe initial catalog", () => {
    const { tools } = setup();
    expect(tools.map((tool) => tool.name)).toEqual([
      "editor_get_capabilities",
      "editor_get_state_summary",
      "editor_get_project",
      "editor_list_style_presets",
      "editor_list_assets",
      "editor_list_remotion_sfx",
      "editor_request_media_picker",
      "editor_switch_canvas",
      "editor_select_timeline_item",
      "editor_add_text_overlay",
      "editor_update_text_overlay",
      "editor_remove_text_overlay",
      "editor_update_clip",
      "editor_remove_clip",
      "editor_move_clip",
      "editor_set_crossfade",
      "editor_remove_crossfade",
      "editor_update_audio_track",
      "editor_remove_audio_track",
      "editor_add_remotion_sfx",
      "editor_apply_ai_editor_actions",
      "editor_request_export",
      "editor_remove_asset",
      "editor_undo",
      "editor_redo",
    ]);
    expect(tools.every((tool) => /^[A-Za-z0-9_-]{1,128}$/.test(tool.name))).toBe(true);
    expect(tools.every((tool) => tool.inputSchema.type === "object")).toBe(true);
  });

  it("reads canonical state and applies validated overlay mutations", async () => {
    const { tools, getState } = setup();
    const add = tools.find((tool) => tool.name === "editor_add_text_overlay")!;
    await add.execute({ text: "Hello", startFrame: 5, endFrame: 45 }, executeOptions);
    expect(getState().present.versions.reel_9_16.textOverlays[0].text).toBe("Hello");
    const summary = tools.find((tool) => tool.name === "editor_get_state_summary")!;
    expect(JSON.parse(await summary.execute({}, executeOptions)).counts.textOverlays).toBe(1);
    await expect(add.execute({ text: "bad", startFrame: 40, endFrame: 10 }, executeOptions)).rejects.toThrow();
    await expect(add.execute({ text: "bad", unknown: true }, executeOptions)).rejects.toThrow();
    expect(add.inputSchema).toMatchObject({ type: "object", additionalProperties: false });
  });

  it("does not capture a stale active canvas", async () => {
    const { tools, getState } = setup();
    const switchCanvas = tools.find((tool) => tool.name === "editor_switch_canvas")!;
    const add = tools.find((tool) => tool.name === "editor_add_text_overlay")!;
    await switchCanvas.execute({ aspect: "widescreen_16_9" }, executeOptions);
    await add.execute({ text: "Wide" }, executeOptions);
    expect(getState().present.versions.widescreen_16_9.textOverlays).toHaveLength(1);
    expect(getState().present.versions.reel_9_16.textOverlays).toHaveLength(0);
  });

  it("inspects bounded sanitized project data and safe metadata", async () => {
    const { tools, getState, assets } = setup();
    const add = tools.find((tool) => tool.name === "editor_add_text_overlay")!;
    await add.execute({ text: "data:text/plain,secret", startFrame: 0, endFrame: 20 }, executeOptions);
    const project = tools.find((tool) => tool.name === "editor_get_project")!;
    const payload = JSON.parse(await project.execute({ maxItems: 1 }, executeOptions));
    expect(payload.versions.reel_9_16.textOverlays.items[0].text).toContain("[redacted-url]");
    expect(payload.assets.items).toEqual([{ assetId: "video-1", kind: "video", mimeType: "video/mp4", name: "Video 1", size: 12 }]);
    expect(JSON.stringify(payload)).not.toContain("objectUrl");
    expect(JSON.parse(await tools.find((tool) => tool.name === "editor_list_assets")!.execute({}, executeOptions)).items).toHaveLength(2);
    expect(assets).toHaveLength(2);
    expect(getState().present.versions.reel_9_16.textOverlays).toHaveLength(1);
  });

  it("validates and applies timeline item, clip, audio, and transition actions", async () => {
    const { tools, getState, selected, dispatch } = setup();
    dispatch({ type: "add-clip", aspect: "reel_9_16", clip: createDefaultClip("clip-1", "video-1", "video") });
    dispatch({ type: "add-clip", aspect: "reel_9_16", clip: { ...createDefaultClip("clip-2", "video-1", "video"), startFrame: 30, endFrame: 60 } });
    dispatch({ type: "add-audio-track", aspect: "reel_9_16", track: createDefaultAudioTrack("audio-1", "audio-1") });
    await tools.find((tool) => tool.name === "editor_select_timeline_item")!.execute({ itemType: "clip", itemId: "clip-1" }, executeOptions);
    await tools.find((tool) => tool.name === "editor_update_clip")!.execute({ clipId: "clip-1", volume: 0.4 }, executeOptions);
    await tools.find((tool) => tool.name === "editor_update_audio_track")!.execute({ trackId: "audio-1", volume: 0.5 }, executeOptions);
    await tools.find((tool) => tool.name === "editor_set_crossfade")!.execute({ fromClipId: "clip-1", toClipId: "clip-2", durationInFrames: 10 }, executeOptions);
    expect(selected).toContain("clip:clip-1");
    expect(getState().present.versions.reel_9_16.clips[0].volume).toBe(0.4);
    expect(getState().present.versions.reel_9_16.audioTracks[0].volume).toBe(0.5);
    expect(getState().present.versions.reel_9_16.transitions).toHaveLength(1);
    await expect(tools.find((tool) => tool.name === "editor_set_crossfade")!.execute({ fromClipId: "clip-2", toClipId: "clip-1", durationInFrames: 10 }, executeOptions)).rejects.toThrow("adjacent");
    await expect(tools.find((tool) => tool.name === "editor_remove_clip")!.execute({ clipId: "clip-1" }, executeOptions)).rejects.toThrow();
    await tools.find((tool) => tool.name === "editor_remove_crossfade")!.execute({ fromClipId: "clip-1", toClipId: "clip-2", confirmed: true }, executeOptions);
    await tools.find((tool) => tool.name === "editor_remove_audio_track")!.execute({ trackId: "audio-1", confirmed: true }, executeOptions);
    expect(getState().present.versions.reel_9_16.transitions).toHaveLength(0);
  });

  it("requires confirmation for destructive and external callbacks", async () => {
    const { tools } = setup();
    await expect(tools.find((tool) => tool.name === "editor_request_export")!.execute({}, executeOptions)).rejects.toThrow();
    await expect(tools.find((tool) => tool.name === "editor_remove_asset")!.execute({ assetId: "video-1" }, executeOptions)).rejects.toThrow();
    expect(JSON.parse(await tools.find((tool) => tool.name === "editor_request_export")!.execute({ confirmed: true }, executeOptions))).toMatchObject({ ok: true, message: "Exported" });
    expect(JSON.parse(await tools.find((tool) => tool.name === "editor_remove_asset")!.execute({ assetId: "video-1", confirmed: true }, executeOptions))).toMatchObject({ ok: true, message: "Removed" });
  });

  it("supports WebMCP hosts that omit execution options", async () => {
    const { tools, callbacks } = setup();
    const response = await tools
      .find((tool) => tool.name === "editor_request_export")!
      .execute({ confirmed: true });

    expect(callbacks.requestExport).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(JSON.parse(response)).toMatchObject({ ok: true, message: "Exported" });
  });
});
