import { z } from "zod";
import {
  getWebMCPExecuteSignal,
  type WebMcpTool,
  type WebMCPExecuteOptions,
} from "@/lib/webmcp/types";
import { aiEditorActionsSchema, type AIEditorActions } from "../ai-actions";
import { MAX_DURATION_FRAMES } from "../constants";
import { createDefaultTextOverlay } from "../defaults";
import type { EditorHistoryState } from "../history";
import { getClipDurationInFrames } from "../domain/helpers";
import { getRemotionSfxById, REMOTION_SFX_LIBRARY } from "../remotion-sfx";
import type { EditorAction } from "../reducer";
import {
  TEXT_OVERLAY_STYLE_PRESETS,
  TEXT_OVERLAY_STYLE_PRESET_LABELS,
  type AspectPreset,
  type AssetRef,
  type AudioTrack,
  type Clip,
  type TextOverlay,
  type Transition,
} from "../types";

const aspectSchema = z.enum(["reel_9_16", "widescreen_16_9"]);
const frameSchema = z.number().int().min(0).max(MAX_DURATION_FRAMES);
const durationSchema = z.number().int().min(1).max(MAX_DURATION_FRAMES);
const stylePresetSchema = z.enum(TEXT_OVERLAY_STYLE_PRESETS);
const sfxIdSchema = z.enum(
  REMOTION_SFX_LIBRARY.map((effect) => effect.id) as [string, ...string[]],
);
const textFields = {
  text: z.string().trim().min(1).max(2000).optional(),
  startFrame: frameSchema.optional(),
  endFrame: frameSchema.optional(),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  fontSize: z.number().min(1).max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontFamily: z.enum(["sans", "serif", "cursive", "mono"]).optional(),
  fontWeight: z.number().int().min(100).max(900).optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  stylePreset: stylePresetSchema.optional(),
  createdaleyTexture: z
    .enum(["plain", "dots", "grid-dots", "newsprint-grain", "warm-editorial"])
    .optional(),
  syncMediaToTimelineEvents: z.boolean().optional(),
} as const;

const addInput = z.object({ aspect: aspectSchema.optional(), id: z.string().trim().min(1).max(128).optional(), ...textFields }).strict();
const updateInput = z.object({ aspect: aspectSchema.optional(), overlayId: z.string().trim().min(1).max(128), ...textFields }).strict();
const removeTextInput = z.object({ aspect: aspectSchema.optional(), overlayId: z.string().trim().min(1), confirmed: z.literal(true) }).strict();
const switchInput = z.object({ aspect: aspectSchema }).strict();
const emptyInput = z.object({}).strict();
const updateClipInput = z.object({
  aspect: aspectSchema.optional(), clipId: z.string().trim().min(1).max(128),
  startFrame: frameSchema.optional(), endFrame: frameSchema.optional(),
  trimStartFrame: frameSchema.optional(), trimEndFrame: frameSchema.optional(),
  volume: z.number().min(0).max(1).optional(),
}).strict();
const removeClipInput = z.object({ aspect: aspectSchema.optional(), clipId: z.string().trim().min(1).max(128), confirmed: z.literal(true) }).strict();
const updateAudioInput = z.object({
  aspect: aspectSchema.optional(), trackId: z.string().trim().min(1).max(128),
  startFrame: frameSchema.optional(), endFrame: frameSchema.optional(),
  trimStartFrame: frameSchema.optional(), trimEndFrame: frameSchema.optional(),
  volume: z.number().min(0).max(1).optional(),
}).strict();
const removeAudioInput = z.object({ aspect: aspectSchema.optional(), trackId: z.string().trim().min(1).max(128), confirmed: z.literal(true) }).strict();
const projectInput = z.object({ aspect: aspectSchema.optional(), maxItems: z.number().int().min(1).max(25).optional() }).strict();
const assetsInput = z.object({ maxItems: z.number().int().min(1).max(100).optional() }).strict();
const selectInput = z.object({
  aspect: aspectSchema.optional(), itemType: z.enum(["clip", "textOverlay", "audioTrack"]),
  itemId: z.string().trim().min(1).max(128),
}).strict();
const sfxInput = z.object({ aspect: aspectSchema.optional(), effectId: sfxIdSchema }).strict();
const moveClipInput = z.object({ aspect: aspectSchema.optional(), clipId: z.string().trim().min(1).max(128), offset: z.union([z.literal(-1), z.literal(1)]) }).strict();
const transitionInput = z.object({
  aspect: aspectSchema.optional(), id: z.string().trim().min(1).max(128).optional(),
  fromClipId: z.string().trim().min(1).max(128), toClipId: z.string().trim().min(1).max(128),
  durationInFrames: durationSchema,
}).strict();
const removeTransitionInput = z.object({ aspect: aspectSchema.optional(), fromClipId: z.string().trim().min(1), toClipId: z.string().trim().min(1), confirmed: z.literal(true) }).strict();
const applyAIInput = z.object({ confirmed: z.literal(true), actions: aiEditorActionsSchema }).strict();
const removeAssetInput = z.object({ assetId: z.string().trim().min(1).max(128), confirmed: z.literal(true) }).strict();

export interface EditorWebMcpCallbackResult { ok: boolean; message: string }

export interface EditorWebMcpToolContext {
  /** Always return the current state; do not pass a render-time snapshot. */
  getState: () => EditorHistoryState;
  getAssets?: () => readonly AssetRef[];
  dispatch?: (action: EditorAction) => void;
  undo?: () => void;
  redo?: () => void;
  createId?: () => string;
  selectClip?: (clipId: string) => void;
  selectText?: (overlayId: string) => void;
  selectAudio?: (trackId: string) => void;
  addRemotionSfx?: (effectId: (typeof REMOTION_SFX_LIBRARY)[number]["id"], aspect: AspectPreset, signal: AbortSignal) => void | Promise<void>;
  applyAIEditorActions?: (actions: AIEditorActions, signal: AbortSignal) => EditorWebMcpCallbackResult | Promise<EditorWebMcpCallbackResult>;
  requestExport?: (signal: AbortSignal) => EditorWebMcpCallbackResult | Promise<EditorWebMcpCallbackResult>;
  removeAsset?: (assetId: string, signal: AbortSignal) => void | EditorWebMcpCallbackResult | Promise<void | EditorWebMcpCallbackResult>;
  requestMediaPicker?: (signal: AbortSignal) => void | Promise<void>;
}

const MAX_SUMMARY_CHARS = 1500;
const MAX_PROJECT_CHARS = 12000;
const json = (value: unknown, maxChars = MAX_SUMMARY_CHARS): string => {
  const serialized = JSON.stringify(value);
  return serialized.length <= maxChars ? serialized : JSON.stringify({ ok: false, error: "Response too large" });
};
const result = (message: string, extra: Record<string, unknown> = {}) => json({ ok: true, message, ...extra });
const projectResult = (value: unknown) => json(value, MAX_PROJECT_CHARS);
const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw signal.reason ?? new DOMException("Tool call aborted", "AbortError");
};
const validateRange = (startFrame: number, endFrame: number) => {
  if (endFrame <= startFrame) throw new Error("endFrame must be greater than startFrame");
};
const activeVersion = (state: EditorHistoryState, aspect?: AspectPreset) => state.present.versions[aspect ?? state.present.activeVersion];
const scrub = (value: string, maxLength = 240): string => value.replace(/(?:data|blob|javascript):[^\s"']*/gi, "[redacted-url]").slice(0, maxLength);
const bounded = <T, U>(items: readonly T[], maxItems: number, map: (item: T) => U) => ({ items: items.slice(0, maxItems).map(map), omitted: Math.max(0, items.length - maxItems) });
const sanitizeClip = (clip: Clip) => ({ ...clip });
const sanitizeText = (overlay: TextOverlay) => ({ ...overlay, text: scrub(overlay.text) });
const sanitizeAudio = (track: AudioTrack) => ({ ...track });
const sanitizeTransition = (transition: Transition) => ({ ...transition });
const sanitizeAsset = (asset: AssetRef) => ({ assetId: scrub(asset.assetId, 128), kind: asset.kind, mimeType: scrub(asset.mimeType, 128), name: scrub(asset.name, 160), size: asset.size });
const sanitizeTimeline = (version: ReturnType<typeof activeVersion>, maxItems: number) => ({
  aspect: version.aspect,
  clips: bounded(version.clips, maxItems, sanitizeClip),
  textOverlays: bounded(version.textOverlays, maxItems, sanitizeText),
  audioTracks: bounded(version.audioTracks, maxItems, sanitizeAudio),
  transitions: bounded(version.transitions, maxItems, sanitizeTransition),
});
const callbackResponse = (value: void | EditorWebMcpCallbackResult, fallback: string) => value && !value.ok ? json({ ok: false, error: value.message }) : result(value?.message ?? fallback);

const defineTool = <T extends z.ZodType>({ name, title, description, schema, readOnly, execute }: {
  name: string; title: string; description: string; schema: T; readOnly: boolean;
  execute: (input: z.infer<T>, signal: AbortSignal) => string | Promise<string>;
}): WebMcpTool => ({
  name, title, description, inputSchema: z.toJSONSchema(schema),
  annotations: { readOnlyHint: readOnly, untrustedContentHint: readOnly },
  execute: async (input, options?: WebMCPExecuteOptions) => {
    const signal = getWebMCPExecuteSignal(options);
    throwIfAborted(signal);
    const output = await execute(schema.parse(input), signal);
    throwIfAborted(signal);
    return output;
  },
});

export const createEditorWebMcpTools = (context: EditorWebMcpToolContext): WebMcpTool[] => {
  const dispatch = (action: EditorAction) => { if (!context.dispatch) throw new Error("Editor mutations are unavailable"); context.dispatch(action); };
  const requireItem = (aspect: AspectPreset, itemType: string, itemId: string) => {
    const version = activeVersion(context.getState(), aspect);
    const exists = itemType === "clip" ? version.clips.some((item) => item.id === itemId) : itemType === "textOverlay" ? version.textOverlays.some((item) => item.id === itemId) : version.audioTracks.some((item) => item.id === itemId);
    if (!exists) throw new Error(`${itemType} not found`);
  };
  return [
    defineTool({ name: "editor_get_capabilities", title: "Get editor capabilities", description: "List the complete editor WebMCP action surface and key timeline limits.", schema: emptyInput, readOnly: true, execute: () => json({ ok: true, capabilities: ["project_inspection", "asset_metadata", "native_media_picker", "text_overlays", "clip_editing", "audio_editing", "clip_reordering", "crossfades", "remotion_sfx", "structured_ai_actions", "confirmed_export", "confirmed_removal", "undo_redo"], limits: { maxDurationInFrames: MAX_DURATION_FRAMES } }) }),
    defineTool({ name: "editor_get_state_summary", title: "Get editor state", description: "Get a compact summary of the current editor canvas and timeline.", schema: emptyInput, readOnly: true, execute: (_input, signal) => { throwIfAborted(signal); const state = context.getState(); const version = activeVersion(state); const visibleOverlays = version.textOverlays.slice(0, 10); return json({ ok: true, activeVersion: state.present.activeVersion, counts: { clips: version.clips.length, textOverlays: version.textOverlays.length, audioTracks: version.audioTracks.length, transitions: version.transitions.length }, textOverlays: visibleOverlays.map(({ id, text, startFrame, endFrame, stylePreset }) => ({ id, text: scrub(text, 120), startFrame, endFrame, stylePreset })), omittedTextOverlays: Math.max(0, version.textOverlays.length - visibleOverlays.length) }); } }),
    defineTool({ name: "editor_get_project", title: "Inspect editor project", description: "Inspect bounded, sanitized project timelines without exposing files, object URLs, data URLs, or secrets.", schema: projectInput, readOnly: true, execute: (input) => { const state = context.getState(); const maxItems = input.maxItems ?? 10; const aspects = input.aspect ? [input.aspect] : (["reel_9_16", "widescreen_16_9"] as const); const versions = Object.fromEntries(aspects.map((aspect) => [aspect, sanitizeTimeline(state.present.versions[aspect], maxItems)])); return projectResult({ ok: true, activeVersion: state.present.activeVersion, versions, assets: bounded(context.getAssets?.() ?? [], Math.min(maxItems, 25), sanitizeAsset) }); } }),
    defineTool({ name: "editor_list_style_presets", title: "List text styles", description: "List built-in text overlay style presets available in the editor.", schema: emptyInput, readOnly: true, execute: () => json({ ok: true, presets: TEXT_OVERLAY_STYLE_PRESETS.map((id) => ({ id, label: TEXT_OVERLAY_STYLE_PRESET_LABELS[id] })) }) }),
    defineTool({ name: "editor_list_assets", title: "List editor assets", description: "List safe asset metadata without exposing File objects, object URLs, data URLs, or secrets.", schema: assetsInput, readOnly: true, execute: (input) => json({ ok: true, ...bounded(context.getAssets?.() ?? [], input.maxItems ?? 50, sanitizeAsset) }) }),
    defineTool({ name: "editor_list_remotion_sfx", title: "List built-in sound effects", description: "List the built-in Remotion sound effects that can be added to a timeline.", schema: emptyInput, readOnly: true, execute: () => json({ ok: true, effects: REMOTION_SFX_LIBRARY.map(({ id, label, defaultDurationInFrames }) => ({ id, label, defaultDurationInFrames })) }) }),
    defineTool({ name: "editor_request_media_picker", title: "Open media picker", description: "Open Inkframe's native media picker so the user can choose local video, image, or audio files.", schema: emptyInput, readOnly: false, execute: async (_input, signal) => { if (!context.requestMediaPicker) throw new Error("Media picker is unavailable"); await context.requestMediaPicker(signal); throwIfAborted(signal); return result("Media picker requested"); } }),
    defineTool({ name: "editor_switch_canvas", title: "Switch canvas", description: "Switch the active canvas aspect ratio.", schema: switchInput, readOnly: false, execute: (input) => { dispatch({ type: "switch-aspect", aspect: input.aspect }); return result("Canvas switched", { activeVersion: input.aspect }); } }),
    defineTool({ name: "editor_select_timeline_item", title: "Select timeline item", description: "Select an existing clip, text overlay, or audio track in the editor timeline.", schema: selectInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; requireItem(aspect, input.itemType, input.itemId); const callback = input.itemType === "clip" ? context.selectClip : input.itemType === "textOverlay" ? context.selectText : context.selectAudio; if (!callback) throw new Error("Timeline selection is unavailable"); callback(input.itemId); return result("Timeline item selected", { aspect, itemType: input.itemType, itemId: input.itemId }); } }),
    defineTool({ name: "editor_add_text_overlay", title: "Add text overlay", description: "Add a text overlay to the current or specified canvas.", schema: addInput, readOnly: false, execute: (input) => { const state = context.getState(); const aspect = input.aspect ?? state.present.activeVersion; const { aspect: _aspect, id, ...fields } = input; void _aspect; const overlay = { ...createDefaultTextOverlay(id ?? context.createId?.() ?? `text-${Date.now()}`), ...fields } as TextOverlay; validateRange(overlay.startFrame, overlay.endFrame); dispatch({ type: "add-text-overlay", aspect, overlay }); context.selectText?.(overlay.id); return result("Text overlay added", { aspect, overlayId: overlay.id }); } }),
    defineTool({ name: "editor_update_text_overlay", title: "Update text overlay", description: "Update fields on an existing text overlay.", schema: updateInput, readOnly: false, execute: (input) => { const state = context.getState(); const aspect = input.aspect ?? state.present.activeVersion; const current = activeVersion(state, aspect).textOverlays.find((item) => item.id === input.overlayId); if (!current) throw new Error("Text overlay not found"); const { overlayId, aspect: _aspect, ...patch } = input; void _aspect; validateRange(patch.startFrame ?? current.startFrame, patch.endFrame ?? current.endFrame); dispatch({ type: "update-text-overlay", aspect, overlayId, patch }); context.selectText?.(overlayId); return result("Text overlay updated", { aspect, overlayId }); } }),
    defineTool({ name: "editor_remove_text_overlay", title: "Remove text overlay", description: "Remove a text overlay. Requires explicit confirmation.", schema: removeTextInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; if (!activeVersion(context.getState(), aspect).textOverlays.some((item) => item.id === input.overlayId)) throw new Error("Text overlay not found"); dispatch({ type: "remove-text-overlay", aspect, overlayId: input.overlayId }); return result("Text overlay removed", { aspect, overlayId: input.overlayId }); } }),
    defineTool({ name: "editor_update_clip", title: "Update clip", description: "Update timing, trim, or volume fields on an existing media clip.", schema: updateClipInput, readOnly: false, execute: (input) => { const state = context.getState(); const aspect = input.aspect ?? state.present.activeVersion; const current = activeVersion(state, aspect).clips.find((item) => item.id === input.clipId); if (!current) throw new Error("Clip not found"); const { clipId, aspect: _aspect, ...patch } = input; void _aspect; validateRange(patch.startFrame ?? current.startFrame, patch.endFrame ?? current.endFrame); validateRange(patch.trimStartFrame ?? current.trimStartFrame, patch.trimEndFrame ?? current.trimEndFrame); dispatch({ type: "update-clip", aspect, clipId, patch }); return result("Clip updated", { aspect, clipId }); } }),
    defineTool({ name: "editor_remove_clip", title: "Remove clip", description: "Remove a clip and its connected transitions. Requires explicit confirmation.", schema: removeClipInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; if (!activeVersion(context.getState(), aspect).clips.some((item) => item.id === input.clipId)) throw new Error("Clip not found"); dispatch({ type: "remove-clip", aspect, clipId: input.clipId }); return result("Clip removed", { aspect, clipId: input.clipId }); } }),
    defineTool({ name: "editor_move_clip", title: "Reorder clip", description: "Move an existing clip one position earlier or later in the timeline.", schema: moveClipInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; const version = activeVersion(context.getState(), aspect); const index = version.clips.findIndex((clip) => clip.id === input.clipId); if (index < 0) throw new Error("Clip not found"); if (index + input.offset < 0 || index + input.offset >= version.clips.length) throw new Error("Clip cannot move further in that direction"); dispatch({ type: "move-clip", aspect, clipId: input.clipId, offset: input.offset }); return result("Clip reordered", { aspect, clipId: input.clipId, offset: input.offset }); } }),
    defineTool({ name: "editor_set_crossfade", title: "Set crossfade transition", description: "Set a crossfade between adjacent clips with a valid duration.", schema: transitionInput, readOnly: false, execute: (input) => { const state = context.getState(); const aspect = input.aspect ?? state.present.activeVersion; const version = activeVersion(state, aspect); const fromIndex = version.clips.findIndex((clip) => clip.id === input.fromClipId); const toIndex = version.clips.findIndex((clip) => clip.id === input.toClipId); if (fromIndex < 0 || toIndex < 0 || toIndex !== fromIndex + 1) throw new Error("Transition clips must be adjacent"); const maxDuration = Math.max(0, Math.min(getClipDurationInFrames(version.clips[fromIndex]) - 1, getClipDurationInFrames(version.clips[toIndex]) - 1)); if (input.durationInFrames > maxDuration) throw new Error(`Transition duration must be at most ${maxDuration} frames`); const transition: Transition = { id: input.id ?? context.createId?.() ?? `transition-${Date.now()}`, type: "crossfade", durationInFrames: input.durationInFrames, fromClipId: input.fromClipId, toClipId: input.toClipId }; dispatch({ type: "set-transition", aspect, transition }); return result("Crossfade set", { aspect, transitionId: transition.id, fromClipId: input.fromClipId, toClipId: input.toClipId, durationInFrames: input.durationInFrames }); } }),
    defineTool({ name: "editor_remove_crossfade", title: "Remove crossfade transition", description: "Remove a crossfade transition. Requires explicit confirmation.", schema: removeTransitionInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; if (!activeVersion(context.getState(), aspect).transitions.some((transition) => transition.fromClipId === input.fromClipId && transition.toClipId === input.toClipId)) throw new Error("Transition not found"); dispatch({ type: "remove-transition", aspect, fromClipId: input.fromClipId, toClipId: input.toClipId }); return result("Crossfade removed", { aspect, fromClipId: input.fromClipId, toClipId: input.toClipId }); } }),
    defineTool({ name: "editor_update_audio_track", title: "Update audio track", description: "Update timing, trim, or volume fields on an existing audio track.", schema: updateAudioInput, readOnly: false, execute: (input) => { const state = context.getState(); const aspect = input.aspect ?? state.present.activeVersion; const current = activeVersion(state, aspect).audioTracks.find((item) => item.id === input.trackId); if (!current) throw new Error("Audio track not found"); const { trackId, aspect: _aspect, ...patch } = input; void _aspect; validateRange(patch.startFrame ?? current.startFrame, patch.endFrame ?? current.endFrame); validateRange(patch.trimStartFrame ?? current.trimStartFrame, patch.trimEndFrame ?? current.trimEndFrame); dispatch({ type: "update-audio-track", aspect, trackId, patch }); return result("Audio track updated", { aspect, trackId }); } }),
    defineTool({ name: "editor_remove_audio_track", title: "Remove audio track", description: "Remove an audio track. Requires explicit confirmation.", schema: removeAudioInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; if (!activeVersion(context.getState(), aspect).audioTracks.some((item) => item.id === input.trackId)) throw new Error("Audio track not found"); dispatch({ type: "remove-audio-track", aspect, trackId: input.trackId }); return result("Audio track removed", { aspect, trackId: input.trackId }); } }),
    defineTool({ name: "editor_add_remotion_sfx", title: "Add built-in sound effect", description: "Add a built-in Remotion sound effect to the active or specified timeline.", schema: sfxInput, readOnly: false, execute: async (input, signal) => { if (!context.addRemotionSfx) throw new Error("Remotion SFX is unavailable"); const aspect = input.aspect ?? context.getState().present.activeVersion; const effect = getRemotionSfxById(input.effectId as never); if (!effect) throw new Error("Remotion SFX not found"); await context.addRemotionSfx(effect.id, aspect, signal); throwIfAborted(signal); return result("Sound effect added", { aspect, effectId: effect.id, label: effect.label }); } }),
    defineTool({ name: "editor_apply_ai_editor_actions", title: "Apply structured editor actions", description: "Apply validated structured AI editor actions. Requires explicit confirmation.", schema: applyAIInput, readOnly: false, execute: async (input, signal) => { if (!context.applyAIEditorActions) throw new Error("AI editor actions are unavailable"); return callbackResponse(await context.applyAIEditorActions(input.actions, signal), "AI editor actions applied"); } }),
    defineTool({ name: "editor_request_export", title: "Request video export", description: "Request an export through the host editor. Requires explicit confirmation because export has external side effects.", schema: z.object({ confirmed: z.literal(true) }).strict(), readOnly: false, execute: async (_input, signal) => { if (!context.requestExport) throw new Error("Export is unavailable"); return callbackResponse(await context.requestExport(signal), "Export requested"); } }),
    defineTool({ name: "editor_remove_asset", title: "Remove editor asset", description: "Remove an asset and its timeline references through the host editor. Requires explicit confirmation.", schema: removeAssetInput, readOnly: false, execute: async (input, signal) => { if (!context.removeAsset) throw new Error("Asset removal is unavailable"); const assets = context.getAssets?.(); if (assets && !assets.some((asset) => asset.assetId === input.assetId)) throw new Error("Asset not found"); return callbackResponse(await context.removeAsset(input.assetId, signal), "Asset removed"); } }),
    defineTool({ name: "editor_undo", title: "Undo editor change", description: "Undo the latest editor mutation.", schema: emptyInput, readOnly: false, execute: () => { if (!context.undo || context.getState().past.length === 0) throw new Error("Nothing to undo"); context.undo(); return result("Undo applied"); } }),
    defineTool({ name: "editor_redo", title: "Redo editor change", description: "Redo the latest undone editor mutation.", schema: emptyInput, readOnly: false, execute: () => { if (!context.redo || context.getState().future.length === 0) throw new Error("Nothing to redo"); context.redo(); return result("Redo applied"); } }),
  ];
};

export const editorWebMcpTools = createEditorWebMcpTools;
