import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

const SYSTEM_PROMPT = `You are an assistant embedded inside a video editor.
Focus on practical help for short-form video creation, timeline decisions, caption ideas,
and export settings for 9:16 and 16:9 formats. Keep answers concise and actionable.

When the user asks you to apply/edit/build the timeline (for example: "do it", "apply it", "make this reel"),
include a machine-readable block in this exact format:
[[EDITOR_ACTIONS]]
{"targetAspect":"active","scenes":[{"text":"...","durationSeconds":4}],"transitionSeconds":0}
[[/EDITOR_ACTIONS]]

Rules for EDITOR_ACTIONS:
- Output valid minified JSON only (no markdown fence).
- Keep 3 to 12 scenes.
- Each scene must include at least "text". Use durationSeconds when useful.
- Keep each scene text punchy (about 2 to 8 words) and never leave unfinished phrases.
- When style is requested, set scene-level font fields:
  - "fontFamily": one of "sans" | "serif" | "mono"
  - "fontWeight": 100..900
  - "fontStyle": "normal" | "italic"
  - "textAlign": "left" | "center" | "right"
- Give every scene purposeful motion with "animation":
  - "in": "fade" | "rise" | "slide-left" | "punch" | "typewriter" | "word-reveal"
  - "out": use "fade" for most scenes; use "rise", "slide-left", or "punch" sparingly
  - "durationSeconds": 0.2 for snap, 0.4 for smooth, or 0.65 for cinematic pacing
- Prefer punch for short headlines, rise for supporting copy, and word-reveal for paced statements. Avoid typewriter on long centered text.
- Use "stylePreset":"classic" for every scene; it is the Elah-native style with preview/export parity.
- Build visual variety with font size, font family, alignment, color, placement, and animation rather than legacy structured preset identifiers.
- Do not emit chart, map, timeline, dictionary, gallery, or other serialized preset payloads.
- For motion typography requests, every scene should include: stylePreset, x, y, fontSize, fontFamily, fontWeight, textAlign, and animation.
- Keep essential reel copy at fontSize 48 or larger. Use 32 only for short supporting details.
- Never use cursive/script/handwritten font suggestions.
- Use y in safe area (roughly 30..74) unless user explicitly asks for edge placement.
- Default transitionSeconds to 0 unless the user explicitly asks for crossfades.
- Use targetAspect "active" unless the user explicitly requests 9:16 or 16:9.

Behavior:
- If user intent is to apply/build/do the edit now, always include EDITOR_ACTIONS.
- Do not reply with generic tutorial steps when the user asks to "do it", "apply it", or "render now".
- If EDITOR_ACTIONS is present, keep non-JSON assistant prose to at most one short sentence.

If and only if the user explicitly asks to render/export the video now, append this exact token on its own line at the end:
[[RENDER_VIDEO]]

If they ask to both apply edits and render, include both: EDITOR_ACTIONS block first, then [[RENDER_VIDEO]].
If they ask to render/export now and the conversation already contains a concrete storyboard or scene plan,
include EDITOR_ACTIONS before [[RENDER_VIDEO]] so the timeline can be auto-applied first.
Do not output either directive in other situations.`;

export interface EditorContextPayload {
  activeAspect: "reel_9_16" | "widescreen_16_9";
  timelineDurationInFrames: number;
  timelineDurationSeconds: number;
  clipCount: number;
  textOverlayCount: number;
  audioTrackCount: number;
  assetCount: number;
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
};

export const parseEditorContext = (value: unknown): EditorContextPayload | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    candidate.activeAspect !== "reel_9_16" &&
    candidate.activeAspect !== "widescreen_16_9"
  ) {
    return null;
  }

  const timelineDurationInFrames = toFiniteNumber(candidate.timelineDurationInFrames);
  const timelineDurationSeconds = toFiniteNumber(candidate.timelineDurationSeconds);
  const clipCount = toFiniteNumber(candidate.clipCount);
  const textOverlayCount = toFiniteNumber(candidate.textOverlayCount);
  const audioTrackCount = toFiniteNumber(candidate.audioTrackCount);
  const assetCount = toFiniteNumber(candidate.assetCount);

  if (
    timelineDurationInFrames === null ||
    timelineDurationSeconds === null ||
    clipCount === null ||
    textOverlayCount === null ||
    audioTrackCount === null ||
    assetCount === null
  ) {
    return null;
  }

  return {
    activeAspect: candidate.activeAspect,
    timelineDurationInFrames: Math.max(0, Math.round(timelineDurationInFrames)),
    timelineDurationSeconds: Math.max(0, timelineDurationSeconds),
    clipCount: Math.max(0, Math.round(clipCount)),
    textOverlayCount: Math.max(0, Math.round(textOverlayCount)),
    audioTrackCount: Math.max(0, Math.round(audioTrackCount)),
    assetCount: Math.max(0, Math.round(assetCount)),
  };
};

export const buildEditorContextPrompt = (
  editorContext: EditorContextPayload | null,
): string => {
  if (!editorContext) {
    return "";
  }

  const remainingSeconds = Math.max(0, 60 - editorContext.timelineDurationSeconds);

  return `Current editor context:
- activeAspect: ${editorContext.activeAspect}
- timelineDurationSeconds: ${editorContext.timelineDurationSeconds.toFixed(2)}
- timelineDurationFrames: ${editorContext.timelineDurationInFrames}
- remainingSecondsTo60: ${remainingSeconds.toFixed(2)}
- clipCount: ${editorContext.clipCount}
- textOverlayCount: ${editorContext.textOverlayCount}
- audioTrackCount: ${editorContext.audioTrackCount}
- assetCount: ${editorContext.assetCount}

Use this context when suggesting edits, scene timing, and export actions.`;
};

export const streamEditorChat = async ({
  messages,
  editorContext,
}: {
  messages: UIMessage[];
  editorContext: EditorContextPayload | null;
}) => {
  const modelMessages = await convertToModelMessages(messages);

  return streamText({
    model: openai("gpt-4o-mini"),
    system: `${SYSTEM_PROMPT}\n\n${buildEditorContextPrompt(editorContext)}`.trim(),
    messages: modelMessages,
  });
};
