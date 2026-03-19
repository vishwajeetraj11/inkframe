import type { AspectPreset } from "../editor/types";
import {
  MAX_SCENE_DURATION_FRAMES,
  MAX_TEXT_MOTION_SCENE_COUNT,
  MAX_TEXT_MOTION_DURATION_FRAMES,
  MIN_SCENE_DURATION_FRAMES,
  TEXT_MOTION_ANIMATIONS,
  TEXT_MOTION_FPS,
} from "./constants";
import type { TextMotionProject } from "./types";
import { sanitizeTextMotionProject } from "./utils";
import { nanoid } from "nanoid";
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

export const textMotionGenerateInputSchema = z.object({
  prompt: z.string().min(3).max(2000),
  aspect: z.enum(["reel_9_16", "widescreen_16_9"]),
  template: textMotionTemplateSchema.default("default"),
});

export const textMotionGenerationSchema = z.object({
  title: z.string().min(1).max(80),
  theme: z.object({
    backgroundFrom: hexColorSchema,
    backgroundTo: hexColorSchema,
    textColor: hexColorSchema,
    accentColor: hexColorSchema,
  }),
  scenes: z
    .array(
      z.object({
        text: z.string().min(1).max(180),
        durationSeconds: z.number().min(1).max(12),
        animation: textMotionAnimationSchema,
        accentWord: z.string().max(50),
        fontFamily: textMotionFontFamilySchema,
        fontWeight: z.number().int().min(100).max(900),
        fontStyle: textMotionFontStyleSchema,
        keepOnScreen: z.boolean(),
      }),
    )
    .min(2)
    .max(14),
});

export const generationToProject = (
  generated: z.infer<typeof textMotionGenerationSchema>,
  aspect: AspectPreset,
  template: z.infer<typeof textMotionTemplateSchema> = "default",
): TextMotionProject => {
  const preferredAnimations: z.infer<typeof textMotionAnimationSchema>[] =
    template === "photo-card"
      ? ["pop", "slide-up", "wipe", "slide-left", "bounce", "slide-right"]
      : ["slide-left", "wipe", "zoom-spin", "bounce", "slide-right", "pop"];
  const preferredFonts: z.infer<typeof textMotionFontFamilySchema>[] =
    template === "photo-card"
      ? ["serif", "modern", "sans", "slab", "display"]
      : ["condensed", "display", "modern", "sans", "slab"];

  let glitchCount = 0;
  const project: TextMotionProject = {
    title: generated.title,
    aspect,
    template,
    theme: generated.theme,
    imageAssets: [],
    scenes: generated.scenes.map((scene, index) => {
      const normalizedText = scene.text.trim().replace(/\s+/g, " ");
      const fallbackAnimation = preferredAnimations[index % preferredAnimations.length];
      const nextAnimation =
        scene.animation === "fade" || scene.animation === "typewriter"
          ? fallbackAnimation
          : scene.animation;

      let animation = nextAnimation;
      if (animation === "glitch") {
        glitchCount += 1;
        if (glitchCount > 2) {
          animation = fallbackAnimation;
        }
      }

      const fallbackFont = preferredFonts[index % preferredFonts.length];
      const fontFamily =
        template === "photo-card"
          ? scene.fontFamily === "mono" || scene.fontFamily === "condensed"
            ? fallbackFont
            : scene.fontFamily
          : scene.fontFamily === "mono" || scene.fontFamily === "serif"
            ? fallbackFont
            : scene.fontFamily;
      const keepOnScreen =
        template === "photo-card"
          ? false
          : index > 0 && index < 7
            ? scene.keepOnScreen || index % 3 === 0
            : false;

      return {
        id: nanoid(10),
        text: template === "photo-card" ? normalizedText : normalizedText.toUpperCase(),
        durationInFrames: Math.round(scene.durationSeconds * TEXT_MOTION_FPS),
        animation,
        accentWord:
          scene.accentWord.trim().length > 0
            ? template === "photo-card"
              ? scene.accentWord.trim()
              : scene.accentWord.trim().toUpperCase()
            : undefined,
        fontFamily,
        fontWeight: Math.max(700, scene.fontWeight),
        fontStyle: "normal",
        keepOnScreen,
        imageScale: 1,
        imageOpacity: 0.65,
        imageX: 50,
        imageY: 50,
      };
    }),
  };

  return sanitizeTextMotionProject(project);
};
