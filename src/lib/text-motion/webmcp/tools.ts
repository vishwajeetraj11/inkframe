import { nanoid } from "nanoid";
import { z } from "zod";
import type { WebMcpTool } from "@/lib/webmcp/types";
import {
  MAX_SCENE_DURATION_FRAMES,
  MAX_TEXT_MOTION_SCENE_COUNT,
  MIN_SCENE_DURATION_FRAMES,
  TEXT_MOTION_ANIMATIONS,
} from "../constants";
import { createDefaultTextMotionScene } from "../defaults";
import { TEXT_MOTION_TEMPLATE_DEFINITIONS } from "../templates";
import { sanitizeTextMotionProject } from "../utils";
import type {
  TextMotionAnimation,
  TextMotionProject,
  TextMotionTemplate,
} from "../types";

const MAX_OUTPUT_LENGTH = 1500;
const aspectSchema = z.enum(["reel_9_16", "widescreen_16_9"]);
const templateSchema = z.enum(["default", "grid-kinetic", "photo-card"]);
const animationSchema = z.enum(TEXT_MOTION_ANIMATIONS);
const hexColorSchema = z.string().regex(/^#[\da-fA-F]{6}$/);

export interface TextMotionWebMcpContext {
  /** Read the current value at invocation time; do not capture a project snapshot. */
  getProject: () => TextMotionProject;
  /** Replace the current project after a validated, sanitized mutation. */
  setProject: (project: TextMotionProject) => void;
  /** Read/write the prompt held outside the project object. */
  getPrompt?: () => string;
  setPrompt?: (prompt: string) => void;
  /** Load a template through the UI's real merge path (including image handling). */
  loadTemplate?: (template: TextMotionTemplate) => void | Promise<void>;
  /** Request the browser's native image file picker. Files never cross the WebMCP boundary. */
  requestImagePicker?: () => void | Promise<void>;
  /** Run the existing AI generation flow for a prompt. */
  generate?: (prompt: string, signal: AbortSignal) => void | Promise<void>;
  /** Run the existing MP4 export flow. */
  exportProject?: (signal: AbortSignal) => void | Promise<void>;
}

const output = (value: unknown): string => {
  const serialized = JSON.stringify(value);
  if (serialized.length <= MAX_OUTPUT_LENGTH) return serialized;
  return JSON.stringify({ ok: false, error: "Output exceeded the response limit." });
};

const summary = (project: TextMotionProject) => ({
  title: project.title,
  aspect: project.aspect,
  template: project.template,
  theme: project.theme,
  sceneCount: project.scenes.length,
  durationInFrames: project.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0),
  scenes: project.scenes.slice(0, 12).map((scene) => ({
    id: scene.id,
    text: scene.text,
    durationInFrames: scene.durationInFrames,
    animation: scene.animation,
  })),
  omittedScenes: Math.max(0, project.scenes.length - 12),
});

const assertNotAborted = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException("Tool call aborted", "AbortError");
  }
};

const mutate = (
  context: TextMotionWebMcpContext,
  change: (project: TextMotionProject) => TextMotionProject,
) => {
  const next = sanitizeTextMotionProject(change(context.getProject()));
  context.setProject(next);
  return output({ ok: true, project: summary(next) });
};

const tool = <T extends z.ZodType>(
  name: string,
  description: string,
  inputSchema: T,
  execute: (input: z.infer<T>, signal: AbortSignal) => string | Promise<string>,
  annotations: Record<string, boolean>,
): WebMcpTool => ({
  name,
  title: name
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" "),
  description,
  inputSchema: z.toJSONSchema(inputSchema),
  execute: async (input, options) => {
    assertNotAborted(options.signal);
    const result = await execute(inputSchema.parse(input), options.signal);
    assertNotAborted(options.signal);
    return result;
  },
  annotations: {
    readOnlyHint: annotations.readOnlyHint,
    untrustedContentHint: true,
  },
});

const readOnly = { readOnlyHint: true };
const mutation = { readOnlyHint: false };

export const createTextMotionWebMcpTools = (
  context: TextMotionWebMcpContext,
): WebMcpTool[] => [
  tool(
    "text_motion_get_capabilities",
    "List the safe Text Motion WebMCP capabilities available on this page.",
    z.object({}).strict(),
    () => output({
      ok: true,
      capabilities: [
        "project_summary",
        "aspect_and_template",
        "scene_editing",
        "theme_editing",
        "prompt_and_title",
        "image_metadata_and_assignment",
        "confirmed_generation",
        "confirmed_export",
        "native_image_picker",
      ],
      limits: {
        maxScenes: MAX_TEXT_MOTION_SCENE_COUNT,
        minSceneDurationInFrames: MIN_SCENE_DURATION_FRAMES,
        maxSceneDurationInFrames: MAX_SCENE_DURATION_FRAMES,
      },
    }),
    readOnly,
  ),
  tool(
    "text_motion_list_templates",
    "List the available Text Motion templates and their behavior.",
    z.object({}).strict(),
    () => output({
      ok: true,
      templates: TEXT_MOTION_TEMPLATE_DEFINITIONS.map(({ id, label, shortLabel, applyFirstImageToAllScenes }) => ({
        id,
        label,
        shortLabel,
        appliesFirstImageToAllScenes: Boolean(applyFirstImageToAllScenes),
      })),
    }),
    readOnly,
  ),
  tool(
    "text_motion_list_animations",
    "List the animation names accepted by Text Motion scenes.",
    z.object({}).strict(),
    () => output({ ok: true, animations: [...TEXT_MOTION_ANIMATIONS] }),
    readOnly,
  ),
  tool(
    "text_motion_get_project_summary",
    "Read the current Text Motion project summary without exposing image data.",
    z.object({}).strict(),
    () => output({ ok: true, project: summary(sanitizeTextMotionProject(context.getProject())) }),
    readOnly,
  ),
  tool(
    "text_motion_set_aspect_template",
    "Set the current Text Motion aspect ratio and/or template.",
    z.object({ aspect: aspectSchema.optional(), template: templateSchema.optional() }).strict(),
    async (input, signal) => {
      assertNotAborted(signal);
      if (input.aspect) {
        mutate(context, (project) => ({ ...project, aspect: input.aspect! }));
      }
      if (input.template) {
        if (context.loadTemplate) {
          await context.loadTemplate(input.template);
        } else {
          mutate(context, (project) => ({ ...project, template: input.template! }));
        }
      }
      assertNotAborted(signal);
      return output({ ok: true, message: "Aspect/template updated", project: summary(sanitizeTextMotionProject(context.getProject())) });
    },
    mutation,
  ),
  tool(
    "text_motion_load_template",
    "Load a Text Motion template through the page's real template-loading path.",
    z.object({ template: templateSchema }).strict(),
    async (input, signal) => {
      if (context.loadTemplate) {
        await context.loadTemplate(input.template);
      } else {
        mutate(context, (project) => ({ ...project, template: input.template }));
      }
      assertNotAborted(signal);
      return output({ ok: true, message: "Template loaded", template: input.template, project: summary(sanitizeTextMotionProject(context.getProject())) });
    },
    mutation,
  ),
  tool(
    "text_motion_set_prompt",
    "Set the current Text Motion generation prompt.",
    z.object({ prompt: z.string().trim().min(3).max(2000) }).strict(),
    (input) => {
      if (!context.setPrompt) throw new Error("Prompt updates are unavailable");
      context.setPrompt(input.prompt);
      return output({ ok: true, message: "Prompt updated", promptLength: input.prompt.length });
    },
    mutation,
  ),
  tool(
    "text_motion_set_title",
    "Set the current Text Motion project title.",
    z.object({ title: z.string().trim().min(1).max(80) }).strict(),
    (input) => mutate(context, (project) => ({ ...project, title: input.title })),
    mutation,
  ),
  tool(
    "text_motion_add_scene",
    "Append a text scene using safe duration and animation bounds.",
    z.object({
      text: z.string().trim().min(1).max(180),
      durationInFrames: z.number().int().min(MIN_SCENE_DURATION_FRAMES).max(MAX_SCENE_DURATION_FRAMES).optional(),
      animation: animationSchema.optional(),
    }).strict(),
    (input) => mutate(context, (project) => {
      if (project.scenes.length >= MAX_TEXT_MOTION_SCENE_COUNT) {
        throw new Error("Maximum scene count reached");
      }
      const scene = createDefaultTextMotionScene(`scene-${nanoid(8)}`, input.text);
      return {
        ...project,
        scenes: [...project.scenes, {
          ...scene,
          durationInFrames: input.durationInFrames ?? scene.durationInFrames,
          animation: (input.animation ?? scene.animation) as TextMotionAnimation,
        }],
      };
    }),
    mutation,
  ),
  tool(
    "text_motion_update_scene",
    "Update any editable field on a scene by scene id.",
    z.object({
      sceneId: z.string().trim().min(1).max(128),
      text: z.string().trim().min(1).max(180).optional(),
      animation: animationSchema.optional(),
      durationInFrames: z.number().int().min(MIN_SCENE_DURATION_FRAMES).max(MAX_SCENE_DURATION_FRAMES).optional(),
      accentWord: z.string().trim().max(50).nullable().optional(),
      fontFamily: z.enum(["sans", "serif", "mono", "display", "condensed", "slab", "modern"]).optional(),
      fontWeight: z.number().int().min(100).max(900).optional(),
      fontStyle: z.enum(["normal", "italic"]).optional(),
      keepOnScreen: z.boolean().optional(),
      imageAssetId: z.string().trim().min(1).max(128).nullable().optional(),
      imageScale: z.number().min(0.2).max(2.5).optional(),
      imageOpacity: z.number().min(0).max(1).optional(),
      imageX: z.number().min(0).max(100).optional(),
      imageY: z.number().min(0).max(100).optional(),
    }).strict(),
    (input) => mutate(context, (project) => {
      if (!project.scenes.some((scene) => scene.id === input.sceneId)) {
        throw new Error("Scene not found");
      }
      if (input.imageAssetId !== undefined && input.imageAssetId !== null &&
        !project.imageAssets.some((asset) => asset.id === input.imageAssetId)) {
        throw new Error("Image asset not found");
      }
      return {
        ...project,
        scenes: project.scenes.map((scene) => scene.id === input.sceneId ? {
          ...scene,
          ...(input.text === undefined ? {} : { text: input.text }),
          ...(input.animation === undefined ? {} : { animation: input.animation }),
          ...(input.durationInFrames === undefined ? {} : { durationInFrames: input.durationInFrames }),
          ...(input.accentWord === undefined ? {} : { accentWord: input.accentWord ?? undefined }),
          ...(input.fontFamily === undefined ? {} : { fontFamily: input.fontFamily }),
          ...(input.fontWeight === undefined ? {} : { fontWeight: input.fontWeight }),
          ...(input.fontStyle === undefined ? {} : { fontStyle: input.fontStyle }),
          ...(input.keepOnScreen === undefined ? {} : { keepOnScreen: input.keepOnScreen }),
          ...(input.imageAssetId === undefined ? {} : { imageAssetId: input.imageAssetId ?? undefined }),
          ...(input.imageScale === undefined ? {} : { imageScale: input.imageScale }),
          ...(input.imageOpacity === undefined ? {} : { imageOpacity: input.imageOpacity }),
          ...(input.imageX === undefined ? {} : { imageX: input.imageX }),
          ...(input.imageY === undefined ? {} : { imageY: input.imageY }),
        } : scene),
      };
    }),
    mutation,
  ),
  tool(
    "text_motion_update_theme",
    "Update one or more six-digit hex colors in the current theme.",
    z.object({
      backgroundFrom: hexColorSchema.optional(),
      backgroundTo: hexColorSchema.optional(),
      textColor: hexColorSchema.optional(),
      accentColor: hexColorSchema.optional(),
    }).strict(),
    (input) => mutate(context, (project) => ({ ...project, theme: { ...project.theme, ...input } })),
    mutation,
  ),
  tool(
    "text_motion_list_image_assets",
    "List image asset metadata without exposing image data URLs or File objects.",
    z.object({}).strict(),
    () => {
      const project = sanitizeTextMotionProject(context.getProject());
      return output({
        ok: true,
        assets: project.imageAssets.map(({ id, name, mimeType }) => ({ id, name: name.slice(0, 120), mimeType })),
      });
    },
    readOnly,
  ),
  tool(
    "text_motion_assign_image_to_all_scenes",
    "Assign an existing image asset to every scene.",
    z.object({ assetId: z.string().trim().min(1).max(128) }).strict(),
    (input) => mutate(context, (project) => {
      if (!project.imageAssets.some((asset) => asset.id === input.assetId)) {
        throw new Error("Image asset not found");
      }
      return {
        ...project,
        scenes: project.scenes.map((scene) => ({ ...scene, imageAssetId: input.assetId })),
      };
    }),
    mutation,
  ),
  tool(
    "text_motion_remove_image_asset",
    "Remove an image asset and detach it from scenes; explicit confirmation is required.",
    z.object({ assetId: z.string().trim().min(1).max(128), confirmed: z.literal(true) }).strict(),
    (input) => mutate(context, (project) => {
      if (!project.imageAssets.some((asset) => asset.id === input.assetId)) {
        throw new Error("Image asset not found");
      }
      return {
        ...project,
        imageAssets: project.imageAssets.filter((asset) => asset.id !== input.assetId),
        scenes: project.scenes.map((scene) => scene.imageAssetId === input.assetId
          ? { ...scene, imageAssetId: undefined }
          : scene),
      };
    }),
    mutation,
  ),
  tool(
    "text_motion_remove_scene",
    "Remove a scene; explicit confirmation is required and the final scene is preserved.",
    z.object({ sceneId: z.string().trim().min(1).max(128), confirmed: z.literal(true) }).strict(),
    (input) => mutate(context, (project) => {
      if (!project.scenes.some((scene) => scene.id === input.sceneId)) {
        throw new Error("Scene not found");
      }
      if (project.scenes.length <= 1) {
        throw new Error("Cannot remove the last scene");
      }
      return { ...project, scenes: project.scenes.filter((scene) => scene.id !== input.sceneId) };
    }),
    mutation,
  ),
  tool(
    "text_motion_generate",
    "Generate a new storyboard from the current or supplied prompt; explicit confirmation is required.",
    z.object({ prompt: z.string().trim().min(3).max(2000).optional(), confirmed: z.literal(true) }).strict(),
    async (input, signal) => {
      if (!context.generate) throw new Error("Generation is unavailable");
      const prompt = input.prompt ?? context.getPrompt?.().trim() ?? "";
      if (prompt.length < 3) throw new Error("A prompt of at least 3 characters is required");
      await context.generate(prompt, signal);
      assertNotAborted(signal);
      return output({ ok: true, message: "Text motion storyboard generated", project: summary(sanitizeTextMotionProject(context.getProject())) });
    },
    mutation,
  ),
  tool(
    "text_motion_export",
    "Export the current Text Motion project as MP4; explicit confirmation is required.",
    z.object({ confirmed: z.literal(true) }).strict(),
    async (_input, signal) => {
      if (!context.exportProject) throw new Error("Export is unavailable");
      await context.exportProject(signal);
      assertNotAborted(signal);
      return output({ ok: true, message: "Text motion video exported" });
    },
    mutation,
  ),
  tool(
    "text_motion_request_image_picker",
    "Open the native image picker so the user can choose image files.",
    z.object({}).strict(),
    async (_input, signal) => {
      if (!context.requestImagePicker) throw new Error("Image picker is unavailable");
      await context.requestImagePicker();
      assertNotAborted(signal);
      return output({ ok: true, message: "Image picker requested" });
    },
    mutation,
  ),
];

export type { TextMotionAnimation, TextMotionProject, TextMotionTemplate };
