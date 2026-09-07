import { z } from "zod";
import { createBeatMontageTools } from "./beat-tools";
import type { analyzeMusicUrl } from "./beat-audio-browser";
import type { sampleVideoMoments } from "./beat-video-browser";
import { selectiveColorRegionSchema } from "../schema";
import { correctTrackingPoint, trackingToKeyframes } from "../object-tracking";
import type { trackVideoObject } from "@/lib/export/object-tracking-browser";
import { ASPECT_PRESETS } from "../constants";
import { GRADING_REVIEW_PROTOCOL, gradingReviewSchema, requireThreeReviews, type GradingReview } from "./grading-review";
import type { RuntimeCapabilities } from "@/lib/webmcp/runtime-capabilities";
import {
  getWebMCPExecuteSignal,
  type WebMcpTool,
  type WebMCPExecuteOptions,
} from "@/lib/webmcp/types";
import { aiEditorActionsSchema, type AIEditorActions } from "../ai-actions";
import { FPS, MAX_DURATION_FRAMES } from "../constants";
import { createDefaultClip, createDefaultTextOverlay } from "../defaults";
import { validateEditorCommandAction, type EditorCommand, type EditorHistoryState } from "../history";
import { getClipDurationInFrames } from "../domain/helpers";
import { getVersionRenderDurationInFrames } from "../timeline";
import { importCaptions } from "../captions";
import { planAudioBalance } from "../audio-balance";
import { validateTimeMapping, type TimeMapping } from "../time-mapping";
import { DEFAULT_VIDEO_TRACK_ID, ensureEditorTracks } from "../tracks";
import type {
  PexelsPhotoSearchResult,
  PexelsVideoSearchResult,
} from "@/lib/pexels";
import type { LicensedAudioSearchResult } from "@/lib/stock-audio";
import type { EditorAction } from "../reducer";
import type {
  EditorExportState,
  EditorFrameCapture,
  EditorVisualReview,
} from "../export-state";
import {
  autoFixEditorVersion,
  inspectEditorFrame,
  validateEditorVersion,
} from "./diagnostics";
import {
  inspectColorConsistency,
  inspectColorConsistencyFromSources,
  previewColorCorrections,
  proposeColorCorrections,
  proposeShotGradesFromSources,
  selectColorChanges,
  type ColorWorkflowChange,
  type ColorWorkflowProposal,
} from "./color-workflow";
import type { SourceColorAsset } from "./color-consistency";
import type { ColorComparisonEvidence } from "./color-evidence";
import {
  TEXT_OVERLAY_ANIMATION_KINDS,
  type AspectPreset,
  type AssetRef,
  type AudioTrack,
  type Clip,
  type TextOverlay,
  type Transition,
  type VersionTimeline,
} from "../types";

const aspectSchema = z.enum(["reel_9_16", "widescreen_16_9"]);
const frameSchema = z.number().int().min(0).max(MAX_DURATION_FRAMES);
const durationSchema = z.number().int().min(1).max(MAX_DURATION_FRAMES);
const stylePresetSchema = z.literal("classic");
const textFields = {
  text: z.string().trim().min(1).max(2000).optional(),
  startFrame: frameSchema.optional(),
  endFrame: frameSchema.optional(),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  fontSize: z.number().min(1).max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontFamily: z.enum(["sans", "modern", "serif", "cursive", "mono", "display", "editorial", "rounded"]).optional(),
  fontWeight: z.number().int().min(100).max(900).optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  stylePreset: stylePresetSchema.optional(),
  contrast: z.literal("outline").optional(),
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
  videoFilter: z.object({
    preset: z.enum(["none", "cinematic", "warm", "cool", "vintage", "mono", "custom"]),
    brightness: z.number().min(0.5).max(1.5),
    contrast: z.number().min(0.5).max(1.5),
    saturation: z.number().min(0).max(2),
    sepia: z.number().min(0).max(1),
    grayscale: z.number().min(0).max(1),
    hueRotate: z.number().min(-30).max(30),
    selectiveRegions: z.array(selectiveColorRegionSchema).max(8).optional(),
  }).strict().optional(),
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
const projectInput = z.object({ aspect: aspectSchema.optional(), maxItems: z.number().int().min(1).max(25).optional(), offset: z.number().int().min(0).max(100000).default(0) }).strict();
const assetsInput = z.object({ maxItems: z.number().int().min(1).max(100).optional() }).strict();
const selectInput = z.object({
  aspect: aspectSchema.optional(), itemType: z.enum(["clip", "textOverlay", "audioTrack"]),
  itemId: z.string().trim().min(1).max(128),
}).strict();
const commandFields = {
  aspect: aspectSchema,
  expectedRevision: z.number().int().nonnegative(),
  operationId: z.string().trim().min(1).max(128),
};
const addTrackInput = z.object({ ...commandFields, id: z.string().trim().min(1).max(128), kind: z.enum(["video", "text", "audio", "caption"]), name: z.string().trim().min(1).max(128) }).strict();
const reorderTracksInput = z.object({ ...commandFields, trackIds: z.array(z.string().min(1).max(128)).min(1).max(100) }).strict();
const placeClipInput = z.object({ ...commandFields, clipId: z.string().min(1).max(128), trackId: z.string().min(1).max(128), startFrame: frameSchema }).strict();
const clipTransformInput = z.object({
  ...commandFields, clipId: z.string().min(1).max(128),
  transform: z.object({ x: z.number(), y: z.number(), scale: z.number().positive(), rotation: z.number(), anchor: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict() }).strict(),
  opacity: z.number().min(0).max(1).optional(),
}).strict();
const keyframePointSchema = z.object({ id: z.string().min(1).max(128), frame: frameSchema, value: z.number(), interpolation: z.enum(["linear", "hold"]) }).strict();
const keyframesInput = z.object({ ...commandFields, clipId: z.string().min(1).max(128), keyframes: z.object({ x: z.array(keyframePointSchema).max(1000).optional(), y: z.array(keyframePointSchema).max(1000).optional(), scale: z.array(keyframePointSchema).max(1000).optional(), rotation: z.array(keyframePointSchema).max(1000).optional(), opacity: z.array(keyframePointSchema).max(1000).optional() }).strict() }).strict();
const trackingBoxSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).strict();
const trackingStartInput = z.object({ aspect: aspectSchema, clipId: z.string().min(1).max(128), box: trackingBoxSchema }).strict();
const trackingCorrectionInput = z.object({ trackingId: z.string().min(1).max(160), frame: frameSchema, x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict();
const trackingApplyInput = z.object({ ...commandFields, trackingId: z.string().min(1).max(160), targetClipId: z.string().min(1).max(128), confirmed: z.literal(true) }).strict();
const selectiveGradeInput = z.object({ ...commandFields, clipId: z.string().min(1).max(128), regions: z.array(selectiveColorRegionSchema).max(8), confirmed: z.literal(true) }).strict();
const captionCueSchema = z.object({ id: z.string().min(1).max(128), trackId: z.string().min(1).max(128), startFrame: frameSchema, endFrame: frameSchema, text: z.string().trim().min(1).max(4000) }).strict();
const captionCuesInput = z.object({ ...commandFields, cues: z.array(captionCueSchema).min(1).max(1000) }).strict();
const captionsImportInput = z.object({ ...commandFields, trackId: z.string().min(1).max(128), format: z.enum(["srt", "vtt"]), content: z.string().min(1).max(200000), mode: z.enum(["append", "replace"]).default("append") }).strict();
const audioReferenceSchema = z.object({ kind: z.enum(["audio", "video"]), id: z.string().min(1).max(128) }).strict();
const audioBalanceFields = {
  music: audioReferenceSchema,
  narration: z.array(audioReferenceSchema).min(1).max(1000),
  strength: z.enum(["gentle", "balanced", "strong"]),
  ruleId: z.string().trim().min(1).max(128),
};
const planAudioBalanceInput = z.object({ aspect: aspectSchema, ...audioBalanceFields }).strict();
const applyAudioBalanceInput = z.object({ ...commandFields, ...audioBalanceFields, confirmed: z.literal(true) }).strict();
const duckingInput = z.object({ ...commandFields, rule: z.object({ id: z.string().min(1).max(128), target: audioReferenceSchema, triggers: z.array(audioReferenceSchema).min(1).max(1000), attenuationDb: z.number().min(-60).max(0), attackFrames: frameSchema, releaseFrames: frameSchema }).strict() }).strict();
const removeDuckingInput = z.object({ ...commandFields, ruleId: z.string().min(1).max(128), confirmed: z.literal(true) }).strict();
const freezeInput = z.object({ ...commandFields, clipId: z.string().min(1).max(128), startFrame: frameSchema, endFrame: frameSchema, sourceTimeUs: z.number().int().nonnegative() }).strict();
const speedRampInput = z.object({ ...commandFields, clipId: z.string().min(1).max(128), points: z.array(z.object({ frame: frameSchema, speed: z.number().positive(), interpolation: z.enum(["linear", "hold"]) }).strict()).min(1).max(1000), audioPolicy: z.literal("mute") }).strict();
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
  provider: z.enum(["mixkit", "freesound"]).optional(),
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
const captureContactSheetInput = z.object({
  aspect: aspectSchema.optional(),
  frames: z.array(frameSchema).min(2).max(8).optional(),
  includeImages: z.boolean().default(false),
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
const colorInspectInput = z.object({
  aspect: aspectSchema.optional(),
  clipIds: z.array(z.string().trim().min(1).max(128)).max(100).optional(),
}).strict();
const colorProposeInput = z.object({
  aspect: aspectSchema.optional(),
  clipIds: z.array(z.string().trim().min(1).max(128)).max(100).optional(),
  findingIds: z.array(z.string().trim().min(1).max(160)).max(400).optional(),
  creativeIntent: z.string().trim().min(1).max(2000).optional(),
  strength: z.number().min(0).max(2).optional(),
  candidates: z.array(z.object({
    clipId: z.string().trim().min(1).max(128),
    rationale: z.string().trim().min(1).max(1000),
    videoFilter: updateClipInput.shape.videoFilter.unwrap().extend({
      exposure: z.number().min(-2).max(2).optional(),
      temperature: z.number().min(-1).max(1).optional(),
      tint: z.number().min(-1).max(1).optional(),
      shadows: z.number().min(-1).max(1).optional(),
      highlights: z.number().min(-1).max(1).optional(),
      toneCurve: z.enum(["linear", "filmic"]).optional(),
    }).strict(),
  }).strict()).min(1).max(12).optional(),
}).strict();
const colorPreviewInput = z.object({
  proposalId: z.string().trim().min(1).max(160),
  targetIds: z.array(z.string().trim().min(1).max(128)).max(100).optional(),
  changeIds: z.array(z.string().trim().min(1).max(160)).min(1).max(100).optional(),
  includeImages: z.boolean().default(false),
}).strict().refine(
  (input) => !(input.targetIds?.length && input.changeIds?.length),
  "Provide targetIds or changeIds, not both",
);
const colorVisualDecisionSchema = z.object({
  changeId: z.string().trim().min(1).max(160),
  decision: z.enum(["improves", "neutral", "worse"]),
  reason: z.string().trim().min(1).max(500).optional(),
}).strict();
const colorApproveInput = z.object({
  proposalId: z.string().trim().min(1).max(160),
  previewId: z.string().trim().min(1).max(160),
  decisions: z.array(colorVisualDecisionSchema).min(1).max(100),
  /** @deprecated Decisions now determine the applicable change IDs. */
  changeIds: z.array(z.string().trim().min(1).max(160)).min(1).max(100).optional(),
  confirmed: z.literal(true),
}).strict();
const colorApplyInput = z.object({
  proposalId: z.string().trim().min(1).max(160),
  approvalId: z.string().trim().min(1).max(160),
  expectedRevision: z.number().int().nonnegative(),
  operationId: z.string().trim().min(1).max(128),
}).strict();
const colorUndoInput = z.object({
  operationId: z.string().trim().min(1).max(128),
  undoOperationId: z.string().trim().min(1).max(128),
  expectedRevision: z.number().int().nonnegative(),
}).strict();
const colorStatusInput = z.object({
  proposalId: z.string().trim().min(1).max(160).optional(),
  previewId: z.string().trim().min(1).max(160).optional(),
  approvalId: z.string().trim().min(1).max(160).optional(),
  operationId: z.string().trim().min(1).max(128).optional(),
}).strict().refine(
  (input) => Boolean(input.proposalId || input.previewId || input.approvalId || input.operationId),
  "Provide at least one color workflow ID",
);
const storyboardSceneSchema = z.object({
  text: z.string().trim().min(1).max(400),
  assetId: z.string().trim().min(1).max(128).optional(),
  durationSeconds: z.number().min(0.5).max(20).default(3),
  x: z.number().min(6).max(94).default(50),
  y: z.number().min(8).max(90).default(50),
  fontSize: z.number().int().min(24).max(180).default(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f2ede3"),
  fontFamily: z.enum(["sans", "modern", "serif", "cursive", "mono", "display", "editorial", "rounded"]).default("sans"),
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
  variantName: z.string().trim().min(1).max(80).optional(),
}).strict();
const planStoryboardInput = storyboardSpecSchema;
const composeStoryboardInput = storyboardSpecSchema.extend({
  approvalToken: z.string().trim().min(8).max(80),
  confirmed: z.literal(true),
}).strict();
const createVariantInput = z.object({
  name: z.string().trim().min(1).max(80),
  aspect: aspectSchema.optional(),
}).strict();
const applyVariantInput = z.object({
  variantId: z.string().trim().min(1).max(128),
  confirmed: z.literal(true),
}).strict();
const deleteVariantInput = applyVariantInput;

type StoryboardSpec = z.infer<typeof storyboardSpecSchema>;

export type AudioUrlImportInput = Omit<z.infer<typeof audioUrlInput>, "confirmed">;

export interface EditorWebMcpCallbackResult {
  ok: boolean;
  message: string;
  jobId?: string;
  filename?: string;
  diagnostics?: unknown;
}

export interface EditorWebMcpToolContext {
  analyzeMusic?: (assetId: string, options: { startSeconds: number; durationSeconds: number }, signal: AbortSignal) => ReturnType<typeof analyzeMusicUrl>;
  sampleVideoMoments?: (assetId: string, durationSeconds: number, signal: AbortSignal) => ReturnType<typeof sampleVideoMoments>;
  trackObject?: (aspect: AspectPreset, clipId: string, box: z.infer<typeof trackingBoxSchema>, signal: AbortSignal) => ReturnType<typeof trackVideoObject>;
  getRuntimeCapabilities?: () => RuntimeCapabilities;
  /** Always return the current state; do not pass a render-time snapshot. */
  getState: () => EditorHistoryState;
  /** Resolve the currently selected master or cutdown for delivery operations. */
  getActiveVersion?: () => VersionTimeline;
  getAssets?: () => readonly AssetRef[];
  dispatch?: (action: EditorAction) => void;
  dispatchCommand?: (command: EditorCommand) => void;
  undo?: () => void;
  redo?: () => void;
  createId?: () => string;
  selectClip?: (clipId: string) => void;
  selectText?: (overlayId: string) => void;
  selectAudio?: (trackId: string) => void;
  applyAIEditorActions?: (actions: AIEditorActions, signal: AbortSignal) => EditorWebMcpCallbackResult | Promise<EditorWebMcpCallbackResult>;
  requestExport?: (signal: AbortSignal) => EditorWebMcpCallbackResult | Promise<EditorWebMcpCallbackResult>;
  requestTimelineExport?: (format: "fcpxml" | "edl" | "fcpxml-bundle", signal: AbortSignal) => EditorWebMcpCallbackResult | Promise<EditorWebMcpCallbackResult>;
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
  /** Render paired source-only samples with the native grading renderer, without mutating the timeline. */
  captureColorComparison?: (aspect: AspectPreset, clipId: string, before: NonNullable<Clip["videoFilter"]>, after: NonNullable<Clip["videoFilter"]>, signal: AbortSignal) => Promise<ColorComparisonEvidence>;
  publishVisualReview?: (review: EditorVisualReview) => void;
  getRenderDiagnostics?: (aspect: AspectPreset) => unknown;
}

export type LicensedAudioImportInput = Omit<z.infer<typeof importLicensedAudioInput>, "confirmed">;

const MAX_SUMMARY_CHARS = 1500;
const MAX_PROJECT_CHARS = 12000;
const MAX_CONTACT_SHEET_CHARS = 1_500_000;
const MAX_COLOR_CHARS = 100_000;
const colorResult = (value: unknown, maxChars = MAX_COLOR_CHARS): string => {
  const serialized = JSON.stringify(value);
  if (serialized.length > maxChars) throw new Error("COLOR_RESPONSE_LIMIT: Preview fewer changeIds or reduce capture JPEG dimensions/quality; no review record was created");
  return serialized;
};
const json = (value: unknown, maxChars = MAX_SUMMARY_CHARS): string => {
  const serialized = JSON.stringify(value);
  return serialized.length <= maxChars ? serialized : JSON.stringify({ ok: false, error: "Response too large" });
};
const result = (message: string, extra: Record<string, unknown> = {}) => json({ ok: true, message, ...extra });
const projectResult = (value: unknown) => json(value, MAX_PROJECT_CHARS);
const stableStringify = (value: unknown): string => JSON.stringify(value, (_key, item) =>
  item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)))
    : item,
);
const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw signal.reason ?? new DOMException("Tool call aborted", "AbortError");
};
const validateRange = (startFrame: number, endFrame: number) => {
  if (endFrame <= startFrame) throw new Error("endFrame must be greater than startFrame");
};
const activeVersion = (state: EditorHistoryState, aspect?: AspectPreset) => state.present.versions[aspect ?? state.present.activeVersion];
const scrub = (value: string, maxLength = 240): string => value.replace(/(?:data|blob|javascript):[^\s"']*/gi, "[redacted-url]").slice(0, maxLength);
const bounded = <T, U>(items: readonly T[], maxItems: number, map: (item: T) => U) => ({ items: items.slice(0, maxItems).map(map), omitted: Math.max(0, items.length - maxItems) });
const sanitizeClip = (clip: Clip) => ({
  ...clip,
  ...(clip.keyframes ? {
    keyframes: Object.fromEntries(Object.entries(clip.keyframes).map(([property, points]) => [property, points?.slice(0, 25)])),
    omittedKeyframes: Object.fromEntries(Object.entries(clip.keyframes).map(([property, points]) => [property, Math.max(0, (points?.length ?? 0) - 25)])),
  } : {}),
  ...(clip.timeMapping?.kind === "speed" ? { timeMapping: {...clip.timeMapping, points:clip.timeMapping.points.slice(0,25)}, omittedSpeedPoints:Math.max(0,clip.timeMapping.points.length-25) } : {}),
});
const sanitizeText = (overlay: TextOverlay) => ({ ...overlay, text: scrub(overlay.text) });
const sanitizeAudio = (track: AudioTrack) => ({ ...track });
const sanitizeTransition = (transition: Transition) => ({ ...transition });
const sanitizeAsset = (asset: AssetRef) => ({
  assetId: scrub(asset.assetId, 128),
  kind: asset.kind,
  mimeType: scrub(asset.mimeType, 128),
  name: scrub(asset.name, 160),
  size: asset.size,
  ...(asset.mediaMetadata ? { mediaMetadata: { ...asset.mediaMetadata } } : {}),
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
const sanitizeTimeline = (version: ReturnType<typeof activeVersion>, maxItems: number, offset = 0) => ({
  aspect: version.aspect,
  tracks: bounded(ensureEditorTracks(version).slice(offset), maxItems, (track) => ({ ...track, name: scrub(track.name, 128) })),
  clips: bounded(version.clips.slice(offset), maxItems, sanitizeClip),
  textOverlays: bounded(version.textOverlays.slice(offset), maxItems, sanitizeText),
  audioTracks: bounded(version.audioTracks.slice(offset), maxItems, sanitizeAudio),
  transitions: bounded(version.transitions.slice(offset), maxItems, sanitizeTransition),
  captionCues: bounded((version.captionCues ?? []).slice(offset), maxItems, (cue) => ({ ...cue, text: scrub(cue.text) })),
  duckingRules: bounded((version.duckingRules ?? []).slice(offset), maxItems, (rule) => ({ ...rule, triggers: rule.triggers.slice(0,25), omittedTriggers: Math.max(0,rule.triggers.length-25) })),
});
const callbackResponse = (value: void | EditorWebMcpCallbackResult, fallback: string) => {
  if (value && !value.ok) return json({ ...value, ok: false, error: value.message });
  return json({ ...(value ?? {}), ok: true, message: value?.message ?? fallback });
};

type BrowserColorAsset = AssetRef & {
  file?: Blob;
  objectUrl?: string;
  colorSpace?: SourceColorAsset["colorSpace"];
  dynamicRange?: SourceColorAsset["dynamicRange"];
};

const sourceColorAssets = (assets: readonly AssetRef[]): SourceColorAsset[] =>
  assets
    .filter((asset) => asset.kind === "video" || asset.kind === "image")
    .map((asset) => {
      const browserAsset = asset as BrowserColorAsset;
      return {
        assetId: asset.assetId,
        kind: asset.kind,
        mimeType: asset.mimeType,
        ...(browserAsset.file ? { file: browserAsset.file } : {}),
        ...(browserAsset.objectUrl ? { objectUrl: browserAsset.objectUrl } : {}),
        ...(asset.externalUrl ? { externalUrl: asset.externalUrl } : {}),
        ...(asset.mediaMetadata ? { mediaMetadata: asset.mediaMetadata } : {}),
        colorSpace: browserAsset.colorSpace ?? "unknown",
        dynamicRange: browserAsset.dynamicRange ?? "unknown",
      };
    });

const hasReadableColorSource = (assets: readonly SourceColorAsset[]): boolean =>
  assets.some((asset) => Boolean(asset.file || asset.objectUrl || asset.externalUrl));

const storyboardBaseline = (
  version: ReturnType<typeof activeVersion>,
  assets: readonly AssetRef[],
) => ({
  version,
  assets: assets.map(sanitizeAsset).sort((a, b) => a.assetId.localeCompare(b.assetId)),
});

const secureToken = (): string => {
  const bytes = new Uint8Array(18);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return `storyboard-${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
};

const cloneVersion = (version: VersionTimeline): VersionTimeline =>
  JSON.parse(JSON.stringify(version)) as VersionTimeline;

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
  const objectTracks = new Map<string, { aspect: AspectPreset; revision: number; clipId: string; result: Awaited<ReturnType<typeof trackVideoObject>> }>();
  let trackingSequence = 0;
  const approvals = new Map<string, { fingerprint: string; expiresAt: number }>();
  const colorProposals = new Map<string, {
    aspect: AspectPreset;
    revision: number;
    createdAt: number;
    expiresAt: number;
    result: ColorWorkflowProposal;
    reviews: GradingReview[];
    appliedOperationId?: string;
  }>();
  const colorPreviews = new Map<string, {
    proposalId: string;
    revision: number;
    changeIds: string[];
    includesImages: boolean;
    createdAt: number;
    expiresAt: number;
  }>();
  const colorApprovals = new Map<string, {
    proposalId: string;
    previewId: string;
    aspect: AspectPreset;
    revision: number;
    changeIds: string[];
    decisions: Array<{
      changeId: string;
      decision: "improves" | "neutral" | "worse";
      reason?: string;
    }>;
    createdAt: number;
    expiresAt: number;
    consumedBy?: string;
  }>();
  const colorOperations = new Map<string, {
    operationId: string;
    proposalId: string;
    approvalId: string;
    aspect: AspectPreset;
    appliedRevision: number;
    changes: ColorWorkflowChange[];
    status: "applied" | "undone";
    undoOperationId?: string;
    undoneRevision?: number;
  }>();
  let colorProposalSequence = 0;
  let colorPreviewSequence = 0;
  let colorApprovalSequence = 0;
  const COLOR_PROPOSAL_TTL_MS = 30 * 60 * 1000;
  const COLOR_APPROVAL_TTL_MS = 10 * 60 * 1000;
  const COLOR_PREVIEW_TTL_MS = 10 * 60 * 1000;
  const requireColorProposal = (proposalId: string, revision: number) => {
    const proposal = colorProposals.get(proposalId);
    if (!proposal) throw new Error("PROPOSAL_NOT_FOUND: Color proposal not found");
    if (Date.now() >= proposal.expiresAt) throw new Error("PROPOSAL_EXPIRED: Color proposal expired; inspect and propose again");
    if (proposal.revision !== revision) throw new Error("STALE_PROPOSAL: Project changed; inspect and propose again");
    if (proposal.appliedOperationId) throw new Error("PROPOSAL_APPLIED: Color proposal was already applied");
    return proposal;
  };
  const sameChangeIds = (left: readonly string[], right: readonly string[]) => {
    if (left.length !== right.length) return false;
    const rightIds = new Set(right);
    return rightIds.size === right.length && left.every((changeId) => rightIds.has(changeId));
  };
  const requireColorPreview = (previewId: string, proposalId: string, revision: number) => {
    const preview = colorPreviews.get(previewId);
    if (!preview || preview.proposalId !== proposalId) {
      throw new Error("PREVIEW_NOT_FOUND: Preview does not authorize this proposal");
    }
    if (Date.now() >= preview.expiresAt) throw new Error("PREVIEW_EXPIRED: Preview expired; preview the candidates again");
    if (preview.revision !== revision) throw new Error("STALE_PREVIEW: Project changed; preview the candidates again");
    if (!preview.includesImages) throw new Error("VISUAL_EVIDENCE_REQUIRED: Capture successful before/after images before approval");
    return preview;
  };
  const variants = new Map<string, {
    id: string;
    name: string;
    aspect: AspectPreset;
    version: VersionTimeline;
    createdAt: string;
  }>();
  let variantSequence = 0;
  const saveVariant = (name: string, version: VersionTimeline) => {
    if (variants.size >= 12) throw new Error("Variant limit reached. Delete an older variant first.");
    const id = `variant-${Date.now().toString(36)}-${++variantSequence}`;
    const variant = {
      id,
      name,
      aspect: version.aspect,
      version: cloneVersion(version),
      createdAt: new Date().toISOString(),
    };
    variants.set(id, variant);
    return variant;
  };
  const dispatch = (action: EditorAction) => {
    if (!context.dispatch) throw new Error("Editor mutations are unavailable");
    const issues = validateEditorCommandAction(context.getState().present, action);
    if (issues.length) throw new Error(`${issues[0].code}: ${issues[0].message}`);
    const before = context.getState().present;
    context.dispatch(action);
    if (context.getState().present === before) throw new Error("ACTION_REJECTED: Editor rejected the action or it made no change");
  };
  const command = (input: { aspect: AspectPreset; operationId: string; expectedRevision: number }, action: EditorAction | EditorAction[] | (() => EditorAction | EditorAction[])) => {
    if (!context.dispatchCommand) return projectResult({ ok: false, code: "COMMANDS_UNAVAILABLE", message: "Transactional editor commands are unavailable" });
    const { expectedRevision: _revision, ...identity } = input;
    void _revision;
    const requestFingerprint = stableStringify(identity);
    // Resolve state-dependent actions only for new commands. A freeze retry may
    // reference a source clip that the original successful operation removed.
    let actions: EditorAction[] = [];
    let preflightFailure: EditorCommand["preflightFailure"];
    if (!context.getState().commandReceipts?.some((entry) => entry.operationId === input.operationId)) {
      if (input.expectedRevision === (context.getState().revision ?? 0)) {
        try {
          const prepared = typeof action === "function" ? action() : action;
          actions = Array.isArray(prepared) ? prepared : [prepared];
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invalid command";
          const separator = message.indexOf(":");
          preflightFailure = {code: separator > 0 ? message.slice(0, separator) : "INVALID_COMMAND", message: separator > 0 ? message.slice(separator + 1).trim() : message};
        }
      }
    }
    context.dispatchCommand({ type: "history/command", operationId: input.operationId, expectedRevision: input.expectedRevision, requestFingerprint, actions, preflightFailure });
    const state = context.getState();
    const receipt = state.lastCommandReceipt;
    if (!receipt || receipt.operationId !== input.operationId) return projectResult({ ok: false, code: "COMMAND_RECEIPT_MISSING", message: "Command did not return a receipt" });
    const { fingerprint: _fingerprint, ...response } = receipt;
    void _fingerprint;
    return projectResult({ ...response, currentRevision: state.revision ?? 0, aspect: input.aspect, ...(receipt.ok ? { timeline: sanitizeTimeline(activeVersion(state, input.aspect), 25) } : {}) });
  };
  const validateSourceMapping = (aspect: AspectPreset, clipId: string, mapping: TimeMapping) => {
    const clip = activeVersion(context.getState(), aspect).clips.find((item) => item.id === clipId);
    if (!clip) throw new Error("NOT_FOUND: Clip not found");
    if (clip.kind !== "video") throw new Error("UNSUPPORTED_MEDIA: Time mapping requires a video clip");
    const asset = context.getAssets?.().find((item) => item.assetId === clip.assetId);
    const sourceDurationUs = asset?.mediaMetadata?.durationUs ?? clip.sourceDurationUs ?? clip.trimEndFrame / FPS * 1e6;
    const issues = validateTimeMapping(mapping, clip.endFrame - clip.startFrame, clip.trimStartFrame, sourceDurationUs, FPS);
    if (issues.length) throw new Error(`SOURCE_OUT_OF_RANGE: ${issues.join(" ")}`);
    return { clip, sourceDurationUs };
  };
  const requireItem = (aspect: AspectPreset, itemType: string, itemId: string) => {
    const version = activeVersion(context.getState(), aspect);
    const exists = itemType === "clip" ? version.clips.some((item) => item.id === itemId) : itemType === "textOverlay" ? version.textOverlays.some((item) => item.id === itemId) : version.audioTracks.some((item) => item.id === itemId);
    if (!exists) throw new Error(`${itemType} not found`);
  };
  return [
    ...createBeatMontageTools(context, command),
    defineTool({ name: "editor_track_object", title: "Track an object in source video", description: "Analyze a top-left normalized source box using local pixel matching. Returns clip-local centers and confidence, without editing. Low confidence stops tracking; this is not semantic segmentation. Inspect the path, correct it, then attach to an image graphic.", schema: trackingStartInput, readOnly: true, execute: async (input, signal) => {
      if (!context.trackObject) throw new Error("TRACKING_UNAVAILABLE: Browser tracking is not connected.");
      const revision = context.getState().revision ?? 0;
      const result = await context.trackObject(input.aspect, input.clipId, input.box, signal);
      throwIfAborted(signal);
      if ((context.getState().revision ?? 0) !== revision) throw new Error("REVISION_CONFLICT: Project changed while tracking. Track again.");
      const trackingId = `object-track-${++trackingSequence}`;
      if (objectTracks.size >= 12) objectTracks.delete(objectTracks.keys().next().value!);
      objectTracks.set(trackingId, { aspect: input.aspect, revision, clipId: input.clipId, result });
      return colorResult({ ok: true, trackingId, revision, result });
    } }),
    defineTool({ name: "editor_correct_object_track", title: "Correct a tracked center", description: "Correct a clip-local tracking point with a source-normalized center. Does not edit the timeline or certify recovery of a lost track.", schema: trackingCorrectionInput, readOnly: false, execute: (input) => {
      const track = objectTracks.get(input.trackingId);
      if (!track || track.revision !== (context.getState().revision ?? 0)) throw new Error("STALE_TRACK: Track again against the current project.");
      const clip = activeVersion(context.getState(), track.aspect).clips.find((item) => item.id === track.clipId);
      if (!clip || input.frame >= clip.endFrame - clip.startFrame) throw new Error("INVALID_FRAME: Correction must be inside the tracked clip.");
      track.result.points = correctTrackingPoint(track.result.points, { frame: input.frame, x: input.x, y: input.y });
      return colorResult({ ok: true, trackingId: input.trackingId, result: track.result });
    } }),
    defineTool({ name: "editor_attach_object_track", title: "Attach image graphic to object track", description: "Apply a reviewed complete track to an existing image graphic as x/y keyframes in one undo step. Replaces that graphic's position animation; other channels are preserved. Lost tracks cannot be applied.", schema: trackingApplyInput, readOnly: false, execute: (input) => command(input, () => {
      const track = objectTracks.get(input.trackingId);
      if (!track || track.revision !== input.expectedRevision || track.aspect !== input.aspect) throw new Error("STALE_TRACK: Track again against the current project.");
      if (track.result.status !== "complete") throw new Error("TRACK_LOST: Use a shorter clip or a clearer box and track again.");
      const version = activeVersion(context.getState(), input.aspect);
      const sourceClip = version.clips.find((item) => item.id === track.clipId);
      const targetClip = version.clips.find((item) => item.id === input.targetClipId);
      if (!sourceClip || !targetClip) throw new Error("CLIP_NOT_FOUND: Source or graphic missing.");
      const stage = ASPECT_PRESETS[input.aspect];
      const keyframes = trackingToKeyframes({ points: track.result.points, sourceClip, targetClip, sourceWidth: track.result.sourceWidth, sourceHeight: track.result.sourceHeight, stageWidth: stage.width, stageHeight: stage.height, transitions: version.transitions });
      return { type: "set-clip-keyframes", aspect: input.aspect, clipId: targetClip.id, keyframes };
    }) }),
    defineTool({ name: "editor_set_selective_grade", title: "Set selective color regions", description: "Replace up to eight independent feathered ellipse/rectangle regions on a clip. Center and size are source-normalized; inverted masks grade outside. Uses SDR pixels and the same preview/export renderer. Empty regions clears local grading; global settings stay unchanged.", schema: selectiveGradeInput, readOnly: false, execute: (input) => command(input, () => {
      const clip = activeVersion(context.getState(), input.aspect).clips.find((item) => item.id === input.clipId);
      if (!clip) throw new Error("CLIP_NOT_FOUND");
      return { type: "update-clip", aspect: input.aspect, clipId: clip.id, patch: { videoFilter: { preset: "none", brightness: 1, contrast: 1, saturation: 1, sepia: 0, grayscale: 0, hueRotate: 0, ...clip.videoFilter, selectiveRegions: input.regions } } };
    }) }),
    defineTool({ name: "editor_set_clip_keyframes", title: "Set clip keyframes", description: "Replace clip-local animation channels. Frame controls include the exclusive end boundary; interpolation is linear or hold.", schema: keyframesInput, readOnly: false, execute: (input) => command(input, { type: "set-clip-keyframes", aspect: input.aspect, clipId: input.clipId, keyframes: input.keyframes }) }),
    defineTool({ name: "editor_upsert_caption_cues", title: "Set caption cues", description: "Atomically add or update caption cues by ID on existing caption lanes. Same-lane overlap is invalid.", schema: captionCuesInput, readOnly: false, execute: (input) => command(input, { type: "upsert-caption-cues", aspect: input.aspect, cues: input.cues }) }),
    defineTool({ name: "editor_import_captions", title: "Import captions", description: "Import plain SRT/WebVTT atomically. Starts round down and ends round up to frames; unsupported styling and collisions are errors.", schema: captionsImportInput, readOnly: false, execute: (input) => command(input, () => {
      const parsed = importCaptions({ format: input.format, content: input.content, trackId: input.trackId, idPrefix: input.operationId });
      if (!parsed.ok) throw new Error(`INVALID_CAPTIONS: ${parsed.issues.map((issue) => issue.message).join(" ")}`);
      const version = activeVersion(context.getState(), input.aspect);
      const removals: EditorAction[] = input.mode === "replace" ? (version.captionCues ?? []).filter((cue) => cue.trackId === input.trackId).map((cue) => ({ type: "remove-caption-cue", aspect: input.aspect, cueId: cue.id })) : [];
      return [...removals, { type: "upsert-caption-cues", aspect: input.aspect, cues: parsed.cues }];
    }) }),
    defineTool({ name: "editor_plan_audio_balance", title: "Plan music and narration balance", description: "Read-only preview of interval-based music ducking under selected narration. Returns a validated rule, gain envelope, warnings, and revision. This does not analyze speech or measure loudness. Review the plan before applying the same inputs with its revision.", schema: planAudioBalanceInput, readOnly: true, execute: (input) => {
      const state = context.getState();
      return projectResult({ ok: true, aspect: input.aspect, revision: state.revision ?? 0, ...planAudioBalance(activeVersion(state, input.aspect), input) });
    } }),
    defineTool({ name: "editor_apply_audio_balance", title: "Apply music and narration balance", description: "Apply a reviewed interval-based balance plan with confirmed:true and its expectedRevision. Revalidates the same music, narration, strength, and new ruleId inputs; creates one ducking rule in one undo step. Existing rule IDs are rejected. Retry with the same operationId; undo with editor_undo or remove with editor_remove_audio_ducking.", schema: applyAudioBalanceInput, readOnly: false, execute: (input) => command(input, () => {
      const { rule } = planAudioBalance(activeVersion(context.getState(), input.aspect), input);
      return { type: "set-ducking-rule", aspect: input.aspect, rule };
    }) }),
    defineTool({ name: "editor_set_audio_ducking", title: "Set audio ducking", description: "Duck a target by a negative dB attenuation during selected narration intervals. Rules combine using strongest attenuation.", schema: duckingInput, readOnly: false, execute: (input) => command(input, { type: "set-ducking-rule", aspect: input.aspect, rule: input.rule }) }),
    defineTool({ name: "editor_remove_audio_ducking", title: "Remove audio ducking", description: "Remove a ducking rule with explicit confirmation.", schema: removeDuckingInput, readOnly: false, execute: (input) => command(input, { type: "remove-ducking-rule", aspect: input.aspect, ruleId: input.ruleId }) }),
    defineTool({ name: "editor_freeze_clip_range", title: "Freeze clip interval", description: "Replace a timeline interval inside a video clip with a held source timestamp in microseconds. Duration stays fixed and held audio is muted.", schema: freezeInput, readOnly: false, execute: (input) => command(input, () => {
      const { clip, sourceDurationUs } = validateSourceMapping(input.aspect, input.clipId, { kind: "hold", sourceTimeUs: input.sourceTimeUs });
      if (input.startFrame < clip.startFrame || input.endFrame > clip.endFrame || input.endFrame <= input.startFrame) throw new Error("INVALID_INTERVAL: Freeze must be a positive interval inside the clip");
      const segmentIds = [...(input.startFrame > clip.startFrame ? [`${input.operationId}-before`] : []), `${input.operationId}-hold`, ...(input.endFrame < clip.endFrame ? [`${input.operationId}-after`] : [])];
      return { type: "freeze-clip-range", aspect: input.aspect, clipId: input.clipId, startFrame: input.startFrame, endFrame: input.endFrame, sourceTimeUs: input.sourceTimeUs, segmentIds, sourceDurationUs };
    }) }),
    defineTool({ name: "editor_set_clip_speed_ramp", title: "Set clip speed", description: "Replace positive speed controls; source time integrates the speed curve. Timeline duration is preserved and embedded audio is muted.", schema: speedRampInput, readOnly: false, execute: (input) => command(input, () => {
      const previous = activeVersion(context.getState(), input.aspect).clips.find(clip => clip.id === input.clipId)?.timeMapping;
      const mapping: TimeMapping = { kind: "speed", points: input.points, ...(previous?.kind === "speed" && previous.sourceStartTimeUs !== undefined ? {sourceStartTimeUs: previous.sourceStartTimeUs} : {}) };
      const { sourceDurationUs } = validateSourceMapping(input.aspect, input.clipId, mapping);
      return { type: "set-clip-time-mapping", aspect: input.aspect, clipId: input.clipId, mapping, sourceDurationUs };
    }) }),
    defineTool({ name: "editor_add_track", title: "Add timeline lane", description: "Create a named lane. Requires an explicit aspect, current revision, and retry-safe operation ID.", schema: addTrackInput, readOnly: false, execute: (input) => command(input, { type: "add-track", aspect: input.aspect, track: { id: input.id, kind: input.kind, name: input.name, order: 100000 } }) }),
    defineTool({ name: "editor_reorder_tracks", title: "Reorder timeline lanes", description: "Set lane order using every track ID exactly once. Earlier video lanes render above later video lanes.", schema: reorderTracksInput, readOnly: false, execute: (input) => command(input, { type: "reorder-tracks", aspect: input.aspect, trackIds: input.trackIds }) }),
    defineTool({ name: "editor_place_clip", title: "Place clip", description: "Place a clip at an absolute frame on a video lane without ripple or source trim changes.", schema: placeClipInput, readOnly: false, execute: (input) => command(input, { type: "place-clip", aspect: input.aspect, clipId: input.clipId, trackId: input.trackId, startFrame: input.startFrame }) }),
    defineTool({ name: "editor_set_clip_transform", title: "Set clip transform", description: "Set static transform: x/y in normalized canvas coordinates, raw source scale, rotation in radians, normalized anchor; opacity is 0–1.", schema: clipTransformInput, readOnly: false, execute: (input) => command(input, { type: "update-clip", aspect: input.aspect, clipId: input.clipId, patch: { transform: input.transform, ...(input.opacity !== undefined ? { opacity: input.opacity } : {}) } }) }),
    defineTool({
      name: "editor_get_capabilities",
      title: "Get editor workflow guide",
      description: "Discover the recommended Inkframe agent workflows, tool groups, safeguards, and timeline limits. Start here instead of scanning every atomic tool.",
      schema: emptyInput,
      readOnly: true,
      execute: () => projectResult({
        ok: true,
        product: "Inkframe browser-native video editor",
        objectTracking: { tools: ["editor_track_object", "editor_correct_object_track", "editor_attach_object_track"], target: "existing image graphic", limitations: "Local patch matching, not object recognition; normal speed, fixed source transform; stops on lost confidence." },
        selectiveGrading: { tool: "editor_set_selective_grade", regions: "Up to eight feathered source-space masks, independent of object tracking. SDR only." },
        singleVideoGrading: GRADING_REVIEW_PROTOCOL,
        runtime: context.getRuntimeCapabilities?.() ?? null,
        deterministicCommands: {
          revision: context.getState().revision ?? 0,
          requiredMetadata: ["aspect", "expectedRevision", "operationId"],
          idempotencyScope: "last 100 commands in this editor session",
          tools: ["editor_add_track", "editor_reorder_tracks", "editor_place_clip", "editor_set_clip_transform", "editor_set_clip_keyframes", "editor_upsert_caption_cues", "editor_import_captions", "editor_set_audio_ducking", "editor_remove_audio_ducking", "editor_apply_audio_balance", "editor_freeze_clip_range", "editor_set_clip_speed_ramp"],
          timing: { fps: FPS, intervals: "integer frames, exclusive end", placement: "absolute; no implicit ripple", sameVideoLaneOverlap: false },
          transformUnits: { position: "normalized canvas coordinates", scale: "raw source scale", rotation: "radians", anchor: "normalized source coordinates" },
          keyframes: { frameSpace: "clip-local output frames", properties: ["x", "y", "scale", "rotation", "opacity"], interpolation: ["linear", "hold"], maxPointsPerChannel: 1000 },
          captions: { formats: ["srt", "vtt"], plainTextOnly: true, startQuantization: "floor", endQuantization: "ceil", maxCuesPerBatch: 1000, maxImportCharacters: 200000, sameLaneOverlap: false },
          ducking: { attenuationDb: [-60, 0], combination: "strongest attenuation", trigger: "selected narration intervals" },
          retiming: {
            preservesTimelineDuration: true,
            videoOnly: true,
            positiveSpeedOnly: true,
            maxSpeedPoints: 1000,
            embeddedVideoAudio: "muted for every non-normal mapping, including 1x speed maps and held frames",
            sourceBounds: "validated against asset duration metadata, then retained source duration or trim bound",
            transitions: "not supported on clips with non-normal mappings; remove adjacent transitions before retiming",
            normalRestore: "requires an integral source-frame origin; use a constant 1x map to preserve a fractional origin",
          },
        },
        recommendedStart: "Use editor_plan_storyboard after importing or listing visual assets.",
        workflows: [
          {
            id: "cut-to-music",
            label: "Choose video moments and cut to uploaded music",
            steps: ["editor_list_assets", "editor_inspect_video_moments", "editor_plan_beat_montage", "editor_apply_beat_montage", "editor_capture_contact_sheet", "editor_validate_project"],
          },
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
              "editor_capture_contact_sheet",
              "editor_auto_fix_project",
              "editor_get_attribution_report",
              "editor_export_fcpxml",
              "editor_export_edl",
              "editor_export_fcpxml_bundle",
              "editor_request_export",
              "editor_get_export_status",
              "editor_get_export_artifact",
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
          {
            id: "balance-music-narration",
            label: "Preview and apply music ducking under narration",
            steps: ["editor_get_project", "editor_plan_audio_balance", "editor_apply_audio_balance"],
            guidance: "Select explicit music and narration audio/video references and a new ruleId. Review the returned envelope and warnings. Apply identical inputs with confirmed:true, expectedRevision from the plan, and a unique operationId. One editor_undo reverses the edit; editor_remove_audio_ducking removes the named rule. Interval-based ducking does not perform speech detection or loudness analysis.",
          },
        ],
        toolGroups: {
          beatMontage: ["editor_inspect_video_moments", "editor_plan_beat_montage", "editor_apply_beat_montage"],
          discover: ["editor_get_capabilities", "editor_get_state_summary", "editor_list_assets"],
          compose: ["editor_plan_storyboard", "editor_compose_storyboard", "editor_create_variant", "editor_apply_variant"],
          inspect: ["editor_validate_project", "editor_get_render_diagnostics", "editor_capture_frame", "editor_capture_contact_sheet", "editor_get_attribution_report"],
          correct: ["editor_auto_fix_project", "editor_update_text_overlay", "editor_update_clip", "editor_update_audio_track"],
          color: ["editor_color_inspect", "editor_color_propose", "editor_color_preview", "editor_color_approve", "editor_color_apply", "editor_color_undo", "editor_color_status"],
          audio: ["editor_plan_audio_balance", "editor_apply_audio_balance", "editor_remove_audio_ducking"],
          deliver: ["editor_export_fcpxml", "editor_export_edl", "editor_export_fcpxml_bundle", "editor_request_export", "editor_get_export_status", "editor_get_export_artifact", "editor_cancel_export"],
        },
        safeguards: {
          expiringOneUseStoryboardApprovalToken: true,
          confirmedDestructiveActions: true,
          rawLocalFilesNeverReturned: true,
          frameImagesRequireExplicitOptIn: true,
          boundedSanitizedOutputs: true,
        },
        limits: {
          maxDurationInFrames: MAX_DURATION_FRAMES,
          maxDurationSeconds: MAX_DURATION_FRAMES / FPS,
          maxStoryboardScenes: 12,
        },
      }),
    }),
    defineTool({ name: "editor_get_state_summary", title: "Get editor state", description: "Get a compact summary of the current editor canvas and timeline.", schema: emptyInput, readOnly: true, execute: (_input, signal) => { throwIfAborted(signal); const state = context.getState(); const version = activeVersion(state); const visibleOverlays = version.textOverlays.slice(0, 10); return json({ ok: true, revision: state.revision ?? 0, activeVersion: state.present.activeVersion, counts: { clips: version.clips.length, textOverlays: version.textOverlays.length, audioTracks: version.audioTracks.length, transitions: version.transitions.length }, textOverlays: visibleOverlays.map(({ id, text, startFrame, endFrame, stylePreset }) => ({ id, text: scrub(text, 120), startFrame, endFrame, stylePreset })), omittedTextOverlays: Math.max(0, version.textOverlays.length - visibleOverlays.length) }); } }),
    defineTool({ name: "editor_get_project", title: "Inspect editor project", description: "Inspect bounded, sanitized project timelines. Follow nextOffset to read every item; maxItems may shrink to fit the response. Keep aspect and revision fixed across pages.", schema: projectInput, readOnly: true, execute: (input) => {
      const state = context.getState();
      let maxItems = input.maxItems ?? 10;
      const aspects = input.aspect ? [input.aspect] : (["reel_9_16", "widescreen_16_9"] as const);
      const assets = context.getAssets?.() ?? [];
      const totalItems = Math.max(assets.length, ...aspects.flatMap((aspect) => {
        const version = state.present.versions[aspect];
        return [ensureEditorTracks(version).length, version.clips.length, version.textOverlays.length, version.audioTracks.length, version.transitions.length, version.captionCues?.length ?? 0, version.duckingRules?.length ?? 0];
      }));
      for (;;) {
        const versions = Object.fromEntries(aspects.map((aspect) => [aspect, sanitizeTimeline(state.present.versions[aspect], maxItems, input.offset)]));
        const response = JSON.stringify({ ok: true, revision: state.revision ?? 0, activeVersion: state.present.activeVersion, offset: input.offset, maxItems, nextOffset: input.offset + maxItems < totalItems ? input.offset + maxItems : null, versions, assets: bounded(assets.slice(input.offset), maxItems, sanitizeAsset) });
        if (response.length <= MAX_PROJECT_CHARS) return response;
        if (maxItems === 1) return projectResult({ ok: false, code: "PROJECT_ITEM_TOO_LARGE", message: "Request a single aspect to reduce the page size", offset: input.offset });
        maxItems = Math.max(1, Math.floor(maxItems / 2));
      }
    } }),
    defineTool({ name: "editor_validate_project", title: "Validate editor project", description: "Check export readiness, missing media, unsafe text, timeline gaps, overflow risk, and transition integrity.", schema: validateProjectInput, readOnly: true, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; const report = validateEditorVersion(activeVersion(context.getState(), aspect), context.getAssets?.() ?? []); return projectResult({ ok: true, report }); } }),
    defineTool({ name: "editor_get_render_diagnostics", title: "Get render diagnostics", description: "Inspect Elah adapter diagnostics and browser encoding capability alongside project validation.", schema: renderDiagnosticsInput, readOnly: true, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; const validation = validateEditorVersion(activeVersion(context.getState(), aspect), context.getAssets?.() ?? []); const runtime = context.getRenderDiagnostics?.(aspect) ?? null; return projectResult({ ok: true, aspect, validation, runtime }); } }),
    defineTool({
      name: "editor_color_inspect",
      title: "Inspect color consistency",
      description: "Sample browser-readable source frames for exposure, white-balance, saturation, palette, and lighting drift. Falls back deterministically to clip filter metadata when source pixels are unavailable.",
      schema: colorInspectInput,
      readOnly: true,
      execute: async (input, signal) => {
        const state = context.getState();
        const revision = state.revision ?? 0;
        const aspect = input.aspect ?? state.present.activeVersion;
        const version = activeVersion(state, aspect);
        const assets = sourceColorAssets(context.getAssets?.() ?? []);
        const inspection = hasReadableColorSource(assets)
          ? await inspectColorConsistencyFromSources({ version, assets, clipIds: input.clipIds, signal })
          : inspectColorConsistency(version, input.clipIds);
        const currentRevision = context.getState().revision ?? 0;
        if (currentRevision !== revision) throw new Error("REVISION_CONFLICT: Project changed during color analysis; inspect again");
        return projectResult({ ok: true, revision, inspection });
      },
    }),
    defineTool({
      name: "editor_color_propose",
      title: "Propose color corrections",
      description: "Propose per-shot videoFilter candidates. A single-video candidate requires three independent review agents: colorist, technical reviewer, visual critic. Delegate all three, preview with includeImages:true, submit their feedback via editor_color_submit_review, and revise until all judge improvement. If delegation is unavailable, leave unapproved. Never simulate independent reviewers.",
      schema: colorProposeInput,
      readOnly: true,
      execute: async (input, signal) => {
        const state = context.getState();
        const revision = state.revision ?? 0;
        const aspect = input.aspect ?? state.present.activeVersion;
        const version = activeVersion(state, aspect);
        const assets = sourceColorAssets(context.getAssets?.() ?? []);
        const result: ColorWorkflowProposal = input.candidates
          ? { candidateOnly: true, requiresVisualReview: true, inspection: inspectColorConsistency(version, input.candidates.map((candidate) => candidate.clipId)), changes: [] }
          : hasReadableColorSource(assets)
          ? await proposeShotGradesFromSources({ version, assets, clipIds: input.clipIds, signal, strength: input.strength, creativeIntent: input.creativeIntent === "filmic" ? "filmic" : "natural" })
          : proposeColorCorrections(version, input.findingIds, input.clipIds);
        if (input.candidates) {
          if (input.findingIds?.length) throw new Error("AMBIGUOUS_CANDIDATES: findingIds cannot be combined with explicit candidates");
          if (new Set(input.candidates.map((candidate) => candidate.clipId)).size !== input.candidates.length) throw new Error("DUPLICATE_CANDIDATE: Supply one candidate per clip");
          result.changes = input.candidates.map((candidate): ColorWorkflowChange => {
            const clip = version.clips.find((item) => item.id === candidate.clipId);
            if (!clip || (clip.kind !== "video" && clip.kind !== "image")) throw new Error("CLIP_NOT_FOUND: Candidate must reference a visual clip in the proposal aspect");
            if (input.clipIds?.length && !input.clipIds.includes(clip.id)) throw new Error("CANDIDATE_SCOPE_MISMATCH: Candidate is outside clipIds");
            return {
              changeId: `color-change-${clip.id}`, candidate: true, targetType: "clip", targetId: clip.id,
              reason: candidate.rationale,
              before: { videoFilter: { preset: "none", brightness: 1, contrast: 1, saturation: 1, sepia: 0, grayscale: 0, hueRotate: 0, ...clip.videoFilter } },
              after: { videoFilter: candidate.videoFilter }, reversible: true, risk: "medium",
            };
          });
        }
        const omittedChanges = Math.max(0, result.changes.length - 12);
        result.changes = result.changes.slice(0, 12);
        throwIfAborted(signal);
        const currentRevision = context.getState().revision ?? 0;
        if (currentRevision !== revision) throw new Error("REVISION_CONFLICT: Project changed during color analysis; propose again");
        const proposalId = `color-proposal-${Date.now().toString(36)}-${++colorProposalSequence}`;
        const createdAt = Date.now();
        const response = colorResult({ ok: true, proposalId, revision, aspect, reviewProtocol: result.changes.length === 1 ? GRADING_REVIEW_PROTOCOL : undefined, creativeIntent: input.creativeIntent, omittedChanges, expiresAt: new Date(createdAt + COLOR_PROPOSAL_TTL_MS).toISOString(), candidateOnly: true, requiresPreview: true, requiresApproval: true, proposal: {
          ...result, inspection: { ...result.inspection,
            findings: result.inspection.findings.slice(0, 24).map((finding) => ({ ...finding, message: scrub(finding.message, 500) })),
            omittedFindings: Math.max(0, result.inspection.findings.length - 24),
            warnings: [...new Set(result.inspection.warnings)].slice(0, 8).map((warning) => scrub(warning, 500)),
          },
        } });
        colorProposals.set(proposalId, { aspect, revision, createdAt, expiresAt: createdAt + COLOR_PROPOSAL_TTL_MS, result, reviews: [] });
        return response;
      },
    }),
    defineTool({
      name: "editor_color_preview",
      title: "Preview color corrections",
      description: "Preview up to four candidates per image batch using includeImages:true. Returns paired before/after source-only frames rendered with native grading, not the whole composition. Metadata-only previews cannot authorize approval. Classify every evidenced candidate as improves, neutral, or worse.",
      schema: colorPreviewInput,
      readOnly: true,
      execute: async (input, signal) => {
        const state = context.getState();
        const revision = state.revision ?? 0;
        const proposal = requireColorProposal(input.proposalId, revision);
        const version = activeVersion(state, proposal.aspect);
        const preview = previewColorCorrections(version, proposal.result, input.targetIds, input.changeIds);
        if (!preview.changes.length) throw new Error("EMPTY_PREVIEW: The proposal has no candidates in this preview scope");
        if (input.includeImages && preview.changes.length > 4) throw new Error("PREVIEW_BATCH_LIMIT: Request at most four changeIds with includeImages:true");
        if (input.includeImages && !context.captureColorComparison) throw new Error("PREVIEW_UNAVAILABLE: Paired source-frame color capture is unavailable");
        const evidence: ColorComparisonEvidence[] = [];
        if (input.includeImages && context.captureColorComparison) {
          for (const change of preview.changes) {
            throwIfAborted(signal);
            const clip = version.clips.find((item) => item.id === change.targetId)!;
            const comparison = await context.captureColorComparison(proposal.aspect, change.targetId, change.before.videoFilter, change.after.videoFilter, signal);
            throwIfAborted(signal);
            const required = Math.min(3, clip.endFrame - clip.startFrame);
            const validCapture = (capture: EditorFrameCapture, frame: number) =>
              capture && capture.frame === frame && Number.isFinite(capture.width) && capture.width > 0 && Number.isFinite(capture.height) && capture.height > 0 && !capture.imageError && capture.mimeType === "image/jpeg" && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(capture.dataUrl ?? "");
            const samples = comparison.samples.filter((sample) =>
              Number.isInteger(sample.frame) && sample.frame >= clip.startFrame && sample.frame < clip.endFrame && Number.isFinite(sample.sourceTimeSeconds) && sample.sourceTimeSeconds >= 0 &&
              validCapture(sample.before, sample.frame) && validCapture(sample.after, sample.frame) && sample.before.width === sample.after.width && sample.before.height === sample.after.height,
            ).filter((sample, index, samples) => samples.findIndex((other) => other.frame === sample.frame) === index).slice(0, required);
            if (comparison.clipId !== clip.id || required < 1 || samples.length < required) throw new Error("VISUAL_EVIDENCE_FAILED: Every candidate needs three successful distinct paired frames (or every frame of a shorter clip)");
            evidence.push({ ...comparison, samples });
          }
        }
        throwIfAborted(signal);
        requireColorProposal(input.proposalId, context.getState().revision ?? 0);
        const previewId = `color-preview-${Date.now().toString(36)}-${++colorPreviewSequence}`;
        const createdAt = Date.now();
        const response = colorResult({ ok: true, previewId, proposalId: input.proposalId, revision, aspect: proposal.aspect, reviewedChangeIds: preview.changeIds, requiresPerChangeDecision: true, visualEvidenceAvailable: input.includeImages, evidenceScope: "source-only", expiresAt: new Date(createdAt + COLOR_PREVIEW_TTL_MS).toISOString(), preview: { ...preview, representativeFrames: evidence.flatMap((comparison) => comparison.samples.map((sample) => ({ clipId: comparison.clipId, frame: sample.frame }))), warnings: ["Compare each paired source-only sample; composition, overlays, and transitions are not included.", "Only successful image previews can authorize per-change approval."] }, evidence }, input.includeImages ? MAX_CONTACT_SHEET_CHARS : MAX_COLOR_CHARS);
        colorPreviews.set(previewId, {
          proposalId: input.proposalId,
          revision,
          changeIds: preview.changeIds,
          includesImages: input.includeImages,
          createdAt,
          expiresAt: createdAt + COLOR_PREVIEW_TTL_MS,
        });
        return response;
      },
    }),
    defineTool({
      name: "editor_color_submit_review",
      title: "Submit independent grading review",
      description: "Record one delegated colorist, technical, or critic review of an exact single-video image preview. Supply the actual independent agent ID and its feedback. Three distinct agents must judge improves before approval. A revised candidate needs fresh images and reviews.",
      schema: gradingReviewSchema,
      readOnly: false,
      execute: (input) => {
        const revision = context.getState().revision ?? 0;
        const proposal = requireColorProposal(input.proposalId, revision);
        requireColorPreview(input.previewId, input.proposalId, revision);
        if (proposal.result.changes.length !== 1) throw new Error("SINGLE_VIDEO_REQUIRED: Propose exactly one clip for the three-persona workflow.");
        if (proposal.reviews.some((review) => review.previewId === input.previewId && review.persona !== input.persona && review.reviewerId === input.reviewerId)) throw new Error("INDEPENDENT_REVIEWERS_REQUIRED: Each persona needs a distinct agent ID.");
        proposal.reviews = proposal.reviews.filter((review) => !(review.previewId === input.previewId && review.persona === input.persona));
        proposal.reviews.push(input);
        // New feedback invalidates any approval previously issued for this proposal.
        for (const [id, approval] of colorApprovals) if (approval.proposalId === input.proposalId && !approval.consumedBy) colorApprovals.delete(id);
        let ready = false;
        try { requireThreeReviews(proposal.reviews, input.previewId); ready = true; } catch { /* Feedback remains available for revision. */ }
        return colorResult({ ok: true, readyForApproval: ready, reviews: proposal.reviews.filter((review) => review.previewId === input.previewId), nextAction: ready ? "Seek final confirmation and call editor_color_approve." : "Collect missing reviews or revise the candidate using reviewer feedback. Stop after three rounds or stalled progress." });
      },
    }),
    defineTool({
      name: "editor_color_approve",
      title: "Approve color corrections",
      description: "Record a visual decision for every candidate in an exact preview. Only candidates judged improves receive one-use, revision-bound approval; neutral and worse candidates cannot be applied.",
      schema: colorApproveInput,
      readOnly: true,
      execute: (input) => {
        const state = context.getState();
        const revision = state.revision ?? 0;
        const proposal = requireColorProposal(input.proposalId, revision);
        const preview = requireColorPreview(input.previewId, input.proposalId, revision);
        if (proposal.result.changes.length === 1) requireThreeReviews(proposal.reviews, input.previewId);
        const decisionIds = input.decisions.map((decision) => decision.changeId);
        if (new Set(decisionIds).size !== decisionIds.length) {
          throw new Error("DUPLICATE_VISUAL_DECISION: Each previewed candidate must have exactly one visual decision");
        }
        if (!sameChangeIds(preview.changeIds, decisionIds)) {
          throw new Error("VISUAL_DECISIONS_INCOMPLETE: Decisions must exactly match every change ID in the preview");
        }
        const changeIds = input.decisions
          .filter((decision) => decision.decision === "improves")
          .map((decision) => decision.changeId);
        if (!changeIds.length) {
          throw new Error("EMPTY_APPROVAL: No previewed candidates were judged to improve the footage");
        }
        if (input.changeIds && !sameChangeIds(input.changeIds, changeIds)) {
          throw new Error("APPROVAL_SCOPE_MISMATCH: changeIds must exactly match candidates judged improves");
        }
        const changes = selectColorChanges(proposal.result, changeIds);
        const approvalId = `color-approval-${Date.now().toString(36)}-${++colorApprovalSequence}`;
        const createdAt = Date.now();
        const decisions = input.decisions.map((decision) => ({
          changeId: decision.changeId,
          decision: decision.decision,
          ...(decision.reason === undefined ? {} : { reason: decision.reason }),
        }));
        colorApprovals.set(approvalId, { proposalId: input.proposalId, previewId: input.previewId, aspect: proposal.aspect, revision, changeIds, decisions, createdAt, expiresAt: createdAt + COLOR_APPROVAL_TTL_MS });
        return projectResult({ ok: true, approvalId, proposalId: input.proposalId, previewId: input.previewId, revision, aspect: proposal.aspect, approvedChangeIds: changeIds, rejectedChangeIds: decisions.filter((decision) => decision.decision !== "improves").map((decision) => decision.changeId), visualDecisions: decisions, expiresAt: new Date(createdAt + COLOR_APPROVAL_TTL_MS).toISOString(), oneUse: true });
      },
    }),
    defineTool({
      name: "editor_color_apply",
      title: "Apply approved color corrections",
      description: "Atomically apply only exact, previewed, revision-bound color changes explicitly judged improves and authorized by a one-use approval.",
      schema: colorApplyInput,
      readOnly: false,
      execute: (input) => {
        const existing = colorOperations.get(input.operationId);
        if (existing) {
          if (existing.proposalId !== input.proposalId || existing.approvalId !== input.approvalId) throw new Error("OPERATION_ID_CONFLICT: Operation ID was already used for another color application");
          return projectResult({ ok: true, operationId: existing.operationId, proposalId: existing.proposalId, approvalId: existing.approvalId, aspect: existing.aspect, appliedChangeIds: existing.changes.map((change) => change.changeId), revision: existing.appliedRevision, undoAvailable: existing.status === "applied", idempotent: true });
        }
        if (!context.dispatchCommand) return projectResult({ ok: false, code: "COMMANDS_UNAVAILABLE", message: "Transactional editor commands are unavailable" });
        const state = context.getState();
        const revision = state.revision ?? 0;
        if (input.expectedRevision !== revision) return projectResult({ ok: false, code: "REVISION_CONFLICT", message: "Project changed; inspect and propose again", currentRevision: revision });
        const proposal = requireColorProposal(input.proposalId, revision);
        const approval = colorApprovals.get(input.approvalId);
        if (!approval || approval.proposalId !== input.proposalId) throw new Error("APPROVAL_NOT_FOUND: Approval does not authorize this proposal");
        if (approval.consumedBy) throw new Error("APPROVAL_CONSUMED: Approval was already used");
        if (Date.now() >= approval.expiresAt) throw new Error("APPROVAL_EXPIRED: Approval expired; approve the proposal again");
        if (approval.revision !== revision || approval.aspect !== proposal.aspect) throw new Error("APPROVAL_INVALIDATED: Project changed after approval");
        const preview = requireColorPreview(approval.previewId, input.proposalId, revision);
        if (proposal.result.changes.length === 1) requireThreeReviews(proposal.reviews, approval.previewId);
        if (!sameChangeIds(preview.changeIds, approval.decisions.map((decision) => decision.changeId))) {
          throw new Error("PREVIEW_SCOPE_MISMATCH: Approval decisions no longer match the exact preview record");
        }
        const visuallyImprovedIds = approval.decisions
          .filter((decision) => decision.decision === "improves")
          .map((decision) => decision.changeId);
        if (!sameChangeIds(approval.changeIds, visuallyImprovedIds)) {
          throw new Error("VISUAL_APPROVAL_INVALID: Neutral or worse candidates cannot be applied");
        }
        const changes = selectColorChanges(proposal.result, approval.changeIds);
        const actions: EditorAction[] = changes.map((change) => ({ type: "update-clip", aspect: proposal.aspect, clipId: change.targetId, patch: { videoFilter: change.after.videoFilter } }));
        context.dispatchCommand({ type: "history/command", operationId: input.operationId, expectedRevision: revision, requestFingerprint: stableStringify({ kind: "color-apply", proposalId: input.proposalId, approvalId: input.approvalId, changeIds: approval.changeIds }), actions });
        const next = context.getState();
        const receipt = next.lastCommandReceipt;
        if (!receipt || receipt.operationId !== input.operationId) return projectResult({ ok: false, code: "COMMAND_RECEIPT_MISSING", message: "Color application did not return a command receipt" });
        if (!receipt.ok) return projectResult({ ok: false, code: receipt.code ?? "COLOR_APPLY_FAILED", message: receipt.message, currentRevision: next.revision ?? revision });
        const operation = { operationId: input.operationId, proposalId: input.proposalId, approvalId: input.approvalId, aspect: proposal.aspect, appliedRevision: next.revision ?? receipt.revision, changes, status: "applied" as const };
        colorOperations.set(input.operationId, operation);
        approval.consumedBy = input.operationId;
        proposal.appliedOperationId = input.operationId;
        return projectResult({ ok: true, operationId: input.operationId, proposalId: input.proposalId, approvalId: input.approvalId, aspect: proposal.aspect, appliedChangeIds: changes.map((change) => change.changeId), skippedChangeIds: [], revision: operation.appliedRevision, undoAvailable: true, inverseData: changes.map((change) => ({ changeId: change.changeId, targetId: change.targetId, restore: change.before })) });
      },
    }),
    defineTool({
      name: "editor_color_undo",
      title: "Undo color operation",
      description: "Atomically restore the filters captured by a color operation. Only the latest unchanged color operation can be undone.",
      schema: colorUndoInput,
      readOnly: false,
      execute: (input) => {
        const operation = colorOperations.get(input.operationId);
        if (!operation) throw new Error("OPERATION_NOT_FOUND: Color operation not found");
        if (operation.status === "undone") {
          if (operation.undoOperationId !== input.undoOperationId) throw new Error("UNDO_OPERATION_CONFLICT: Color operation was undone with another operation ID");
          return projectResult({ ok: true, operationId: input.undoOperationId, undoneOperationId: input.operationId, restoredChangeIds: operation.changes.map((change) => change.changeId), revision: operation.undoneRevision, idempotent: true });
        }
        if (!context.dispatchCommand) return projectResult({ ok: false, code: "COMMANDS_UNAVAILABLE", message: "Transactional editor commands are unavailable" });
        const revision = context.getState().revision ?? 0;
        if (input.expectedRevision !== revision || operation.appliedRevision !== revision) return projectResult({ ok: false, code: "REVISION_CONFLICT", message: "The project changed after this color operation; automatic color undo is no longer safe", currentRevision: revision });
        const actions: EditorAction[] = operation.changes.map((change) => ({ type: "update-clip", aspect: operation.aspect, clipId: change.targetId, patch: { videoFilter: change.before.videoFilter } }));
        context.dispatchCommand({ type: "history/command", operationId: input.undoOperationId, expectedRevision: revision, requestFingerprint: stableStringify({ kind: "color-undo", operationId: input.operationId, changeIds: operation.changes.map((change) => change.changeId) }), actions });
        const next = context.getState();
        const receipt = next.lastCommandReceipt;
        if (!receipt || receipt.operationId !== input.undoOperationId) return projectResult({ ok: false, code: "COMMAND_RECEIPT_MISSING", message: "Color undo did not return a command receipt" });
        if (!receipt.ok) return projectResult({ ok: false, code: receipt.code ?? "COLOR_UNDO_FAILED", message: receipt.message, currentRevision: next.revision ?? revision });
        operation.status = "undone";
        operation.undoOperationId = input.undoOperationId;
        operation.undoneRevision = next.revision ?? receipt.revision;
        return projectResult({ ok: true, operationId: input.undoOperationId, undoneOperationId: input.operationId, restoredChangeIds: operation.changes.map((change) => change.changeId), revision: operation.undoneRevision });
      },
    }),
    defineTool({
      name: "editor_color_status",
      title: "Get color workflow status",
      description: "Check whether color proposals, previews, approvals, and operations remain valid at the current project revision.",
      schema: colorStatusInput,
      readOnly: true,
      execute: (input) => {
        const revision = context.getState().revision ?? 0;
        const now = Date.now();
        const proposal = input.proposalId ? colorProposals.get(input.proposalId) : undefined;
        const preview = input.previewId ? colorPreviews.get(input.previewId) : undefined;
        const approval = input.approvalId ? colorApprovals.get(input.approvalId) : undefined;
        const operation = input.operationId ? colorOperations.get(input.operationId) : undefined;
        return projectResult({
          ok: true,
          projectRevision: revision,
          ...(proposal ? { reviews: proposal.reviews } : {}),
          ...(input.proposalId ? { proposal: !proposal ? { status: "not-found" } : { status: proposal.appliedOperationId ? "applied" : now >= proposal.expiresAt ? "expired" : proposal.revision !== revision ? "stale" : "valid", proposalId: input.proposalId, revision: proposal.revision, appliedOperationId: proposal.appliedOperationId } } : {}),
          ...(input.previewId ? { preview: !preview ? { status: "not-found" } : { status: now >= preview.expiresAt ? "expired" : preview.revision !== revision ? "stale" : "ready", previewId: input.previewId, proposalId: preview.proposalId, reviewedChangeIds: preview.changeIds, includesImages: preview.includesImages, requiresPerChangeDecision: true } } : {}),
          ...(input.approvalId ? { approval: !approval ? { status: "not-found" } : { status: approval.consumedBy ? "consumed" : now >= approval.expiresAt ? "expired" : approval.revision !== revision ? "invalidated" : "valid", approvalId: input.approvalId, proposalId: approval.proposalId, previewId: approval.previewId, approvedChangeIds: approval.changeIds, visualDecisions: approval.decisions, consumedBy: approval.consumedBy } } : {}),
          ...(input.operationId ? { operation: !operation ? { status: "not-found", undoAvailable: false } : { status: operation.status, operationId: operation.operationId, proposalId: operation.proposalId, revision: operation.status === "applied" ? operation.appliedRevision : operation.undoneRevision, undoAvailable: operation.status === "applied" && operation.appliedRevision === revision } } : {}),
        });
      },
    }),
    defineTool({ name: "editor_capture_frame", title: "Capture preview frame", description: "Seek the active Elah preview, report active timeline items, and optionally return a reduced JPEG data URL without changing project state.", schema: captureFrameInput, readOnly: true, execute: async (input, signal) => { const activeAspect = context.getState().present.activeVersion; const aspect = input.aspect ?? activeAspect; if (aspect !== activeAspect) throw new Error(`Frame capture is read-only. Switch to ${aspect} with editor_switch_canvas first.`); const version = activeVersion(context.getState(), aspect); const duration = Math.max(1, getVersionRenderDurationInFrames(version)); if (input.frame >= duration) throw new Error(`Frame must be below the ${duration} frame timeline duration`); if (!context.captureFrame) throw new Error("Frame capture is unavailable"); const capture = await context.captureFrame(input.frame, input.includeImage, signal); return json({ ok: true, inspection: inspectEditorFrame(version, input.frame), capture }, input.includeImage ? 450000 : MAX_PROJECT_CHARS); } }),
    defineTool({
      name: "editor_capture_contact_sheet",
      title: "Capture visual QA contact sheet",
      description: "Capture representative active-canvas frames, inspect timeline contents and contrast, and publish a visible in-editor contact sheet for human review.",
      schema: captureContactSheetInput,
      readOnly: true,
      execute: async (input, signal) => {
        const activeAspect = context.getState().present.activeVersion;
        const aspect = input.aspect ?? activeAspect;
        if (aspect !== activeAspect) throw new Error(`Contact-sheet capture is read-only. Switch to ${aspect} with editor_switch_canvas first.`);
        if (!context.captureFrame) throw new Error("Frame capture is unavailable");
        const version = activeVersion(context.getState(), aspect);
        const duration = Math.max(1, getVersionRenderDurationInFrames(version));
        const requestedFrames = input.frames ?? [0, 0.25, 0.5, 0.75, 1].map((ratio) =>
          Math.min(duration - 1, Math.round((duration - 1) * ratio)),
        );
        const frames = [...new Set(requestedFrames)].sort((a, b) => a - b);
        if (frames.some((frame) => frame >= duration)) {
          throw new Error(`Every frame must be below the ${duration} frame timeline duration`);
        }
        const captures: EditorFrameCapture[] = [];
        const inspections = [];
        for (const frame of frames) {
          throwIfAborted(signal);
          captures.push(await context.captureFrame(frame, input.includeImages, signal));
          inspections.push(inspectEditorFrame(version, frame));
        }
        const review: EditorVisualReview = {
          id: `review-${Date.now().toString(36)}`,
          aspect,
          createdAt: new Date().toISOString(),
          captures,
          summary: {
            framesCaptured: captures.length,
            failedContrastChecks: captures.flatMap((capture) => capture.contrastChecks).filter((check) => !check.passes).length,
            imageFailures: captures.filter((capture) => Boolean(capture.imageError)).length,
          },
        };
        context.publishVisualReview?.(review);
        return json({
          ok: true,
          review,
          inspections,
          validation: validateEditorVersion(version, context.getAssets?.() ?? []),
          nextAction: review.summary.failedContrastChecks > 0
            ? "Run editor_auto_fix_project for a failing frame, then capture a new contact sheet."
            : "Review the visible contact sheet, then verify attribution and export.",
        }, input.includeImages ? MAX_CONTACT_SHEET_CHARS : MAX_PROJECT_CHARS);
      },
    }),
    defineTool({ name: "editor_get_export_status", title: "Get export status", description: "Read browser render progress, recovery guidance, and metadata for the latest exported MP4.", schema: emptyInput, readOnly: true, execute: () => { const exportState = context.getExportState?.() ?? { status: "idle", progress: 0, artifact: null }; return projectResult({ ok: true, export: exportState, nextAction: exportState.status === "rendering" ? "Poll editor_get_export_status until completed or failed." : exportState.status === "completed" ? "Verify artifact bytes, duration, codecs, and play the downloaded MP4." : exportState.status === "failed" ? "Read export.message, run editor_get_render_diagnostics, resolve the failure, then request export again." : "Validate and inspect the project before requesting export." }); } }),
    defineTool({ name: "editor_get_export_artifact", title: "Get playable export artifact", description: "Return the retained page-scoped MP4 Blob URL, integrity metadata, and browser playback verification for the latest completed export.", schema: emptyInput, readOnly: true, execute: () => { const state = context.getExportState?.(); const artifact = state?.artifact; if (!artifact || state.status !== "completed") throw new Error("No completed export artifact is retained in this editor session."); return projectResult({ ok: true, artifact, nextAction: artifact.verification.playable ? "Open artifact.objectUrl to play the MP4, or download it with artifact.filename." : "Review artifact.verification.error and run editor_get_render_diagnostics before exporting again." }); } }),
    defineTool({ name: "editor_list_style_presets", title: "List text styles", description: "List text styles with native Elah preview and export parity.", schema: emptyInput, readOnly: true, execute: () => json({ ok: true, presets: [{ id: "classic", label: "Classic" }] }) }),
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
    defineTool({ name: "editor_search_stock_videos", title: "Search stock videos", description: "Search sanitized Pexels video metadata for the requested canvas.", schema: searchStockInput, readOnly: true, execute: async (input, signal) => { if (!context.searchStockVideos) throw new Error("Stock search is unavailable"); const aspect = input.aspect ?? context.getState().present.activeVersion; const response = await context.searchStockVideos(input.query, aspect, signal) as PexelsVideoSearchResult; return projectResult({ ok: true, aspect, result: sanitizeStockSearch(response) }); } }),
    defineTool({ name: "editor_import_stock_video", title: "Import stock video", description: "Download a selected Pexels video into the browser and append it to both canvas timelines.", schema: importStockInput, readOnly: false, execute: async (input, signal) => { if (!context.importStockVideo) throw new Error("Stock import is unavailable"); const aspect = input.aspect ?? context.getState().present.activeVersion; return callbackResponse(await context.importStockVideo(input.query, input.videoId, aspect, signal), "Stock video imported"); } }),
    defineTool({ name: "editor_search_stock_photos", title: "Search stock photos", description: "Search sanitized Pexels photo metadata for the requested canvas.", schema: searchStockInput, readOnly: true, execute: async (input, signal) => { if (!context.searchStockPhotos) throw new Error("Stock photo search is unavailable"); const aspect = input.aspect ?? context.getState().present.activeVersion; const response = await context.searchStockPhotos(input.query, aspect, signal) as PexelsPhotoSearchResult; return projectResult({ ok: true, aspect, result: sanitizePhotoSearch(response) }); } }),
    defineTool({ name: "editor_import_stock_photo", title: "Import stock photo", description: "Download a selected Pexels photo into the browser and append it to both canvas timelines.", schema: importStockPhotoInput, readOnly: false, execute: async (input, signal) => { if (!context.importStockPhoto) throw new Error("Stock photo import is unavailable"); const aspect = input.aspect ?? context.getState().present.activeVersion; return callbackResponse(await context.importStockPhoto(input.query, input.photoId, aspect, signal), "Stock photo imported"); } }),
    defineTool({ name: "editor_search_licensed_music", title: "Search licensed music", description: "Search downloadable CC0/CC BY/CC BY-SA music from Freesound with source and license metadata.", schema: searchLicensedAudioInput, readOnly: true, execute: async (input, signal) => { if (!context.searchLicensedMusic) throw new Error("Licensed music search is unavailable"); return projectResult({ ok: true, result: await context.searchLicensedMusic(input.query, signal) }); } }),
    defineTool({ name: "editor_import_licensed_music", title: "Import licensed music", description: "Import a selected Freesound track into this browser and retain its source, creator, and license. Requires confirmation.", schema: importLicensedAudioInput, readOnly: false, execute: async (input, signal) => { if (!context.importLicensedMusic) throw new Error("Licensed music import is unavailable"); const { confirmed: _confirmed, ...request } = input; void _confirmed; return callbackResponse(await context.importLicensedMusic(request, signal), "Licensed music imported"); } }),
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
        const fingerprint = JSON.stringify({
          spec: approvedSpec,
          baseline: storyboardBaseline(current, assets),
        });
        const approvalToken = secureToken();
        const expiresAt = Date.now() + 10 * 60_000;
        for (const [token, approval] of approvals) {
          if (approval.expiresAt <= Date.now()) approvals.delete(token);
        }
        approvals.set(approvalToken, { fingerprint, expiresAt });
        return projectResult({
          ok: true,
          message: "Storyboard plan is valid and ready for human approval.",
          approvalToken,
          requiresConfirmation: true,
          aspect,
          effects: {
            replacesVisualTimeline: !input.variantName,
            savesIsolatedVariant: Boolean(input.variantName),
            preservesAudio: input.preserveAudio,
            scenes: input.scenes.length,
            transitions: preview.version.transitions.length,
          },
          sceneTimings: preview.sceneTimings,
          validation: preview.validation,
          approvedSpec,
          approvalTokenExpiresAt: new Date(expiresAt).toISOString(),
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
        const approval = approvals.get(approvalToken);
        const fingerprint = JSON.stringify({
          spec: approvedSpec,
          baseline: storyboardBaseline(current, assets),
        });
        if (!approval || approval.expiresAt <= Date.now() || approval.fingerprint !== fingerprint) {
          approvals.delete(approvalToken);
          throw new Error(
            "approvalToken does not match this storyboard, has expired, or was already used. Run editor_plan_storyboard again and obtain approval for the exact returned plan.",
          );
        }
        approvals.delete(approvalToken);
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
        const variant = input.variantName
          ? saveVariant(input.variantName, composed.version)
          : null;
        if (!variant) {
          dispatch({ type: "replace-version", aspect, version: composed.version });
          if (state.present.activeVersion !== aspect) {
            dispatch({ type: "switch-aspect", aspect });
          }
          if (composed.version.textOverlays[0]) {
            context.selectText?.(composed.version.textOverlays[0].id);
          }
        }
        return projectResult({
          ok: true,
          message: variant
            ? `Composed ${input.scenes.length} approved scenes as isolated variant ${variant.name}.`
            : `Composed ${input.scenes.length} approved Elah-native scenes.`,
          aspect,
          approvalConsumed: true,
          variant: variant ? { id: variant.id, name: variant.name, aspect: variant.aspect, createdAt: variant.createdAt } : null,
          changed: {
            clips: composed.version.clips.map((clip) => clip.id),
            textOverlays: composed.version.textOverlays.map((overlay) => overlay.id),
            transitions: composed.version.transitions.map((transition) => transition.id),
          },
          counts: composed.validation.counts,
          durationInFrames: composed.validation.durationInFrames,
          warnings: composed.validation.issues.filter((item) => item.severity === "warning"),
          nextAction: variant
            ? `Apply ${variant.id} with editor_apply_variant when the human chooses it.`
            : "Run editor_validate_project, capture a contact sheet, and correct any issues before export.",
        });
      },
    }),
    defineTool({
      name: "editor_list_variants",
      title: "List creative variants",
      description: "List isolated timeline drafts without changing the active edit.",
      schema: emptyInput,
      readOnly: true,
      execute: () => projectResult({
        ok: true,
        variants: Array.from(variants.values(), (variant) => ({
          id: variant.id,
          name: variant.name,
          aspect: variant.aspect,
          createdAt: variant.createdAt,
          counts: {
            clips: variant.version.clips.length,
            textOverlays: variant.version.textOverlays.length,
            audioTracks: variant.version.audioTracks.length,
            transitions: variant.version.transitions.length,
          },
          durationInFrames: getVersionRenderDurationInFrames(variant.version),
        })),
      }),
    }),
    defineTool({
      name: "editor_create_variant",
      title: "Save current edit as variant",
      description: "Create an isolated snapshot of the current or specified canvas for safe creative comparison.",
      schema: createVariantInput,
      readOnly: false,
      execute: (input) => {
        const aspect = input.aspect ?? context.getState().present.activeVersion;
        const variant = saveVariant(input.name, activeVersion(context.getState(), aspect));
        return projectResult({ ok: true, variant: { id: variant.id, name: variant.name, aspect, createdAt: variant.createdAt } });
      },
    }),
    defineTool({
      name: "editor_apply_variant",
      title: "Apply creative variant",
      description: "Replace the matching canvas timeline with an isolated variant. Requires explicit confirmation.",
      schema: applyVariantInput,
      readOnly: false,
      execute: (input) => {
        const variant = variants.get(input.variantId);
        if (!variant) throw new Error("Variant not found");
        dispatch({ type: "replace-version", aspect: variant.aspect, version: cloneVersion(variant.version) });
        if (context.getState().present.activeVersion !== variant.aspect) {
          dispatch({ type: "switch-aspect", aspect: variant.aspect });
        }
        return projectResult({ ok: true, message: `Applied variant ${variant.name}.`, variantId: variant.id, aspect: variant.aspect });
      },
    }),
    defineTool({
      name: "editor_delete_variant",
      title: "Delete creative variant",
      description: "Delete an isolated variant without changing the active edit. Requires explicit confirmation.",
      schema: deleteVariantInput,
      readOnly: false,
      execute: (input) => {
        if (!variants.delete(input.variantId)) throw new Error("Variant not found");
        return result("Variant deleted", { variantId: input.variantId });
      },
    }),
    defineTool({ name: "editor_switch_canvas", title: "Switch canvas", description: "Switch the active canvas aspect ratio.", schema: switchInput, readOnly: false, execute: (input) => { dispatch({ type: "switch-aspect", aspect: input.aspect }); return result("Canvas switched", { activeVersion: input.aspect }); } }),
    defineTool({ name: "editor_select_timeline_item", title: "Select timeline item", description: "Select an existing clip, text overlay, or audio track in the editor timeline.", schema: selectInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; requireItem(aspect, input.itemType, input.itemId); const callback = input.itemType === "clip" ? context.selectClip : input.itemType === "textOverlay" ? context.selectText : context.selectAudio; if (!callback) throw new Error("Timeline selection is unavailable"); callback(input.itemId); return result("Timeline item selected", { aspect, itemType: input.itemType, itemId: input.itemId }); } }),
    defineTool({ name: "editor_add_text_overlay", title: "Add text overlay", description: "Add a text overlay to the current or specified canvas.", schema: addInput, readOnly: false, execute: (input) => { const state = context.getState(); const aspect = input.aspect ?? state.present.activeVersion; const { aspect: _aspect, id, ...fields } = input; void _aspect; const overlay = { ...createDefaultTextOverlay(id ?? context.createId?.() ?? `text-${Date.now()}`), ...fields } as TextOverlay; validateRange(overlay.startFrame, overlay.endFrame); dispatch({ type: "add-text-overlay", aspect, overlay }); context.selectText?.(overlay.id); return result("Text overlay added", { aspect, overlayId: overlay.id }); } }),
    defineTool({ name: "editor_update_text_overlay", title: "Update text overlay", description: "Update fields on an existing text overlay.", schema: updateInput, readOnly: false, execute: (input) => { const state = context.getState(); const aspect = input.aspect ?? state.present.activeVersion; const current = activeVersion(state, aspect).textOverlays.find((item) => item.id === input.overlayId); if (!current) throw new Error("Text overlay not found"); const { overlayId, aspect: _aspect, ...patch } = input; void _aspect; validateRange(patch.startFrame ?? current.startFrame, patch.endFrame ?? current.endFrame); dispatch({ type: "update-text-overlay", aspect, overlayId, patch }); context.selectText?.(overlayId); return result("Text overlay updated", { aspect, overlayId }); } }),
    defineTool({ name: "editor_remove_text_overlay", title: "Remove text overlay", description: "Remove a text overlay. Requires explicit confirmation.", schema: removeTextInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; if (!activeVersion(context.getState(), aspect).textOverlays.some((item) => item.id === input.overlayId)) throw new Error("Text overlay not found"); dispatch({ type: "remove-text-overlay", aspect, overlayId: input.overlayId }); return result("Text overlay removed", { aspect, overlayId: input.overlayId }); } }),
    defineTool({ name: "editor_update_clip", title: "Update clip", description: "Update timing, trim, volume, or export-safe video color grade fields on an existing media clip.", schema: updateClipInput, readOnly: false, execute: (input) => { const state = context.getState(); const aspect = input.aspect ?? state.present.activeVersion; const current = activeVersion(state, aspect).clips.find((item) => item.id === input.clipId); if (!current) throw new Error("Clip not found"); const { clipId, aspect: _aspect, ...patch } = input; void _aspect; validateRange(patch.startFrame ?? current.startFrame, patch.endFrame ?? current.endFrame); validateRange(patch.trimStartFrame ?? current.trimStartFrame, patch.trimEndFrame ?? current.trimEndFrame); dispatch({ type: "update-clip", aspect, clipId, patch }); return result("Clip updated", { aspect, clipId }); } }),
    defineTool({ name: "editor_remove_clip", title: "Remove clip", description: "Remove a clip and its connected transitions. Requires explicit confirmation.", schema: removeClipInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; if (!activeVersion(context.getState(), aspect).clips.some((item) => item.id === input.clipId)) throw new Error("Clip not found"); dispatch({ type: "remove-clip", aspect, clipId: input.clipId }); return result("Clip removed", { aspect, clipId: input.clipId }); } }),
    defineTool({ name: "editor_move_clip", title: "Reorder clip", description: "Move an existing clip one position earlier or later in the timeline.", schema: moveClipInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; const version = activeVersion(context.getState(), aspect); const target = version.clips.find((clip) => clip.id === input.clipId); const lane = version.clips.filter((clip) => (clip.trackId ?? DEFAULT_VIDEO_TRACK_ID) === (target?.trackId ?? DEFAULT_VIDEO_TRACK_ID)).sort((a, b) => a.startFrame - b.startFrame); const index = lane.findIndex((clip) => clip.id === input.clipId); if (index < 0) throw new Error("Clip not found"); if (index + input.offset < 0 || index + input.offset >= lane.length) throw new Error("Clip cannot move further in that direction"); dispatch({ type: "move-clip", aspect, clipId: input.clipId, offset: input.offset }); return result("Clip reordered", { aspect, clipId: input.clipId, offset: input.offset }); } }),
    defineTool({ name: "editor_split_clip", title: "Split clip", description: "Split a visual clip at an exact timeline frame.", schema: splitClipInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; const version = activeVersion(context.getState(), aspect); const clip = version.clips.find((item) => item.id === input.clipId); if (!clip) throw new Error("Clip not found"); if (input.splitFrame <= clip.startFrame || input.splitFrame >= clip.endFrame) throw new Error("Split frame must be inside the clip"); const base = context.createId?.() ?? `${Date.now()}`; const leftClipId = `${base}-left`; const rightClipId = `${base}-right`; dispatch({ type: "split-clip", aspect, clipId: input.clipId, splitFrame: input.splitFrame, leftClipId, rightClipId }); context.selectClip?.(rightClipId); return result("Clip split", { aspect, leftClipId, rightClipId, splitFrame: input.splitFrame }); } }),
    defineTool({ name: "editor_duplicate_clip", title: "Duplicate clip", description: "Duplicate a visual clip directly after the original.", schema: duplicateClipInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; if (!activeVersion(context.getState(), aspect).clips.some((clip) => clip.id === input.clipId)) throw new Error("Clip not found"); const newClipId = `${context.createId?.() ?? Date.now()}-copy`; dispatch({ type: "duplicate-clip", aspect, clipId: input.clipId, newClipId }); context.selectClip?.(newClipId); return result("Clip duplicated", { aspect, sourceClipId: input.clipId, newClipId }); } }),
    defineTool({ name: "editor_set_transition", title: "Set transition", description: "Set a fade, slide, or wipe transition between adjacent clips.", schema: transitionInput, readOnly: false, execute: (input) => { const state = context.getState(); const aspect = input.aspect ?? state.present.activeVersion; const version = activeVersion(state, aspect); const source = version.clips.find((clip) => clip.id === input.fromClipId); const lane = version.clips.filter((clip) => (clip.trackId ?? DEFAULT_VIDEO_TRACK_ID) === (source?.trackId ?? DEFAULT_VIDEO_TRACK_ID)).sort((a, b) => a.startFrame - b.startFrame); const fromIndex = lane.findIndex((clip) => clip.id === input.fromClipId); const toIndex = lane.findIndex((clip) => clip.id === input.toClipId); if (fromIndex < 0 || toIndex < 0 || toIndex !== fromIndex + 1) throw new Error("Transition clips must be adjacent"); const maxDuration = Math.max(0, Math.min(getClipDurationInFrames(lane[fromIndex]) - 1, getClipDurationInFrames(lane[toIndex]) - 1)); if (input.durationInFrames > maxDuration) throw new Error(`Transition duration must be at most ${maxDuration} frames`); const transition: Transition = { id: input.id ?? context.createId?.() ?? `transition-${Date.now()}`, kind: input.kind, durationInFrames: input.durationInFrames, fromClipId: input.fromClipId, toClipId: input.toClipId, easing: input.easing, ...(input.kind !== "fade" ? { direction: input.direction ?? "left" } : {}) }; dispatch({ type: "set-transition", aspect, transition }); return result("Transition set", { aspect, transitionId: transition.id, kind: transition.kind, fromClipId: input.fromClipId, toClipId: input.toClipId, durationInFrames: input.durationInFrames }); } }),
    defineTool({ name: "editor_remove_transition", title: "Remove transition", description: "Remove a transition. Requires explicit confirmation.", schema: removeTransitionInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; if (!activeVersion(context.getState(), aspect).transitions.some((transition) => transition.fromClipId === input.fromClipId && transition.toClipId === input.toClipId)) throw new Error("Transition not found"); dispatch({ type: "remove-transition", aspect, fromClipId: input.fromClipId, toClipId: input.toClipId }); return result("Transition removed", { aspect, fromClipId: input.fromClipId, toClipId: input.toClipId }); } }),
    defineTool({ name: "editor_update_audio_track", title: "Update audio track", description: "Update timing, trim, or volume fields on an existing audio track.", schema: updateAudioInput, readOnly: false, execute: (input) => { const state = context.getState(); const aspect = input.aspect ?? state.present.activeVersion; const current = activeVersion(state, aspect).audioTracks.find((item) => item.id === input.trackId); if (!current) throw new Error("Audio track not found"); const { trackId, aspect: _aspect, ...patch } = input; void _aspect; validateRange(patch.startFrame ?? current.startFrame, patch.endFrame ?? current.endFrame); validateRange(patch.trimStartFrame ?? current.trimStartFrame, patch.trimEndFrame ?? current.trimEndFrame); dispatch({ type: "update-audio-track", aspect, trackId, patch }); return result("Audio track updated", { aspect, trackId }); } }),
    defineTool({ name: "editor_remove_audio_track", title: "Remove audio track", description: "Remove an audio track. Requires explicit confirmation.", schema: removeAudioInput, readOnly: false, execute: (input) => { const aspect = input.aspect ?? context.getState().present.activeVersion; if (!activeVersion(context.getState(), aspect).audioTracks.some((item) => item.id === input.trackId)) throw new Error("Audio track not found"); dispatch({ type: "remove-audio-track", aspect, trackId: input.trackId }); return result("Audio track removed", { aspect, trackId: input.trackId }); } }),
    defineTool({ name: "editor_apply_ai_editor_actions", title: "Apply structured editor actions", description: "Apply validated structured AI editor actions. Requires explicit confirmation.", schema: applyAIInput, readOnly: false, execute: async (input, signal) => { if (!context.applyAIEditorActions) throw new Error("AI editor actions are unavailable"); return callbackResponse(await context.applyAIEditorActions(input.actions, signal), "AI editor actions applied"); } }),
    defineTool({ name: "editor_export_fcpxml", title: "Export editable FCPXML timeline", description: "Download the active timeline as Final Cut Pro XML 1.9 for Final Cut Pro or DaVinci Resolve. Returns compatibility diagnostics and requires explicit confirmation because it creates an external artifact.", schema: z.object({ confirmed: z.literal(true) }).strict(), readOnly: false, execute: async (_input, signal) => { if (!context.requestTimelineExport) throw new Error("Editable timeline export is unavailable"); return callbackResponse(await context.requestTimelineExport("fcpxml", signal), "FCPXML timeline downloaded"); } }),
    defineTool({ name: "editor_export_edl", title: "Export CMX 3600 EDL", description: "Download the active timeline as a CMX 3600 edit decision list. Returns compatibility diagnostics and requires explicit confirmation because it creates an external artifact.", schema: z.object({ confirmed: z.literal(true) }).strict(), readOnly: false, execute: async (_input, signal) => { if (!context.requestTimelineExport) throw new Error("Editable timeline export is unavailable"); return callbackResponse(await context.requestTimelineExport("edl", signal), "EDL downloaded"); } }),
    defineTool({ name: "editor_export_fcpxml_bundle", title: "Export FCPXML with source media", description: "Download a ZIP containing the active FCPXML timeline, stored source media, relinking manifest, and import instructions. Requires explicit confirmation because it creates an external artifact.", schema: z.object({ confirmed: z.literal(true) }).strict(), readOnly: false, execute: async (_input, signal) => { if (!context.requestTimelineExport) throw new Error("Editable timeline export is unavailable"); return callbackResponse(await context.requestTimelineExport("fcpxml-bundle", signal), "FCPXML media bundle downloaded"); } }),
    defineTool({ name: "editor_request_export", title: "Request validated video export", description: "Validate the active project and request a local browser MP4 download. Requires explicit confirmation because it creates an external artifact.", schema: z.object({ confirmed: z.literal(true) }).strict(), readOnly: false, execute: async (_input, signal) => { if (!context.requestExport) throw new Error("Export is unavailable"); const state = context.getState(); const version = context.getActiveVersion?.() ?? activeVersion(state, state.present.activeVersion); const validation = validateEditorVersion(version, context.getAssets?.() ?? []); if (!validation.readyForExport) throw new Error(`Export blocked: ${validation.issues.filter((item) => item.severity === "error").map((item) => item.message).join(" ")}`); const credits = getAttributionReport(version, context.getAssets?.() ?? [], false); if (!credits.readyToPublish) throw new Error("Export blocked: required stock-media attribution metadata is incomplete"); const response = await context.requestExport(signal); throwIfAborted(signal); if (!response.ok) return json({ ...response, ok: false, error: response.message }); return projectResult({ ...response, ok: true, message: response.message || "Export requested", validation: { readyForExport: true, warnings: validation.counts.warnings }, credits: { readyToPublish: credits.readyToPublish, creditLines: credits.copyableCredits }, nextAction: "Poll editor_get_export_status until completed, then verify and play the downloaded MP4." }); } }),
    defineTool({ name: "editor_cancel_export", title: "Cancel video export", description: "Cancel the active browser export. Requires explicit confirmation.", schema: cancelExportInput, readOnly: false, execute: async (_input, signal) => { if (!context.cancelExport) throw new Error("Export cancellation is unavailable"); return callbackResponse(await context.cancelExport(signal), "Export cancellation requested"); } }),
    defineTool({ name: "editor_remove_asset", title: "Remove editor asset", description: "Remove an asset and its timeline references through the host editor. Requires explicit confirmation.", schema: removeAssetInput, readOnly: false, execute: async (input, signal) => { if (!context.removeAsset) throw new Error("Asset removal is unavailable"); const assets = context.getAssets?.(); if (assets && !assets.some((asset) => asset.assetId === input.assetId)) throw new Error("Asset not found"); return callbackResponse(await context.removeAsset(input.assetId, signal), "Asset removed"); } }),
    defineTool({ name: "editor_undo", title: "Undo editor change", description: "Undo the latest editor mutation.", schema: emptyInput, readOnly: false, execute: () => { if (!context.undo || context.getState().past.length === 0) throw new Error("Nothing to undo"); context.undo(); return result("Undo applied"); } }),
    defineTool({ name: "editor_redo", title: "Redo editor change", description: "Redo the latest undone editor mutation.", schema: emptyInput, readOnly: false, execute: () => { if (!context.redo || context.getState().future.length === 0) throw new Error("Nothing to redo"); context.redo(); return result("Redo applied"); } }),
  ];
};

export const editorWebMcpTools = createEditorWebMcpTools;
