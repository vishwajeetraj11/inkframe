import { z } from "zod";
import {
  TEXT_OVERLAY_FONT_STYLES,
  TEXT_OVERLAY_ANIMATION_KINDS,
} from "./types";

export const AI_EDITOR_ACTIONS_START = "[[EDITOR_ACTIONS]]";
export const AI_EDITOR_ACTIONS_END = "[[/EDITOR_ACTIONS]]";

const AI_READABLE_FONT_FAMILIES = ["sans", "serif", "mono"] as const;

const normalizeAIFontFamily = (
  value: unknown,
): (typeof AI_READABLE_FONT_FAMILIES)[number] | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized === "mono" ||
    normalized === "monospace" ||
    normalized === "typewriter"
  ) {
    return "mono";
  }

  if (normalized === "serif" || normalized === "times" || normalized === "georgia") {
    return "serif";
  }

  if (
    normalized === "sans" ||
    normalized === "sans-serif" ||
    normalized === "helvetica" ||
    normalized === "arial"
  ) {
    return "sans";
  }

  if (
    normalized === "cursive" ||
    normalized.includes("script") ||
    normalized.includes("handwritten") ||
    normalized.includes("calligraphy") ||
    normalized.includes("brush")
  ) {
    return "sans";
  }

  return undefined;
};

const aiSceneSchema = z.object({
  text: z.string().min(1),
  durationSeconds: z.number().positive().max(30).optional(),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  fontSize: z.number().int().min(12).max(200).optional(),
  color: z.string().min(1).optional(),
  fontFamily: z.preprocess(
    (value) => normalizeAIFontFamily(value),
    z.enum(AI_READABLE_FONT_FAMILIES).optional(),
  ),
  fontWeight: z.number().int().min(100).max(900).optional(),
  fontStyle: z.enum(TEXT_OVERLAY_FONT_STYLES).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  animation: z
    .object({
      in: z.enum(TEXT_OVERLAY_ANIMATION_KINDS).optional(),
      out: z.enum(TEXT_OVERLAY_ANIMATION_KINDS).optional(),
      durationSeconds: z.number().min(0.05).max(2).optional(),
    })
    .optional(),
  stylePreset: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().toLowerCase() === "classic"
        ? "classic"
        : undefined,
    z.literal("classic").optional(),
  ),
});

const TARGET_ASPECT_VALUES = [
  "active",
  "reel_9_16",
  "widescreen_16_9",
] as const;

type TargetAspectValue = (typeof TARGET_ASPECT_VALUES)[number];

const normalizeTargetAspect = (value: unknown): TargetAspectValue | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  const compact = normalized.replace(/[\s_-]+/g, "");

  if (normalized === "active") {
    return "active";
  }

  if (
    normalized === "reel_9_16" ||
    normalized === "reel-9-16" ||
    normalized === "reel9:16" ||
    normalized === "reel9x16" ||
    normalized === "reel_9x16" ||
    normalized === "reel 9:16" ||
    normalized === "9:16" ||
    normalized === "9x16" ||
    normalized === "vertical" ||
    normalized === "portrait"
    || compact === "reel916"
    || compact === "916"
    || compact === "portrait916"
  ) {
    return "reel_9_16";
  }

  if (
    normalized === "widescreen_16_9" ||
    normalized === "widescreen-16-9" ||
    normalized === "widescreen16:9" ||
    normalized === "widescreen16x9" ||
    normalized === "widescreen_16x9" ||
    normalized === "widescreen 16:9" ||
    normalized === "16:9" ||
    normalized === "16x9" ||
    normalized === "landscape" ||
    normalized === "youtube"
    || compact === "widescreen169"
    || compact === "169"
    || compact === "landscape169"
  ) {
    return "widescreen_16_9";
  }

  return undefined;
};

const targetAspectSchema = z.preprocess(
  (value) => normalizeTargetAspect(value),
  z.enum(TARGET_ASPECT_VALUES).optional(),
);

export const aiEditorActionsSchema = z.object({
  targetAspect: targetAspectSchema,
  scenes: z.array(aiSceneSchema).min(1),
  transitionSeconds: z.number().min(0).max(2).optional(),
  assetNameHint: z.string().min(1).optional(),
});

export type AIEditorActions = z.infer<typeof aiEditorActionsSchema>;

export interface ParsedAIEditorActions {
  cleanedText: string;
  actions: AIEditorActions | null;
  parseError: string | null;
}

export const parseAIEditorActionsFromMessage = (
  text: string,
): ParsedAIEditorActions => {
  const start = text.indexOf(AI_EDITOR_ACTIONS_START);
  const end = text.indexOf(AI_EDITOR_ACTIONS_END);

  if (start === -1 || end === -1 || end <= start) {
    return {
      cleanedText: text,
      actions: null,
      parseError: null,
    };
  }

  const jsonStart = start + AI_EDITOR_ACTIONS_START.length;
  const rawJson = text.slice(jsonStart, end).trim();
  const cleanedText = `${text.slice(0, start)}${text.slice(
    end + AI_EDITOR_ACTIONS_END.length,
  )}`.trim();

  if (!rawJson) {
    return {
      cleanedText,
      actions: null,
      parseError: "AI returned an empty editor actions block.",
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawJson);
  } catch {
    return {
      cleanedText,
      actions: null,
      parseError: "AI returned invalid JSON for editor actions.",
    };
  }

  const parsedActions = aiEditorActionsSchema.safeParse(parsedJson);
  if (!parsedActions.success) {
    return {
      cleanedText,
      actions: null,
      parseError:
        parsedActions.error.issues[0]?.message ??
        "AI returned malformed editor actions.",
    };
  }

  return {
    cleanedText,
    actions: parsedActions.data,
    parseError: null,
  };
};
