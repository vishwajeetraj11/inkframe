import { describe, expect, it, vi } from "vitest";
import { createInitialEditorHistory } from "@/lib/editor/history";
import { editorReducer } from "@/lib/editor/reducer";
import {
  createDefaultAudioTrack,
  createDefaultClip,
  createDefaultTextOverlay,
} from "@/lib/editor/defaults";
import { createEditorWebMcpTools } from "@/lib/editor/webmcp/tools";
import type { AssetRef } from "@/lib/editor/types";
import type { EditorFrameCapture } from "@/lib/editor/export-state";

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
    addSoundEffect: async () => undefined,
    applyAIEditorActions: async () => ({ ok: true, message: "Applied" }),
    requestExport: vi.fn(() => ({ ok: true, message: "Export started", jobId: "export-1" })),
    getExportState: () => ({
      jobId: "export-1",
      status: "completed" as const,
      progress: 100,
      startedAt: "2026-09-02T00:00:00.000Z",
      completedAt: "2026-09-02T00:00:01.000Z",
      message: "Exported",
      artifact: {
        jobId: "export-1",
        filename: "inkframe.mp4",
        mimeType: "video/mp4",
        bytes: 2048,
        durationInFrames: 90,
        durationSeconds: 3,
        container: "mp4" as const,
        videoCodec: "h264" as const,
        audioCodec: "aac" as const,
        videoBitrate: 8_000_000,
        audioBitrate: 128_000,
        width: 1080,
        height: 1920,
        fps: 30,
        completedAt: "2026-09-02T00:00:01.000Z",
      },
    }),
    cancelExport: vi.fn(() => ({ ok: true, message: "Cancelled" })),
    captureFrame: vi.fn(async (
      frame: number,
      includeImage: boolean,
    ): Promise<EditorFrameCapture> => ({
      frame,
      width: 1080,
      height: 1920,
      contrastChecks: [],
      ...(includeImage
        ? { mimeType: "image/jpeg" as const, dataUrl: "data:image/jpeg;base64,frame" }
        : {}),
    })),
    getRenderDiagnostics: () => ({ adapter: [], browser: { ready: { videoExport: true } } }),
    removeAsset: async () => ({ ok: true, message: "Removed" }),
    requestMediaPicker: async () => undefined,
    importAudioFromUrl: vi.fn(async () => ({ ok: true, message: "Imported audio" })),
    searchStockPhotos: vi.fn(async () => ({
      page: 1,
      perPage: 1,
      totalResults: 1,
      nextPage: null,
      photos: [{
        id: 77,
        width: 1080,
        height: 1920,
        alt: "City",
        thumbnail: "https://images.example/77-thumb.jpg",
        imageUrl: "https://images.example/77.jpg",
        pexelsUrl: "https://pexels.com/photo/77",
        photographer: "Maker",
        photographerUrl: "https://pexels.com/@maker",
      }],
      attribution: { label: "Pexels" as const, url: "https://www.pexels.com/" as const },
    })),
    importStockPhoto: vi.fn(async () => ({ ok: true, message: "Imported photo" })),
    searchLicensedMusic: vi.fn(async () => ({ provider: "jamendo" as const, query: "focus", results: [] })),
    importLicensedMusic: vi.fn(async () => ({ ok: true, message: "Imported music" })),
    searchLicensedSoundEffects: vi.fn(async () => ({ provider: "freesound" as const, query: "whoosh", results: [] })),
    importLicensedSoundEffect: vi.fn(async () => ({ ok: true, message: "Imported SFX" })),
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
      "editor_validate_project",
      "editor_get_render_diagnostics",
      "editor_capture_frame",
      "editor_get_export_status",
      "editor_list_style_presets",
      "editor_list_assets",
      "editor_get_attribution_report",
      "editor_list_sound_effects",
      "editor_search_stock_videos",
      "editor_import_stock_video",
      "editor_search_stock_photos",
      "editor_import_stock_photo",
      "editor_search_licensed_music",
      "editor_import_licensed_music",
      "editor_search_licensed_sfx",
      "editor_import_licensed_sfx",
      "editor_import_audio_url",
      "editor_request_media_picker",
      "editor_plan_storyboard",
      "editor_auto_fix_project",
      "editor_compose_storyboard",
      "editor_switch_canvas",
      "editor_select_timeline_item",
      "editor_add_text_overlay",
      "editor_update_text_overlay",
      "editor_remove_text_overlay",
      "editor_update_clip",
      "editor_remove_clip",
      "editor_move_clip",
      "editor_split_clip",
      "editor_duplicate_clip",
      "editor_set_transition",
      "editor_remove_transition",
      "editor_update_audio_track",
      "editor_remove_audio_track",
      "editor_add_sound_effect",
      "editor_apply_ai_editor_actions",
      "editor_request_export",
      "editor_cancel_export",
      "editor_remove_asset",
      "editor_undo",
      "editor_redo",
    ]);
    expect(tools.every((tool) => /^[A-Za-z0-9_-]{1,128}$/.test(tool.name))).toBe(true);
    expect(tools.every((tool) => tool.inputSchema.type === "object")).toBe(true);
    const addTextSchema = tools.find(
      (tool) => tool.name === "editor_add_text_overlay",
    )?.inputSchema as { properties?: Record<string, unknown> } | undefined;
    expect(addTextSchema?.properties?.stylePreset).toMatchObject({ const: "classic" });
  });

  it("guides agents through task-oriented workflows", async () => {
    const { tools } = setup();
    const guide = JSON.parse(
      await tools.find((tool) => tool.name === "editor_get_capabilities")!.execute(
        {},
        executeOptions,
      ),
    );

    expect(guide).toMatchObject({
      ok: true,
      recommendedStart: expect.stringContaining("editor_plan_storyboard"),
      safeguards: {
        storyboardApprovalToken: true,
        confirmedDestructiveActions: true,
      },
    });
    expect(guide.workflows[0].steps).toEqual(
      expect.arrayContaining([
        "editor_plan_storyboard",
        "editor_capture_frame",
        "editor_get_attribution_report",
        "editor_request_export",
      ]),
    );
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
    await tools.find((tool) => tool.name === "editor_set_transition")!.execute({ fromClipId: "clip-1", toClipId: "clip-2", kind: "slide", direction: "left", durationInFrames: 10 }, executeOptions);
    expect(selected).toContain("clip:clip-1");
    expect(getState().present.versions.reel_9_16.clips[0].volume).toBe(0.4);
    expect(getState().present.versions.reel_9_16.audioTracks[0].volume).toBe(0.5);
    expect(getState().present.versions.reel_9_16.transitions).toHaveLength(1);
    await expect(tools.find((tool) => tool.name === "editor_set_transition")!.execute({ fromClipId: "clip-2", toClipId: "clip-1", durationInFrames: 10 }, executeOptions)).rejects.toThrow("adjacent");
    await expect(tools.find((tool) => tool.name === "editor_remove_clip")!.execute({ clipId: "clip-1" }, executeOptions)).rejects.toThrow();
    await tools.find((tool) => tool.name === "editor_remove_transition")!.execute({ fromClipId: "clip-1", toClipId: "clip-2", confirmed: true }, executeOptions);
    await tools.find((tool) => tool.name === "editor_remove_audio_track")!.execute({ trackId: "audio-1", confirmed: true }, executeOptions);
    expect(getState().present.versions.reel_9_16.transitions).toHaveLength(0);
  });

  it("composes, validates, and captures an Elah-native storyboard", async () => {
    const { tools, getState, callbacks } = setup();
    const storyboard = {
      scenes: [
        { text: "A strong opening", assetId: "video-1", durationSeconds: 2 },
        {
          text: "A clear conclusion",
          assetId: "video-1",
          durationSeconds: 2,
          animationIn: "word-reveal" as const,
        },
      ],
      transition: {
        kind: "wipe" as const,
        direction: "left" as const,
        durationSeconds: 0.3,
      },
    };
    const planned = JSON.parse(
      await tools.find((tool) => tool.name === "editor_plan_storyboard")!.execute(
        storyboard,
        executeOptions,
      ),
    );
    expect(planned).toMatchObject({
      ok: true,
      requiresConfirmation: true,
      approvalToken: expect.stringMatching(/^storyboard-/),
      effects: { scenes: 2, replacesVisualTimeline: true },
    });
    expect(getState().present.versions.reel_9_16.textOverlays).toHaveLength(0);

    const compose = tools.find((tool) => tool.name === "editor_compose_storyboard")!;
    await expect(
      compose.execute(
        { ...storyboard, confirmed: true, approvalToken: "storyboard-invalid" },
        executeOptions,
      ),
    ).rejects.toThrow("approvalToken does not match");
    const response = JSON.parse(
      await compose.execute(
        {
          ...storyboard,
          confirmed: true,
          approvalToken: planned.approvalToken,
        },
        executeOptions,
      ),
    );

    expect(response).toMatchObject({ ok: true, durationInFrames: 116 });
    const version = getState().present.versions.reel_9_16;
    expect(version.clips).toHaveLength(2);
    expect(version.textOverlays).toHaveLength(2);
    expect(version.textOverlays.every((overlay) => overlay.stylePreset === "classic")).toBe(true);
    expect(version.transitions[0]).toMatchObject({ kind: "wipe", direction: "left" });

    const validation = JSON.parse(
      await tools.find((tool) => tool.name === "editor_validate_project")!.execute({}, executeOptions),
    );
    expect(validation.report.readyForExport).toBe(true);

    const frame = JSON.parse(
      await tools.find((tool) => tool.name === "editor_capture_frame")!.execute(
        { frame: 10, includeImage: true },
        executeOptions,
      ),
    );
    expect(frame.inspection.activeTextOverlays[0].text).toBe("A strong opening");
    expect(frame.capture.dataUrl).toBe("data:image/jpeg;base64,frame");
    expect(callbacks.captureFrame).toHaveBeenCalledWith(10, true, expect.any(AbortSignal));
  });

  it("invalidates storyboard approval when project state changes", async () => {
    const { tools } = setup();
    const storyboard = {
      aspect: "reel_9_16" as const,
      scenes: [{ text: "Approved copy", durationSeconds: 2 }],
    };
    const planned = JSON.parse(
      await tools.find((tool) => tool.name === "editor_plan_storyboard")!.execute(
        storyboard,
        executeOptions,
      ),
    );
    expect(planned.sceneTimings[0]).toMatchObject({ startFrame: 0, endFrame: 60 });
    expect(planned.validation.durationInFrames).toBe(60);
    await tools.find((tool) => tool.name === "editor_add_text_overlay")!.execute(
      { text: "A change after approval" },
      executeOptions,
    );

    await expect(
      tools.find((tool) => tool.name === "editor_compose_storyboard")!.execute(
        {
          ...storyboard,
          confirmed: true,
          approvalToken: planned.approvalToken,
        },
        executeOptions,
      ),
    ).rejects.toThrow("approvalToken does not match");
  });

  it("applies safe automatic fixes and reports stock-media credits", async () => {
    const { tools, getState, dispatch, assets, callbacks } = setup();
    assets[0].attribution = {
      provider: "pexels",
      sourceUrl: "https://www.pexels.com/video/1",
      creatorName: "Sample Creator",
      creatorUrl: "https://www.pexels.com/@sample",
      attributionRequired: true,
    };
    dispatch({
      type: "add-clip",
      aspect: "reel_9_16",
      clip: createDefaultClip("clip-1", "video-1", "video"),
    });
    dispatch({
      type: "add-text-overlay",
      aspect: "reel_9_16",
      overlay: {
        ...createDefaultTextOverlay("text-1"),
        x: 1,
        y: 99,
        fontSize: 12,
        stylePreset: "vox-timeline",
        animation: { in: "rise", out: "fade", durationFrames: 50 },
      },
    });
    callbacks.captureFrame.mockResolvedValueOnce({
      frame: 10,
      width: 1080,
      height: 1920,
      contrastChecks: [{
        overlayId: "text-1",
        contrastRatio: 1.2,
        minimumRatio: 4.5,
        passes: false,
        sampledBackgroundLuminance: 0.9,
        recommendedColor: "#000000" as const,
      }],
    } as EditorFrameCapture);

    const fixed = JSON.parse(
      await tools.find((tool) => tool.name === "editor_auto_fix_project")!.execute(
        { confirmed: true, contrastFrame: 10 },
        executeOptions,
      ),
    );
    expect(fixed.ok).toBe(true);
    expect(fixed.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityId: "text-1", field: "x", to: 6 }),
      expect.objectContaining({ entityId: "text-1", field: "fontSize", to: 32 }),
      expect.objectContaining({ entityId: "text-1", field: "color", to: "#000000" }),
    ]));
    expect(getState().present.versions.reel_9_16.textOverlays[0]).toMatchObject({
      x: 6,
      y: 90,
      fontSize: 32,
      color: "#000000",
      stylePreset: "classic",
    });

    const credits = JSON.parse(
      await tools.find((tool) => tool.name === "editor_get_attribution_report")!.execute(
        {},
        executeOptions,
      ),
    );
    expect(credits.report).toMatchObject({
      readyToPublish: true,
      usedAssetCount: 1,
      credits: [expect.objectContaining({ provider: "Pexels", creator: "Sample Creator" })],
    });
    expect(credits.report.copyableCredits).toContain("Sample Creator via Pexels");
  });

  it("reports render and export diagnostics and supports cancellation", async () => {
    const { tools, callbacks } = setup();
    const diagnostics = JSON.parse(
      await tools.find((tool) => tool.name === "editor_get_render_diagnostics")!.execute({}, executeOptions),
    );
    expect(diagnostics.runtime.browser.ready.videoExport).toBe(true);

    const exportStatus = JSON.parse(
      await tools.find((tool) => tool.name === "editor_get_export_status")!.execute({}, executeOptions),
    );
    expect(exportStatus.export.artifact).toMatchObject({
      filename: "inkframe.mp4",
      mimeType: "video/mp4",
      bytes: 2048,
      container: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
    });

    await expect(
      tools.find((tool) => tool.name === "editor_cancel_export")!.execute({}, executeOptions),
    ).rejects.toThrow();
    expect(
      JSON.parse(
        await tools.find((tool) => tool.name === "editor_cancel_export")!.execute(
          { confirmed: true },
          executeOptions,
        ),
      ),
    ).toMatchObject({ ok: true, message: "Cancelled" });
    expect(callbacks.cancelExport).toHaveBeenCalledOnce();
  });

  it("searches and imports Pexels photos through safe metadata", async () => {
    const { tools, callbacks } = setup();
    const search = JSON.parse(
      await tools.find((tool) => tool.name === "editor_search_stock_photos")!.execute(
        { query: "city night" },
        executeOptions,
      ),
    );
    expect(search.result.photos[0]).toMatchObject({ id: 77, photographer: "Maker" });
    expect(JSON.stringify(search)).not.toContain("private");

    const imported = JSON.parse(
      await tools.find((tool) => tool.name === "editor_import_stock_photo")!.execute(
        { query: "city night", photoId: 77 },
        executeOptions,
      ),
    );
    expect(imported).toMatchObject({ ok: true, message: "Imported photo" });
    expect(callbacks.importStockPhoto).toHaveBeenCalledWith(
      "city night",
      77,
      "reel_9_16",
      expect.any(AbortSignal),
    );
  });

  it("searches and imports licensed music and sound effects with confirmation", async () => {
    const { tools, callbacks } = setup();
    const music = JSON.parse(await tools.find((tool) => tool.name === "editor_search_licensed_music")!.execute(
      { query: "focus" },
      executeOptions,
    ));
    expect(music.result).toMatchObject({ provider: "jamendo", query: "focus" });

    await expect(tools.find((tool) => tool.name === "editor_import_licensed_music")!.execute(
      { query: "focus", audioId: "12" },
      executeOptions,
    )).rejects.toThrow();
    await tools.find((tool) => tool.name === "editor_import_licensed_music")!.execute(
      { confirmed: true, query: "focus", audioId: "12" },
      executeOptions,
    );
    await tools.find((tool) => tool.name === "editor_import_licensed_sfx")!.execute(
      { confirmed: true, query: "whoosh", audioId: "98", startFrame: 30 },
      executeOptions,
    );
    expect(callbacks.importLicensedMusic).toHaveBeenCalledWith(
      expect.objectContaining({ query: "focus", audioId: "12" }),
      expect.any(AbortSignal),
    );
    expect(callbacks.importLicensedSoundEffect).toHaveBeenCalledWith(
      expect.objectContaining({ query: "whoosh", audioId: "98", startFrame: 30 }),
      expect.any(AbortSignal),
    );
  });

  it("requires confirmation for destructive and external callbacks", async () => {
    const { tools, callbacks } = setup();
    await expect(tools.find((tool) => tool.name === "editor_request_export")!.execute({}, executeOptions)).rejects.toThrow();
    await expect(tools.find((tool) => tool.name === "editor_remove_asset")!.execute({ assetId: "video-1" }, executeOptions)).rejects.toThrow();
    await tools.find((tool) => tool.name === "editor_add_text_overlay")!.execute(
      { text: "Exportable project" },
      executeOptions,
    );
    expect(JSON.parse(await tools.find((tool) => tool.name === "editor_request_export")!.execute({ confirmed: true }, executeOptions))).toMatchObject({ ok: true, message: "Export started", jobId: "export-1" });
    expect(JSON.parse(await tools.find((tool) => tool.name === "editor_remove_asset")!.execute({ assetId: "video-1", confirmed: true }, executeOptions))).toMatchObject({ ok: true, message: "Removed" });
    const importAudio = tools.find((tool) => tool.name === "editor_import_audio_url")!;
    await expect(importAudio.execute({ url: "https://assets.example.com/track.mp3" }, executeOptions)).rejects.toThrow();
    expect(JSON.parse(await importAudio.execute({ confirmed: true, url: "https://assets.example.com/track.mp3", name: "Track.mp3" }, executeOptions))).toMatchObject({ ok: true, message: "Imported audio" });
    expect(callbacks.importAudioFromUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://assets.example.com/track.mp3",
        name: "Track.mp3",
      }),
      expect.any(AbortSignal),
    );
  });

  it("supports WebMCP hosts that omit execution options", async () => {
    const { tools, callbacks } = setup();
    await tools
      .find((tool) => tool.name === "editor_add_text_overlay")!
      .execute({ text: "Exportable project" });
    const response = await tools
      .find((tool) => tool.name === "editor_request_export")!
      .execute({ confirmed: true });

    expect(callbacks.requestExport).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(JSON.parse(response)).toMatchObject({ ok: true, message: "Export started", jobId: "export-1" });
  });
});
