import {
  MAX_SCENE_DURATION_FRAMES,
  MAX_TEXT_MOTION_SCENE_COUNT,
  MAX_TEXT_MOTION_DURATION_FRAMES,
  MIN_SCENE_DURATION_FRAMES,
  TEXT_MOTION_ANIMATIONS,
} from "./constants";
import { z } from "zod";

export const textMotionAnimationSchema = z.enum(TEXT_MOTION_ANIMATIONS);
const textMotionTemplateSchema = z.enum(["default", "grid-kinetic", "photo-card"]);
const textMotionFontFamilySchema = z.enum([
  "sans",
  "serif",
  "mono",
  "display",
  "condensed",
  "slab",
  "modern",
]);
const textMotionFontStyleSchema = z.enum(["normal", "italic"]);

const hexColorSchema = z
  .string()
  .regex(/^#([A-Fa-f0-9]{6})$/, "Must be a 6-digit hex color.");

const textMotionSceneSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  durationInFrames: z
    .number()
    .int()
    .min(MIN_SCENE_DURATION_FRAMES)
    .max(MAX_SCENE_DURATION_FRAMES),
  animation: textMotionAnimationSchema,
  accentWord: z.string().optional(),
  fontFamily: textMotionFontFamilySchema.default("sans"),
  fontWeight: z.number().int().min(100).max(900).default(700),
  fontStyle: textMotionFontStyleSchema.default("normal"),
  keepOnScreen: z.boolean().default(false),
  imageAssetId: z.string().optional(),
  imageScale: z.number().min(0.2).max(2.5).default(1),
  imageOpacity: z.number().min(0).max(1).default(0.65),
  imageX: z.number().min(0).max(100).default(50),
  imageY: z.number().min(0).max(100).default(50),
});

export const textMotionProjectSchema = z
  .object({
    title: z.string().min(1).max(80),
    aspect: z.enum(["reel_9_16", "widescreen_16_9"]),
    template: textMotionTemplateSchema.default("default"),
    theme: z.object({
      backgroundFrom: hexColorSchema,
      backgroundTo: hexColorSchema,
      textColor: hexColorSchema,
      accentColor: hexColorSchema,
    }),
    imageAssets: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          mimeType: z.string().min(1),
          dataUrl: z.string().min(1),
        }),
      )
      .default([]),
    scenes: z.array(textMotionSceneSchema).min(1).max(MAX_TEXT_MOTION_SCENE_COUNT),
  })
  .superRefine((project, context) => {
    const total = project.scenes.reduce(
      (sum, scene) => sum + scene.durationInFrames,
      0,
    );

    if (total > MAX_TEXT_MOTION_DURATION_FRAMES) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scenes"],
        message: `Total duration must be <= ${MAX_TEXT_MOTION_DURATION_FRAMES} frames.`,
      });
    }
  });
