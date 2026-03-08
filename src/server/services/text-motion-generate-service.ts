import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import {
  generationToProject,
  textMotionGenerateInputSchema,
  textMotionGenerationSchema,
} from "@/lib/text-motion/schema";
import { z } from "zod";

const SYSTEM_PROMPT = `You are a kinetic-typography director.
Create concise, high-impact text motion scripts for short-form social video.
Avoid long paragraphs. Prefer punchy lines and visual pacing.
Use only valid hex colors.

Default visual direction unless user explicitly asks otherwise:
- High-energy stacked typography (bold, condensed, uppercase dominant).
- White/gray base text with one strong accent color.
- Keep words on screen and build composition density over time.
- Use mobile-safe readability and clear hierarchy.`;

const TEMPLATE_GUIDANCE: Record<string, string> = {
  default: `Template direction:
- Bold motion-typography frames.
- Strong hooks, stacked phrases, aggressive pacing.`,
  "grid-kinetic": `Template direction:
- Dense kinetic grid layout.
- Large accent words with smaller supporting stack copy.
- Build visual layering over time.`,
  "photo-card": `Template direction:
- Editorial photo-card layout inspired by a scrapbook or gallery board.
- Images are the hero. Text should read like short captions or labels.
- Use readable serif, sans, slab, or modern fonts only.
- Avoid all-caps shouting, cursive, script, or messy handwriting.
- Keep copy short: usually 2 to 6 words per scene.
- Avoid persistent caption rails and avoid glitchy effects.`,
};

export type TextMotionGenerateInput = z.infer<typeof textMotionGenerateInputSchema>;

export const generateTextMotionProject = async ({
  prompt,
  aspect,
  template,
}: TextMotionGenerateInput) => {
  const result = await generateObject({
    model: openai("gpt-4o-mini"),
    system: SYSTEM_PROMPT,
    schema: textMotionGenerationSchema,
    prompt: `Create an AI text motion storyboard for aspect ${aspect} using template ${template}.
User intent: ${prompt}

${TEMPLATE_GUIDANCE[template]}

Constraints:
- 2 to 12 scenes.
- Strong pacing for social platforms.
- Short lines with varied rhythm.
- Use motion animations to emphasize key words.
- Every scene must include "accentWord" as a string. Use an empty string when no accent word is needed.
- Every scene must include:
  - "fontFamily": one of "sans" | "serif" | "mono" | "display" | "condensed" | "slab" | "modern"
  - "fontWeight": 100..900
  - "fontStyle": "normal" | "italic"
- Every scene must include "keepOnScreen": true/false.
- Set keepOnScreen=true for many key lines so they stay as small left-side captions in later scenes.
- Use these animations frequently: "slide-left", "slide-right", "wipe", "zoom-spin", "bounce", "pop".
- Use "glitch" sparingly (0 to 2 scenes max).
- Keep fonts readable for mobile. Never use script/cursive styles.`,
  });

  return generationToProject(result.object, aspect, template);
};
