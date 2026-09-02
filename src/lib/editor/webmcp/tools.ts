import { z } from "zod";
import {
  getWebMCPExecuteSignal,
  type WebMcpTool,
  type WebMCPExecuteOptions,
} from "@/lib/webmcp/types";
import { aiEditorActionsSchema, type AIEditorActions } from "../ai-actions";
import { FPS, MAX_DURATION_FRAMES } from "../constants";
import { createDefaultClip, createDefaultTextOverlay } from "../defaults";
import type { EditorHistoryState } from "../history";
import { getClipDurationInFrames } from "../domain/helpers";
import { getVersionRenderDurationInFrames } from "../timeline";
import { getSoundEffectById, SOUND_EFFECT_LIBRARY } from "../sound-effects";
import type {
  PexelsPhotoSearchResult,
  PexelsVideoSearchResult,
} from "@/lib/pexels";
import type { LicensedAudioSearchResult } from "@/lib/stock-audio";
import type { EditorAction } from "../reducer";
import type { EditorExportState, EditorFrameCapture } from "../export-state";
import {
  autoFixEditorVersion,
  inspectEditorFrame,
  validateEditorVersion,
} from "./diagnostics";
import {
  TEXT_OVERLAY_STYLE_PRESET_LABELS,
  TEXT_OVERLAY_ANIMATION_KINDS,
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
const stylePresetSchema = z.literal("classic");
const sfxIdSchema = z.enum(
  SOUND_EFFECT_LIBRARY.map((effect) => effect.id) as [string, ...string[]],
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
  textAlign: z.enum(["left", "center", "right"]).optional(),
  stylePreset: stylePresetSchema.optional(),
  createdaleyTexture: z
    .enum(["plain", "dots", "grid-dots", "newsprint-grain", "warm-editorial"])
    .optional(),
  syncMediaToTimelineEvents: z.boolean().optional(),
  animation: z
    .object({
      in: z.enum(TEXT_OVERLAY_ANIMATION_KINDS).optional(),
      out: z.enum(TEXT_OVERLAY_ANIMATION_KINDS).optional(),
      durationFrames: durationSchema,
    })
    .optional(),
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
  fadeInFrames: frameSchema.optional(), fadeOutFrames: frameSchema.optional(),
  muted: z.boolean().optional(),
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
const splitClipInput = z.object({
  aspect: aspectSchema.optional(), clipId: z.string().trim().min(1).max(128),
  splitFrame: frameSchema,
}).strict();
const duplicateClipInput = z.object({
  aspect: aspectSchema.optional(), clipId: z.string().trim().min(1).max(128),
}).strict();
const transitionInput = z.object({
  aspect: aspectSchema.optional(), id: z.string().trim().min(1).max(128).optional(),
  fromClipId: z.string().trim().min(1).max(128), toClipId: z.string().trim().min(1).max(128),
  durationInFrames: durationSchema,
  kind: z.enum(["fade", "slide", "wipe"]).default("fade"),
  direction: z.enum(["left", "right", "up", "down"]).optional(),
  easing: z.enum(["linear", "ease-in", "ease-out"]).default("linear"),
}).strict();
const removeTransitionInput = z.object({ aspect: aspectSchema.optional(), fromClipId: z.string().trim().min(1), toClipId: z.string().trim().min(1), confirmed: z.literal(true) }).strict();
const applyAIInput = z.object({ confirmed: z.literal(true), actions: aiEditorActionsSchema }).strict();
const removeAssetInput = z.object({ assetId: z.string().trim().min(1).max(128), confirmed: z.literal(true) }).strict();
const searchStockInput = z.object({
  query: z.string().trim().min(2).max(120),
  aspect: aspectSchema.optional(),
}).strict();
const importStockInput = z.object({
  query: z.string().trim().min(2).max(120),
  videoId: z.number().int().positive(),
  aspect: aspectSchema.optional(),
}).strict();
const importStockPhotoInput = z.object({
  query: z.string().trim().min(2).max(120),
  photoId: z.number().int().positive(),
  aspect: aspectSchema.optional(),
}).strict();
const searchLicensedAudioInput = z.object({
  query: z.string().trim().min(2).max(120),
}).strict();
const importLicensedAudioInput = z.object({
  confirmed: z.literal(true),
  query: z.string().trim().min(2).max(120),
  audioId: z.string().trim().min(1).max(128),
  aspect: aspectSchema.optional(),
  startFrame: frameSchema.optional(),
  endFrame: frameSchema.optional(),
  volume: z.number().min(0).max(1).optional(),
}).strict();
const audioUrlInput = z.object({
  confirmed: z.literal(true),
  url: z.string().url().refine((value) => new URL(value).protocol === "https:", "Audio URL must use HTTPS"),
  name: z.string().trim().min(1).max(160).optional(),
  aspect: aspectSchema.optional(),
  startFrame: frameSchema.optional(),
  endFrame: frameSchema.optional(),
  trimStartFrame: frameSchema.optional(),
  volume: z.number().min(0).max(1).optional(),
  sourceUrl: z.string().url().optional(),
  creatorName: z.string().trim().min(1).max(120).optional(),
  creatorUrl: z.string().url().optional(),
  provider: z.enum(["mixkit", "jamendo", "freesound"]).optional(),
  licenseName: z.string().trim().min(1).max(120).optional(),
  licenseUrl: z.string().url().optional(),
  attributionRequired: z.boolean().optional(),
}).strict();

const validateProjectInput = z.object({ aspect: aspectSchema.optional() }).strict();
const renderDiagnosticsInput = z.object({ aspect: aspectSchema.optional() }).strict();
const captureFrameInput = z.object({
  aspect: aspectSchema.optional(),
  frame: frameSchema,
  includeImage: z.boolean().default(false),
}).strict();
const cancelExportInput = z.object({ confirmed: z.literal(true) }).strict();
const attributionReportInput = z.object({
  aspect: aspectSchema.optional(),
  includeUnused: z.boolean().default(false),
}).strict();
const autoFixProjectInput = z.object({
  aspect: aspectSchema.optional(),
  contrastFrame: frameSchema.optional(),
  confirmed: z.literal(true),
}).strict();
const storyboardSceneSchema = z.object({
  text: z.string().trim().min(1).max(400),
  assetId: z.string().trim().min(1).max(128).optional(),
  durationSeconds: z.number().min(0.5).max(20).default(3),
  x: z.number().min(6).max(94).default(50),
  y: z.number().min(8).max(90).default(50),
  fontSize: z.number().int().min(24).max(180).default(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f2ede3"),
  fontFamily: z.enum(["sans", "serif", "mono"]).default("sans"),
  fontWeight: z.number().int().min(100).max(900).default(700),
  textAlign: z.enum(["left", "center", "right"]).default("center"),
  animationIn: z.enum(TEXT_OVERLAY_ANIMATION_KINDS).default("rise"),
  animationOut: z.enum(TEXT_OVERLAY_ANIMATION_KINDS).default("fade"),
  animationDurationSeconds: z.number().min(0.05).max(2).default(0.4),
}).strict();
const storyboardSpecSchema = z.object({
  aspect: aspectSchema.optional(),
  scenes: z.array(storyboardSceneSchema).min(1).max(12),
  transition: z.object({
    kind: z.enum(["fade", "slide", "wipe"]).default("fade"),
    direction: z.enum(["left", "right", "up", "down"]).default("left"),
    easing: z.enum(["linear", "ease-in", "ease-out"]).default("ease-out"),
    durationSeconds: z.number().min(0).max(2).default(0.4),
  }).default({
    kind: "fade",
    direction: "left",
    easing: "ease-out",
    durationSeconds: 0.4,
  }),
  preserveAudio: z.boolean().default(true),
}).strict();
const planStoryboardInput = storyboardSpecSchema;
const composeStoryboardInput = storyboardSpecSchema.extend({
  approvalToken: z.string().trim().min(8).max(80),
  confirmed: z.literal(true),
}).strict();

type StoryboardSpec = z.infer<typeof storyboardSpecSchema>;

export type AudioUrlImportInput = Omit<z.infer<typeof audioUrlInput>, "confirmed">;

export interface EditorWebMcpCallbackResult {
  ok: boolean;
  message: string;
  jobId?: string;
}

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
  addSoundEffect?: (effectId: (typeof SOUND_EFFECT_LIBRARY)[number]["id"], aspect: AspectPreset, signal: AbortSignal) => void | Promise<void>;
  applyAIEditorActions?: (actions: AIEditorActions, signal: AbortSignal) => EditorWebMcpCallbackResult | Promise<EditorWebMcpCallbackResult>;
  requestExport?: (signal: AbortSignal) => EditorWebMcpCallbackResult | Promise<EditorWebMcpCallbackResult>;
  removeAsset?: (assetId: string, signal: AbortSignal) => void | EditorWebMcpCallbackResult | Promise<void | EditorWebMcpCallbackResult>;
  requestMediaPicker?: (signal: AbortSignal) => void | Promise<void>;
  searchStockVideos?: (query: string, aspect: AspectPreset, signal: AbortSignal) => unknown | Promise<unknown>;
  importStockVideo?: (query: string, videoId: number, aspect: AspectPreset, signal: AbortSignal) => EditorWebMcpCallbackResult | Promise<EditorWebMcpCallbackResult>;
  searchStockPhotos?: (query: string, aspect: AspectPreset, signal: AbortSignal) => unknown | Promise<unknown>;
  importStockPhoto?: (query: string, photoId: number, aspect: AspectPreset, signal: AbortSignal) => EditorWebMcpCallbackResult | Promise<EditorWebMcpCallbackResult>;
  searchLicensedMusic?: (query: string, signal: AbortSignal) => LicensedAudioSearchResult | Promise<LicensedAudioSearchResult>;
  importLicensedMusic?: (input: LicensedAudioImportInput, signal: AbortSignal) => EditorWebMcpCallbackResult | Promise<EditorWebMcpCallbackResult>;
  searchLicensedSoundEffects?: (query: string, signal: AbortSignal) => LicensedAudioSearchResult | Promise<LicensedAudioSearchResult>;
  importLicensedSoundEffect?: (input: LicensedAudioImportInput, signal: AbortSignal) => EditorWebMcpCallbackResult | Promise<EditorWebMcpCallbackResult>;
  importAudioFromUrl?: (input: AudioUrlImportInput, signal: AbortSignal) => EditorWebMcpCallbackResult | Promise<EditorWebMcpCallbackResult>;
  getExportState?: () => EditorExportState;
  cancelExport?: (signal: AbortSignal) => EditorWebMcpCallbackResult | Promise<EditorWebMcpCallbackResult>;
  captureFrame?: (frame: number, includeImage: boolean, signal: AbortSignal) => EditorFrameCapture | Promise<EditorFrameCapture>;
  getRenderDiagnostics?: (aspect: AspectPreset) => unknown;
}

export type LicensedAudioImportInput = Omit<z.infer<typeof importLicensedAudioInput>, "confirmed">;

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
const sanitizeAsset = (asset: AssetRef) => ({
  assetId: scrub(asset.assetId, 128),
  kind: asset.kind,
  mimeType: scrub(asset.mimeType, 128),
  name: scrub(asset.name, 160),
  size: asset.size,
  ...(asset.attribution ? {
    attribution: {
      provider: asset.attribution.provider,
      sourceUrl: scrub(asset.attribution.sourceUrl, 500),
      creatorName: scrub(asset.attribution.creatorName, 160),
      creatorUrl: scrub(asset.attribution.creatorUrl, 500),
      licenseName: asset.attribution.licenseName ? scrub(asset.attribution.licenseName, 120) : undefined,
      licenseUrl: asset.attribution.licenseUrl ? scrub(asset.attribution.licenseUrl, 500) : undefined,
      attributionRequired: asset.attribution.attributionRequired,
    },
  } : {}),
});
const sanitizeStockSearch = (response: PexelsVideoSearchResult) => ({
  page: response.page,
  perPage: response.perPage,
  totalResults: response.totalResults,
  videos: response.videos.slice(0, 8).map((video) => ({
    id: video.id,
    width: video.width,
    height: video.height,
    duration: video.duration,
    thumbnail: scrub(video.thumbnail, 500),
    pexelsUrl: scrub(video.pexelsUrl, 500),
    photographer: scrub(video.photographer, 120),
    photographerUrl: scrub(video.photographerUrl, 500),
    renditions: video.renditions.slice(0, 3).map((rendition) => ({
      id: rendition.id,
      width: rendition.width,
      height: rendition.height,
      fps: rendition.fps,
      quality: rendition.quality,
      fileType: rendition.fileType,
      url: scrub(rendition.url, 800),
    })),
  })),
  omitted: Math.max(0, response.videos.length - 8),
  attribution: response.attribution,
});
const sanitizePhotoSearch = (response: PexelsPhotoSearchResult) => ({
  page: response.page,
  perPage: response.perPage,
  totalResults: response.totalResults,
  photos: response.photos.slice(0, 12).map((photo) => ({
    id: photo.id,
    width: photo.width,
    height: photo.height,
    alt: scrub(photo.alt, 240),
    thumbnail: scrub(photo.thumbnail, 500),
    imageUrl: scrub(photo.imageUrl, 800),
    pexelsUrl: scrub(photo.pexelsUrl, 500),
    photographer: scrub(photo.photographer, 120),
    photographerUrl: scrub(photo.photographerUrl, 500),
  })),
  omitted: Math.max(0, response.photos.length - 12),
  attribution: response.attribution,
});
const sanitizeTimeline = (version: ReturnType<typeof activeVersion>, maxItems: number) => ({
  aspect: version.aspect,
  clips: bounded(version.clips, maxItems, sanitizeClip),
  textOverlays: bounded(version.textOverlays, maxItems, sanitizeText),
  audioTracks: bounded(version.audioTracks, maxItems, sanitizeAudio),
  transitions: bounded(version.transitions, maxItems, sanitizeTransition),
});
const callbackResponse = (value: void | EditorWebMcpCallbackResult, fallback: string) => {
  if (value && !value.ok) return json({ ...value, ok: false, error: value.message });
  return json({ ...(value ?? {}), ok: true, message: value?.message ?? fallback });
};

const storyboardBaseline = (
  version: ReturnType<typeof activeVersion>,
  assets: readonly AssetRef[],
) => ({
  aspect: version.aspect,
  clips: version.clips.map(({ id, assetId, startFrame, endFrame }) => ({
    id,
    assetId,
    startFrame,
    endFrame,
  })),
  textOverlays: version.textOverlays.map(({ id, startFrame, endFrame }) => ({
    id,
    startFrame,
    endFrame,
  })),
  audioTracks: version.audioTracks.map(({ id, assetId, startFrame, endFrame }) => ({
    id,
    assetId,
    startFrame,
    endFrame,
  })),
  transitions: version.transitions.map(({ id, fromClipId, toClipId }) => ({
    id,
    fromClipId,
    toClipId,
  })),
  assetIds: assets.map((asset) => asset.assetId).sort(),
});

const storyboardApprovalToken = (
  spec: StoryboardSpec,
  baseline: ReturnType<typeof storyboardBaseline>,
): string => {
  const serialized = JSON.stringify({ spec, baseline });
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `storyboard-${(hash >>> 0).toString(16).padStart(8, "0")}-${serialized.length}`;
};

const createStoryboardVersion = ({
  spec,
  current,
  assets,
  createId,
}: {
  spec: StoryboardSpec;
  current: ReturnType<typeof activeVersion>;
  assets: readonly AssetRef[];
  createId: () => string;
}) => {
  const visualAssets = assets.filter(
    (asset): asset is AssetRef & { kind: "video" | "image" } =>
      asset.kind === "video" || asset.kind === "image",
  );
  const requestedFrames = spec.scenes.map((scene) =>
    Math.max(1, Math.round(scene.durationSeconds * FPS)),
  );
  const totalFrames = requestedFrames.reduce((sum, frames) => sum + frames, 0);
  if (totalFrames > MAX_DURATION_FRAMES) {
    throw new Error(
      `Storyboard is ${totalFrames - MAX_DURATION_FRAMES} frames over the 60 second limit`,
    );
  }

  let cursor = 0;
  const clips: Clip[] = [];
  const textOverlays: TextOverlay[] = [];
  spec.scenes.forEach((scene, index) => {
    const durationFrames = requestedFrames[index];
    const startFrame = cursor;
    const endFrame = startFrame + durationFrames;
    const requestedAsset = scene.assetId
      ? visualAssets.find((asset) => asset.assetId === scene.assetId)
      : visualAssets[index % Math.max(1, visualAssets.length)];
    if (scene.assetId && !requestedAsset) {
      throw new Error(`Visual asset ${scene.assetId} was not found`);
    }
    if (requestedAsset) {
      clips.push({
        ...createDefaultClip(createId(), requestedAsset.assetId, requestedAsset.kind),
        startFrame,
        endFrame,
        trimEndFrame: durationFrames,
      });
    }
    const overlay = createDefaultTextOverlay(createId());
    textOverlays.push({
      ...overlay,
      text: scene.text,
      startFrame: startFrame + Math.min(6, Math.floor(durationFrames / 6)),
      endFrame: requestedAsset
        ? endFrame - Math.min(4, Math.floor(durationFrames / 8))
        : endFrame,
      x: scene.x,
      y: scene.y,
      fontSize: scene.fontSize,
      color: scene.color,
      fontFamily: scene.fontFamily,
      fontWeight: scene.fontWeight,
      textAlign: scene.textAlign,
      stylePreset: "classic",
      createdaleyTexture: "plain",
      animation: {
        in: scene.animationIn,
        out: scene.animationOut,
        durationFrames: Math.max(
          1,
          Math.round(scene.animationDurationSeconds * FPS),
        ),
      },
    });
    cursor = endFrame;
  });

  const transitionFrames = Math.max(
    0,
    Math.round(spec.transition.durationSeconds * FPS),
  );
  const transitions: Transition[] =
    transitionFrames > 0
      ? clips.slice(0, -1).map((clip, index) => {
          const nextClip = clips[index + 1];
          const maximum = Math.max(
            1,
            Math.min(
              clip.endFrame - clip.startFrame - 1,
              nextClip.endFrame - nextClip.startFrame - 1,
            ),
          );
          return {
            id: createId(),
            kind: spec.transition.kind,
            fromClipId: clip.id,
            toClipId: nextClip.id,
            durationInFrames: Math.min(transitionFrames, maximum),
            easing: spec.transition.easing,
            ...(spec.transition.kind === "fade"
              ? {}
              : { direction: spec.transition.direction }),
          };
        })
      : [];

  const version = {
    ...current,
    clips,
    textOverlays,
    transitions,
    audioTracks: spec.preserveAudio ? current.audioTracks : [],
  };
  return {
    version,
    validation: validateEditorVersion(version, assets),
    sceneTimings: textOverlays.map((overlay, index) => {
      const startFrame = requestedFrames
        .slice(0, index)
        .reduce((sum, frames) => sum + frames, 0);
      return {
        scene: index + 1,
        startFrame,
        endFrame: startFrame + requestedFrames[index],
        textStartFrame: overlay.startFrame,
        textEndFrame: overlay.endFrame,
      };
    }),
  };
};

const getAttributionReport = (
  version: ReturnType<typeof activeVersion>,
  assets: readonly AssetRef[],
  includeUnused: boolean,
) => {
  const usedAssetIds = new Set([
    ...version.clips.map((clip) => clip.assetId),
    ...version.audioTracks.map((track) => track.assetId),
  ]);
  const selectedAssets = includeUnused
    ? assets
    : assets.filter((asset) => usedAssetIds.has(asset.assetId));
  const credits = selectedAssets.flatMap((asset) => {
    if (!asset.attribution) return [];
    const attribution = asset.attribution;
    const creator = scrub(attribution.creatorName, 160);
    const provider = attribution.provider === "pexels"
      ? "Pexels"
      : attribution.provider === "freesound"
        ? "Freesound"
        : attribution.provider === "jamendo"
          ? "Jamendo"
          : "Mixkit";
    return [{
      assetId: scrub(asset.assetId, 128),
      assetName: scrub(asset.name, 160),
      provider,
      creator,
      sourceUrl: scrub(attribution.sourceUrl, 500),
      creatorUrl: scrub(attribution.creatorUrl, 500),
      licenseName: attribution.licenseName
        ? scrub(attribution.licenseName, 120)
        : undefined,
      licenseUrl: attribution.licenseUrl
        ? scrub(attribution.licenseUrl, 500)
        : undefined,
      required: attribution.attributionRequired ?? false,
      creditLine: `${asset.name} by ${creator} via ${provider}${
        attribution.licenseName ? ` (${attribution.licenseName})` : ""
      }`,
    }];
  });
  const incompleteRequiredCredits = credits.filter(
    (credit) => credit.required && (!credit.creator || !credit.sourceUrl),
  );
  const localOrBundled = selectedAssets
    .filter((asset) => !asset.attribution)
    .map((asset) => ({
      assetId: scrub(asset.assetId, 128),
      assetName: scrub(asset.name, 160),
      provenance: asset.externalUrl ? "bundled-or-remote" : "user-provided",
      note: "No third-party attribution requirement is recorded in Inkframe metadata.",
    }));
  return {
    aspect: version.aspect,
    readyToPublish: incompleteRequiredCredits.length === 0,
    usedAssetCount: usedAssetIds.size,
    reportedAssetCount: selectedAssets.length,
    credits,
    localOrBundled,
    incompleteRequiredCredits,
    copyableCredits: credits.map((credit) => credit.creditLine).join("\n"),
  };
};

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
    defineTool({
      name: "editor_get_capabilities",
      title: "Get editor workflow guide",
      description: "Discover the recommended Inkframe agent workflows, tool groups, safeguards, and timeline limits. Start here instead of scanning every atomic tool.",
      schema: emptyInput,
      readOnly: true,
      execute: () => projectResult({
        ok: true,
        product: "Inkframe browser-native video editor",
        recommendedStart: "Use editor_plan_storyboard after importing or listing visual assets.",
        workflows: [
          {
            id: "create-review-export",
            label: "Create, review, and export a video",
            steps: [
              "editor_list_assets",
              "editor_search_stock_videos",
              "editor_import_stock_video",
              "editor_plan_storyboard",
              "editor_compose_storyboard",
              "editor_validate_project",
              "editor_capture_frame",
              "editor_auto_fix_project",
              "editor_get_attribution_report",
              "editor_request_export",
              "editor_get_export_status",
            ],
          },
          {
            id: "refine-existing",
            label: "Inspect and refine an existing edit",
            steps: [
              "editor_get_state_summary",
              "editor_validate_project",
              "editor_capture_frame",
              "editor_auto_fix_project",
              "editor_get_project",
            ],
          },
        ],
        toolGroups: {
          discover: ["editor_get_capabilities", "editor_get_state_summary", "editor_list_assets"],
          compose: ["editor_plan_storyboard", "editor_compose_storyboard"],
          inspect: ["editor_validate_project", "editor_get_render_diagnostics", "editor_capture_frame", "editor_get_attribution_report"],
          correct: ["editor_auto_fix_project", "editor_update_text_overlay", "editor_update_clip", "editor_update_audio_track"],
          deliver: ["editor_request_export", "editor_get_export_status", "editor_cancel_export"],
        },
        safeguards: {
          storyboardApprovalToken: true,
          confirmedDestructiveActions: true,
          localMediaNeverReturned: true,
          boundedSanitizedOutputs: true,
        },
        limits: {
          maxDurationInFrames: MAX_DURATION_FRAMES,
          maxDurationSeconds: MAX_DURATION_FRAMES / FPS,
          maxStoryboardScenes: 12,
        },
      }),
    }),
    defineTool({ name: "editor_get_state_summary", title: "Get editor state", description: "Get a compact summary of the current editor canvas and timeline.", schema: emptyInput, readOnly: true, execute: (_input, signal) => { throwIfAborted(signal); const state = context.getState(); const version = activeVersion(state); const visibleOverlays = version.textOverlays.slice(0, 10); return json({ ok: true, activeVersion: state.present.activeVersion, counts: { clips: version.clips.length, textOverlays: version.textOverlays.length, audioTracks: version.audioTracks.length, transitions: version.transitions.length }, textOverlays: visibleOverlays.map(({ id, text, startFrame, endFrame, stylePreset }) => ({ id, text: scrub(text, 120), startFrame, endFrame, stylePreset })), omittedTextOverlays: Math.max(0, version.textOverlays.length - visibleOverlays.length) }); } }),
    defineTool({ name: "editor_get_project", title: "Inspect editor project", description: "Inspect bounded, sanitized project timelines without exposing files, object URLs, data URLs, or secrets.", schema: projectInput, readOnly: true, execute: (input) => { const state = context.getState(); const maxItems = input.maxItems ?? 10; const aspects = input.aspect ? [input.aspect] : (["reel_9_16", "widescreen_16_9"] as const); const versions = Object.fromEntries(aspects.map((aspect) => [aspect, sanitizeTimeline(state.present.versions[aspect], maxItems)])); return projectResult({ ok: true, activeVersion: state.present.activeVersion, versions, assets: bounded(context.getAssets?.() ?? [], Math.min(maxItems, 25), sanitizeAsset) }); } }),
    defineTool({ name: "editor_validate_project", title: "Validate editor project", description: "Check export readiness, missing media, unsafe text, timeline gaps, overflow risk, and transition integrity.", schema: validateProjectInput, readOnly: true, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; const report = validateEditorVersion(activeVersion(context.getState(), aspect), context.getAssets?.() ?? []); return projectResult({ ok: true, report }); } }),
    defineTool({ name: "editor_get_render_diagnostics", title: "Get render diagnostics", description: "Inspect Elah adapter diagnostics and browser encoding capability alongside project validation.", schema: renderDiagnosticsInput, readOnly: true, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; const validation = validateEditorVersion(activeVersion(context.getState(), aspect), context.getAssets?.() ?? []); const runtime = context.getRenderDiagnostics?.(aspect) ?? null; return projectResult({ ok: true, aspect, validation, runtime }); } }),
    defineTool({ name: "editor_capture_frame", title: "Capture preview frame", description: "Seek the Elah preview, report active timeline items, and optionally return a reduced JPEG data URL for visual inspection.", schema: captureFrameInput, readOnly: true, execute: async (input, signal) => { const aspect = input.aspect ?? context.getState().present.activeVersion; const version = activeVersion(context.getState(), aspect); const duration = Math.max(1, getVersionRenderDurationInFrames(version)); if (input.frame >= duration) throw new Error(`Frame must be below the ${duration} frame timeline duration`); if (context.getState().present.activeVersion !== aspect) dispatch({ type: "switch-aspect", aspect }); if (!context.captureFrame) throw new Error("Frame capture is unavailable"); const capture = await context.captureFrame(input.frame, input.includeImage, signal); return json({ ok: true, inspection: inspectEditorFrame(version, input.frame), capture }, input.includeImage ? 450000 : MAX_PROJECT_CHARS); } }),
    defineTool({ name: "editor_get_export_status", title: "Get export status", description: "Read browser render progress, recovery guidance, and metadata for the latest exported MP4.", schema: emptyInput, readOnly: true, execute: () => { const exportState = context.getExportState?.() ?? { status: "idle", progress: 0, artifact: null }; return projectResult({ ok: true, export: exportState, nextAction: exportState.status === "rendering" ? "Poll editor_get_export_status until completed or failed." : exportState.status === "completed" ? "Verify artifact bytes, duration, codecs, and play the downloaded MP4." : exportState.status === "failed" ? "Read export.message, run editor_get_render_diagnostics, resolve the failure, then request export again." : "Validate and inspect the project before requesting export." }); } }),
    defineTool({ name: "editor_list_style_presets", title: "List text styles", description: "List text styles with native Elah preview and export parity.", schema: emptyInput, readOnly: true, execute: () => json({ ok: true, presets: [{ id: "classic", label: TEXT_OVERLAY_STYLE_PRESET_LABELS.classic }] }) }),
    defineTool({ name: "editor_list_assets", title: "List editor assets", description: "List safe asset metadata without exposing File objects, object URLs, data URLs, or secrets.", schema: assetsInput, readOnly: true, execute: (input) => json({ ok: true, ...bounded(context.getAssets?.() ?? [], input.maxItems ?? 50, sanitizeAsset) }) }),
    defineTool({
      name: "editor_get_attribution_report",
      title: "Get stock-media credits",
      description: "Create a copyable provenance and attribution report for media used by the active or specified timeline.",
      schema: attributionReportInput,
      readOnly: true,
      execute: (input) => {
        const aspect = input.aspect ?? context.getState().present.activeVersion;
        return projectResult({
          ok: true,
          report: getAttributionReport(
            activeVersion(context.getState(), aspect),
            context.getAssets?.() ?? [],
            input.includeUnused,
          ),
          nextAction: "Resolve incomplete required credits before editor_request_export.",
        });
      },
    }),
    defineTool({ name: "editor_list_sound_effects", title: "List built-in sound effects", description: "List the browser-native sound effects that can be added to a timeline.", schema: emptyInput, readOnly: true, execute: () => json({ ok: true, effects: SOUND_EFFECT_LIBRARY.map(({ id, label, defaultDurationInFrames }) => ({ id, label, defaultDurationInFrames })) }) }),
    defineTool({ name: "editor_search_stock_videos", title: "Search stock videos", description: "Search sanitized Pexels video metadata for the requested canvas.", schema: searchStockInput, readOnly: true, execute: async (input, signal) => { if (!context.searchStockVideos) throw new Error("Stock search is unavailable"); const aspect = input.aspect ?? context.getState().present.activeVersion; const response = await context.searchStockVideos(input.query, aspect, signal) as PexelsVideoSearchResult; return projectResult({ ok: true, aspect, result: sanitizeStockSearch(response) }); } }),
    defineTool({ name: "editor_import_stock_video", title: "Import stock video", description: "Download a selected Pexels video into the browser and append it to both canvas timelines.", schema: importStockInput, readOnly: false, execute: async (input, signal) => { if (!context.importStockVideo) throw new Error("Stock import is unavailable"); const aspect = input.aspect ?? context.getState().present.activeVersion; return callbackResponse(await context.importStockVideo(input.query, input.videoId, aspect, signal), "Stock video imported"); } }),
    defineTool({ name: "editor_search_stock_photos", title: "Search stock photos", description: "Search sanitized Pexels photo metadata for the requested canvas.", schema: searchStockInput, readOnly: true, execute: async (input, signal) => { if (!context.searchStockPhotos) throw new Error("Stock photo search is unavailable"); const aspect = input.aspect ?? context.getState().present.activeVersion; const response = await context.searchStockPhotos(input.query, aspect, signal) as PexelsPhotoSearchResult; return projectResult({ ok: true, aspect, result: sanitizePhotoSearch(response) }); } }),
    defineTool({ name: "editor_import_stock_photo", title: "Import stock photo", description: "Download a selected Pexels photo into the browser and append it to both canvas timelines.", schema: importStockPhotoInput, readOnly: false, execute: async (input, signal) => { if (!context.importStockPhoto) throw new Error("Stock photo import is unavailable"); const aspect = input.aspect ?? context.getState().present.activeVersion; return callbackResponse(await context.importStockPhoto(input.query, input.photoId, aspect, signal), "Stock photo imported"); } }),
    defineTool({ name: "editor_search_licensed_music", title: "Search licensed music", description: "Search downloadable CC0/CC BY/CC BY-SA music from Jamendo with source and license metadata.", schema: searchLicensedAudioInput, readOnly: true, execute: async (input, signal) => { if (!context.searchLicensedMusic) throw new Error("Licensed music search is unavailable"); return projectResult({ ok: true, result: await context.searchLicensedMusic(input.query, signal) }); } }),
    defineTool({ name: "editor_import_licensed_music", title: "Import licensed music", description: "Import a selected Jamendo track into this browser and retain its source, creator, and license. Requires confirmation.", schema: importLicensedAudioInput, readOnly: false, execute: async (input, signal) => { if (!context.importLicensedMusic) throw new Error("Licensed music import is unavailable"); const { confirmed: _confirmed, ...request } = input; void _confirmed; return callbackResponse(await context.importLicensedMusic(request, signal), "Licensed music imported"); } }),
    defineTool({ name: "editor_search_licensed_sfx", title: "Search licensed sound effects", description: "Search CC0/CC BY/CC BY-SA professional sound effects from Freesound with attribution metadata.", schema: searchLicensedAudioInput, readOnly: true, execute: async (input, signal) => { if (!context.searchLicensedSoundEffects) throw new Error("Licensed sound-effect search is unavailable"); return projectResult({ ok: true, result: await context.searchLicensedSoundEffects(input.query, signal) }); } }),
    defineTool({ name: "editor_import_licensed_sfx", title: "Import licensed sound effect", description: "Import a selected Freesound effect into this browser and retain its source, creator, and license. Requires confirmation.", schema: importLicensedAudioInput, readOnly: false, execute: async (input, signal) => { if (!context.importLicensedSoundEffect) throw new Error("Licensed sound-effect import is unavailable"); const { confirmed: _confirmed, ...request } = input; void _confirmed; return callbackResponse(await context.importLicensedSoundEffect(request, signal), "Licensed sound effect imported"); } }),
    defineTool({ name: "editor_import_audio_url", title: "Import audio URL", description: "Download a confirmed HTTPS audio source into the browser and add it to the active timeline.", schema: audioUrlInput, readOnly: false, execute: async (input, signal) => { if (!context.importAudioFromUrl) throw new Error("Remote audio import is unavailable"); const { confirmed: _confirmed, ...request } = input; void _confirmed; return callbackResponse(await context.importAudioFromUrl(request, signal), "Audio imported"); } }),
    defineTool({ name: "editor_request_media_picker", title: "Open media picker", description: "Open Inkframe's native media picker so the user can choose local video, image, or audio files.", schema: emptyInput, readOnly: false, execute: async (_input, signal) => { if (!context.requestMediaPicker) throw new Error("Media picker is unavailable"); await context.requestMediaPicker(signal); throwIfAborted(signal); return result("Media picker requested"); } }),
    defineTool({
      name: "editor_plan_storyboard",
      title: "Plan storyboard for approval",
      description: "Validate and preview a multi-scene storyboard without changing the editor. Returns the approval token required by editor_compose_storyboard.",
      schema: planStoryboardInput,
      readOnly: true,
      execute: (input) => {
        const state = context.getState();
        const aspect = input.aspect ?? state.present.activeVersion;
        const current = activeVersion(state, aspect);
        const assets = context.getAssets?.() ?? [];
        const approvedSpec = { ...input, aspect };
        let idSequence = 0;
        const preview = createStoryboardVersion({
          spec: approvedSpec,
          current,
          assets,
          createId: () => `storyboard-preview-${++idSequence}`,
        });
        const approvalToken = storyboardApprovalToken(
          approvedSpec,
          storyboardBaseline(current, assets),
        );
        return projectResult({
          ok: true,
          message: "Storyboard plan is valid and ready for human approval.",
          approvalToken,
          requiresConfirmation: true,
          aspect,
          effects: {
            replacesVisualTimeline: true,
            preservesAudio: input.preserveAudio,
            scenes: input.scenes.length,
            transitions: preview.version.transitions.length,
          },
          sceneTimings: preview.sceneTimings,
          validation: preview.validation,
          approvedSpec,
          nextAction: {
            tool: "editor_compose_storyboard",
            instruction: "After the human approves this exact plan, repeat approvedSpec with confirmed: true and this approvalToken.",
          },
        });
      },
    }),
    defineTool({
      name: "editor_auto_fix_project",
      title: "Apply safe project corrections",
      description: "Apply conservative export-readiness fixes and optionally correct failed text contrast at one captured frame. Requires explicit confirmation and reports every change.",
      schema: autoFixProjectInput,
      readOnly: false,
      execute: async (input, signal) => {
        const state = context.getState();
        const aspect = input.aspect ?? state.present.activeVersion;
        if (state.present.activeVersion !== aspect) {
          dispatch({ type: "switch-aspect", aspect });
        }
        const current = activeVersion(context.getState(), aspect);
        const fixed = autoFixEditorVersion(current);
        let correctedVersion = fixed.version;
        const changes = [...fixed.changes];

        if (input.contrastFrame !== undefined) {
          const duration = Math.max(1, getVersionRenderDurationInFrames(current));
          if (input.contrastFrame >= duration) {
            throw new Error(`contrastFrame must be below the ${duration} frame timeline duration`);
          }
          if (!context.captureFrame) {
            throw new Error("Frame capture is unavailable, so contrast cannot be corrected");
          }
          const capture = await context.captureFrame(input.contrastFrame, false, signal);
          throwIfAborted(signal);
          const recommendedColors = new Map(
            capture.contrastChecks
              .filter((check) => !check.passes)
              .map((check) => [check.overlayId, check.recommendedColor]),
          );
          correctedVersion = {
            ...correctedVersion,
            textOverlays: correctedVersion.textOverlays.map((overlay) => {
              const recommendedColor = recommendedColors.get(overlay.id);
              if (!recommendedColor || recommendedColor === overlay.color) return overlay;
              changes.push({
                entityId: overlay.id,
                field: "color",
                from: overlay.color,
                to: recommendedColor,
                reason: `Meet WCAG contrast at frame ${input.contrastFrame}.`,
              });
              return { ...overlay, color: recommendedColor };
            }),
          };
        }

        const validation = validateEditorVersion(
          correctedVersion,
          context.getAssets?.() ?? [],
        );
        if (changes.length > 0) {
          dispatch({ type: "replace-version", aspect, version: correctedVersion });
        }
        return projectResult({
          ok: true,
          message: changes.length > 0
            ? `Applied ${changes.length} safe project corrections.`
            : "No safe automatic corrections were needed.",
          aspect,
          changes,
          validation,
          remainingManualIssues: validation.issues.filter((item) => !item.fixable),
          nextAction: validation.readyForExport
            ? "Capture representative frames, review credits, then request export."
            : "Resolve the remaining manual issues and validate again.",
        });
      },
    }),
    defineTool({
      name: "editor_compose_storyboard",
      title: "Compose approved storyboard",
      description: "Replace the visual timeline with the exact storyboard returned by editor_plan_storyboard. Requires its approval token and explicit human confirmation.",
      schema: composeStoryboardInput,
      readOnly: false,
      execute: (request) => {
        const {
          approvalToken,
          confirmed: _confirmed,
          ...input
        } = request;
        void _confirmed;
        const state = context.getState();
        const aspect = input.aspect ?? state.present.activeVersion;
        const current = activeVersion(state, aspect);
        const assets = context.getAssets?.() ?? [];
        const approvedSpec = { ...input, aspect };
        const expectedToken = storyboardApprovalToken(
          approvedSpec,
          storyboardBaseline(current, assets),
        );
        if (approvalToken !== expectedToken) {
          throw new Error(
            "approvalToken does not match this storyboard. Run editor_plan_storyboard again and obtain approval for the exact returned plan.",
          );
        }
        let idSequence = 0;
        const ids = () =>
          `${context.createId?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}-${++idSequence}`;
        const composed = createStoryboardVersion({
          spec: approvedSpec,
          current,
          assets,
          createId: ids,
        });
        if (!composed.validation.readyForExport) {
          throw new Error(
            composed.validation.issues.find((item) => item.severity === "error")?.message ??
              "Storyboard validation failed",
          );
        }
        dispatch({ type: "replace-version", aspect, version: composed.version });
        if (state.present.activeVersion !== aspect) {
          dispatch({ type: "switch-aspect", aspect });
        }
        if (composed.version.textOverlays[0]) {
          context.selectText?.(composed.version.textOverlays[0].id);
        }
        return projectResult({
          ok: true,
          message: `Composed ${input.scenes.length} approved Elah-native scenes.`,
          aspect,
          approvalToken,
          changed: {
            clips: composed.version.clips.map((clip) => clip.id),
            textOverlays: composed.version.textOverlays.map((overlay) => overlay.id),
            transitions: composed.version.transitions.map((transition) => transition.id),
          },
          counts: composed.validation.counts,
          durationInFrames: composed.validation.durationInFrames,
          warnings: composed.validation.issues.filter((item) => item.severity === "warning"),
          nextAction: "Run editor_validate_project, capture representative frames, and correct any issues before export.",
        });
      },
    }),
    defineTool({ name: "editor_switch_canvas", title: "Switch canvas", description: "Switch the active canvas aspect ratio.", schema: switchInput, readOnly: false, execute: (input) => { dispatch({ type: "switch-aspect", aspect: input.aspect }); return result("Canvas switched", { activeVersion: input.aspect }); } }),
    defineTool({ name: "editor_select_timeline_item", title: "Select timeline item", description: "Select an existing clip, text overlay, or audio track in the editor timeline.", schema: selectInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; requireItem(aspect, input.itemType, input.itemId); const callback = input.itemType === "clip" ? context.selectClip : input.itemType === "textOverlay" ? context.selectText : context.selectAudio; if (!callback) throw new Error("Timeline selection is unavailable"); callback(input.itemId); return result("Timeline item selected", { aspect, itemType: input.itemType, itemId: input.itemId }); } }),
    defineTool({ name: "editor_add_text_overlay", title: "Add text overlay", description: "Add a text overlay to the current or specified canvas.", schema: addInput, readOnly: false, execute: (input) => { const state = context.getState(); const aspect = input.aspect ?? state.present.activeVersion; const { aspect: _aspect, id, ...fields } = input; void _aspect; const overlay = { ...createDefaultTextOverlay(id ?? context.createId?.() ?? `text-${Date.now()}`), ...fields } as TextOverlay; validateRange(overlay.startFrame, overlay.endFrame); dispatch({ type: "add-text-overlay", aspect, overlay }); context.selectText?.(overlay.id); return result("Text overlay added", { aspect, overlayId: overlay.id }); } }),
    defineTool({ name: "editor_update_text_overlay", title: "Update text overlay", description: "Update fields on an existing text overlay.", schema: updateInput, readOnly: false, execute: (input) => { const state = context.getState(); const aspect = input.aspect ?? state.present.activeVersion; const current = activeVersion(state, aspect).textOverlays.find((item) => item.id === input.overlayId); if (!current) throw new Error("Text overlay not found"); const { overlayId, aspect: _aspect, ...patch } = input; void _aspect; validateRange(patch.startFrame ?? current.startFrame, patch.endFrame ?? current.endFrame); dispatch({ type: "update-text-overlay", aspect, overlayId, patch }); context.selectText?.(overlayId); return result("Text overlay updated", { aspect, overlayId }); } }),
    defineTool({ name: "editor_remove_text_overlay", title: "Remove text overlay", description: "Remove a text overlay. Requires explicit confirmation.", schema: removeTextInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; if (!activeVersion(context.getState(), aspect).textOverlays.some((item) => item.id === input.overlayId)) throw new Error("Text overlay not found"); dispatch({ type: "remove-text-overlay", aspect, overlayId: input.overlayId }); return result("Text overlay removed", { aspect, overlayId: input.overlayId }); } }),
    defineTool({ name: "editor_update_clip", title: "Update clip", description: "Update timing, trim, or volume fields on an existing media clip.", schema: updateClipInput, readOnly: false, execute: (input) => { const state = context.getState(); const aspect = input.aspect ?? state.present.activeVersion; const current = activeVersion(state, aspect).clips.find((item) => item.id === input.clipId); if (!current) throw new Error("Clip not found"); const { clipId, aspect: _aspect, ...patch } = input; void _aspect; validateRange(patch.startFrame ?? current.startFrame, patch.endFrame ?? current.endFrame); validateRange(patch.trimStartFrame ?? current.trimStartFrame, patch.trimEndFrame ?? current.trimEndFrame); dispatch({ type: "update-clip", aspect, clipId, patch }); return result("Clip updated", { aspect, clipId }); } }),
    defineTool({ name: "editor_remove_clip", title: "Remove clip", description: "Remove a clip and its connected transitions. Requires explicit confirmation.", schema: removeClipInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; if (!activeVersion(context.getState(), aspect).clips.some((item) => item.id === input.clipId)) throw new Error("Clip not found"); dispatch({ type: "remove-clip", aspect, clipId: input.clipId }); return result("Clip removed", { aspect, clipId: input.clipId }); } }),
    defineTool({ name: "editor_move_clip", title: "Reorder clip", description: "Move an existing clip one position earlier or later in the timeline.", schema: moveClipInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; const version = activeVersion(context.getState(), aspect); const index = version.clips.findIndex((clip) => clip.id === input.clipId); if (index < 0) throw new Error("Clip not found"); if (index + input.offset < 0 || index + input.offset >= version.clips.length) throw new Error("Clip cannot move further in that direction"); dispatch({ type: "move-clip", aspect, clipId: input.clipId, offset: input.offset }); return result("Clip reordered", { aspect, clipId: input.clipId, offset: input.offset }); } }),
    defineTool({ name: "editor_split_clip", title: "Split clip", description: "Split a visual clip at an exact timeline frame.", schema: splitClipInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; const version = activeVersion(context.getState(), aspect); const clip = version.clips.find((item) => item.id === input.clipId); if (!clip) throw new Error("Clip not found"); if (input.splitFrame <= clip.startFrame || input.splitFrame >= clip.endFrame) throw new Error("Split frame must be inside the clip"); const base = context.createId?.() ?? `${Date.now()}`; const leftClipId = `${base}-left`; const rightClipId = `${base}-right`; dispatch({ type: "split-clip", aspect, clipId: input.clipId, splitFrame: input.splitFrame, leftClipId, rightClipId }); context.selectClip?.(rightClipId); return result("Clip split", { aspect, leftClipId, rightClipId, splitFrame: input.splitFrame }); } }),
    defineTool({ name: "editor_duplicate_clip", title: "Duplicate clip", description: "Duplicate a visual clip directly after the original.", schema: duplicateClipInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; if (!activeVersion(context.getState(), aspect).clips.some((clip) => clip.id === input.clipId)) throw new Error("Clip not found"); const newClipId = `${context.createId?.() ?? Date.now()}-copy`; dispatch({ type: "duplicate-clip", aspect, clipId: input.clipId, newClipId }); context.selectClip?.(newClipId); return result("Clip duplicated", { aspect, sourceClipId: input.clipId, newClipId }); } }),
    defineTool({ name: "editor_set_transition", title: "Set transition", description: "Set a fade, slide, or wipe transition between adjacent clips.", schema: transitionInput, readOnly: false, execute: (input) => { const state = context.getState(); const aspect = input.aspect ?? state.present.activeVersion; const version = activeVersion(state, aspect); const fromIndex = version.clips.findIndex((clip) => clip.id === input.fromClipId); const toIndex = version.clips.findIndex((clip) => clip.id === input.toClipId); if (fromIndex < 0 || toIndex < 0 || toIndex !== fromIndex + 1) throw new Error("Transition clips must be adjacent"); const maxDuration = Math.max(0, Math.min(getClipDurationInFrames(version.clips[fromIndex]) - 1, getClipDurationInFrames(version.clips[toIndex]) - 1)); if (input.durationInFrames > maxDuration) throw new Error(`Transition duration must be at most ${maxDuration} frames`); const transition: Transition = { id: input.id ?? context.createId?.() ?? `transition-${Date.now()}`, kind: input.kind, durationInFrames: input.durationInFrames, fromClipId: input.fromClipId, toClipId: input.toClipId, easing: input.easing, ...(input.kind !== "fade" ? { direction: input.direction ?? "left" } : {}) }; dispatch({ type: "set-transition", aspect, transition }); return result("Transition set", { aspect, transitionId: transition.id, kind: transition.kind, fromClipId: input.fromClipId, toClipId: input.toClipId, durationInFrames: input.durationInFrames }); } }),
    defineTool({ name: "editor_remove_transition", title: "Remove transition", description: "Remove a transition. Requires explicit confirmation.", schema: removeTransitionInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; if (!activeVersion(context.getState(), aspect).transitions.some((transition) => transition.fromClipId === input.fromClipId && transition.toClipId === input.toClipId)) throw new Error("Transition not found"); dispatch({ type: "remove-transition", aspect, fromClipId: input.fromClipId, toClipId: input.toClipId }); return result("Transition removed", { aspect, fromClipId: input.fromClipId, toClipId: input.toClipId }); } }),
    defineTool({ name: "editor_update_audio_track", title: "Update audio track", description: "Update timing, trim, or volume fields on an existing audio track.", schema: updateAudioInput, readOnly: false, execute: (input) => { const state = context.getState(); const aspect = input.aspect ?? state.present.activeVersion; const current = activeVersion(state, aspect).audioTracks.find((item) => item.id === input.trackId); if (!current) throw new Error("Audio track not found"); const { trackId, aspect: _aspect, ...patch } = input; void _aspect; validateRange(patch.startFrame ?? current.startFrame, patch.endFrame ?? current.endFrame); validateRange(patch.trimStartFrame ?? current.trimStartFrame, patch.trimEndFrame ?? current.trimEndFrame); dispatch({ type: "update-audio-track", aspect, trackId, patch }); return result("Audio track updated", { aspect, trackId }); } }),
    defineTool({ name: "editor_remove_audio_track", title: "Remove audio track", description: "Remove an audio track. Requires explicit confirmation.", schema: removeAudioInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; if (!activeVersion(context.getState(), aspect).audioTracks.some((item) => item.id === input.trackId)) throw new Error("Audio track not found"); dispatch({ type: "remove-audio-track", aspect, trackId: input.trackId }); return result("Audio track removed", { aspect, trackId: input.trackId }); } }),
    defineTool({ name: "editor_add_sound_effect", title: "Add built-in sound effect", description: "Add a browser-native sound effect to the active or specified timeline.", schema: sfxInput, readOnly: false, execute: async (input, signal) => { if (!context.addSoundEffect) throw new Error("Sound effects are unavailable"); const aspect = input.aspect ?? context.getState().present.activeVersion; const effect = getSoundEffectById(input.effectId as never); if (!effect) throw new Error("Sound effect not found"); await context.addSoundEffect(effect.id, aspect, signal); throwIfAborted(signal); return result("Sound effect added", { aspect, effectId: effect.id, label: effect.label }); } }),
    defineTool({ name: "editor_apply_ai_editor_actions", title: "Apply structured editor actions", description: "Apply validated structured AI editor actions. Requires explicit confirmation.", schema: applyAIInput, readOnly: false, execute: async (input, signal) => { if (!context.applyAIEditorActions) throw new Error("AI editor actions are unavailable"); return callbackResponse(await context.applyAIEditorActions(input.actions, signal), "AI editor actions applied"); } }),
    defineTool({ name: "editor_request_export", title: "Request validated video export", description: "Validate the active project and request a local browser MP4 download. Requires explicit confirmation because it creates an external artifact.", schema: z.object({ confirmed: z.literal(true) }).strict(), readOnly: false, execute: async (_input, signal) => { if (!context.requestExport) throw new Error("Export is unavailable"); const state = context.getState(); const aspect = state.present.activeVersion; const version = activeVersion(state, aspect); const validation = validateEditorVersion(version, context.getAssets?.() ?? []); if (!validation.readyForExport) throw new Error(`Export blocked: ${validation.issues.filter((item) => item.severity === "error").map((item) => item.message).join(" ")}`); const credits = getAttributionReport(version, context.getAssets?.() ?? [], false); if (!credits.readyToPublish) throw new Error("Export blocked: required stock-media attribution metadata is incomplete"); const response = await context.requestExport(signal); throwIfAborted(signal); if (!response.ok) return json({ ...response, ok: false, error: response.message }); return projectResult({ ...response, ok: true, message: response.message || "Export requested", validation: { readyForExport: true, warnings: validation.counts.warnings }, credits: { readyToPublish: credits.readyToPublish, creditLines: credits.copyableCredits }, nextAction: "Poll editor_get_export_status until completed, then verify and play the downloaded MP4." }); } }),
    defineTool({ name: "editor_cancel_export", title: "Cancel video export", description: "Cancel the active browser export. Requires explicit confirmation.", schema: cancelExportInput, readOnly: false, execute: async (_input, signal) => { if (!context.cancelExport) throw new Error("Export cancellation is unavailable"); return callbackResponse(await context.cancelExport(signal), "Export cancellation requested"); } }),
    defineTool({ name: "editor_remove_asset", title: "Remove editor asset", description: "Remove an asset and its timeline references through the host editor. Requires explicit confirmation.", schema: removeAssetInput, readOnly: false, execute: async (input, signal) => { if (!context.removeAsset) throw new Error("Asset removal is unavailable"); const assets = context.getAssets?.(); if (assets && !assets.some((asset) => asset.assetId === input.assetId)) throw new Error("Asset not found"); return callbackResponse(await context.removeAsset(input.assetId, signal), "Asset removed"); } }),
    defineTool({ name: "editor_undo", title: "Undo editor change", description: "Undo the latest editor mutation.", schema: emptyInput, readOnly: false, execute: () => { if (!context.undo || context.getState().past.length === 0) throw new Error("Nothing to undo"); context.undo(); return result("Undo applied"); } }),
    defineTool({ name: "editor_redo", title: "Redo editor change", description: "Redo the latest undone editor mutation.", schema: emptyInput, readOnly: false, execute: () => { if (!context.redo || context.getState().future.length === 0) throw new Error("Nothing to redo"); context.redo(); return result("Redo applied"); } }),
  ];
};

export const editorWebMcpTools = createEditorWebMcpTools;
