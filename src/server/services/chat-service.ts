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
- Keep 3 to 12 scenes, unless the user explicitly asks for a single standalone chart card, stat ring card, or dictionary-style opener.
- Each scene must include at least "text". Use durationSeconds when useful.
- Keep each scene text punchy (about 2 to 8 words) and never leave unfinished phrases, except for structured chart-card, editorial-bar-chart, editorial-stat-ring, or createdaley-opener scenes.
- When style is requested, set scene-level font fields:
  - "fontFamily": one of "sans" | "serif" | "mono"
  - "fontWeight": 100..900
  - "fontStyle": "normal" | "italic"
- For kinetic references, set "stylePreset" per scene:
  - "classic" | "impact-grid" | "grid-kinetic" | "hero-slam" | "sticker-cutout" | "editorial-mono" | "vox-explainer" | "vox-timeline" | "vox-timeline-ribbon" | "vox-timeline-ledger" | "vox-typography" | "world-map-focus" | "editorial-bar-chart" | "editorial-stat-ring" | "editorial-seat-arc" | "createdaley-opener" | "chart-card" | "news-clipping"
- If the user asks for a Vox or editorial explainer look, prefer "vox-explainer".
- If the user asks for an image-led historical chronology, documentary timeline, or archival-event sequence, prefer "vox-timeline".
- If the user asks for a lower-third chronology strip or ribbon timeline, prefer "vox-timeline-ribbon".
- If the user asks for a ledger timeline, dossier chronology, or stacked archival timeline, prefer "vox-timeline-ledger".
- If the user asks for a typography opener, typewriter editorial look, or Vox typography look, prefer "vox-typography".
- If the user asks for a world map, atlas map, or country highlight map, prefer "world-map-focus".
- If the user asks for a clean editorial bar-chart look, prefer "editorial-bar-chart".
- If the user asks for a percentage ring, consensus card, or stat ring card, prefer "editorial-stat-ring".
- If the user asks for a parliament chart, semicircle seat chart, or balance-of-power graphic, prefer "editorial-seat-arc".
- If the user asks for a dictionary animation, dictionary-style opener, definition card, or paper-definition card, prefer "createdaley-opener".
- If the user asks for a pie chart, chart explainer, infographic, or data-viz card, prefer "chart-card".
- For dynamic reels, alternate stylePreset values across scenes instead of using one style everywhere, unless the user explicitly requests a specific preset.
- For motion typography requests, every scene should include: stylePreset, x, y, fontSize, fontFamily, fontWeight.
- For dictionary animation scenes, "text" may be structured multiline content:
  - line 1: wordmark
  - line 2: pronunciation without brackets
  - line 3: part of speech
  - line 4+: definition text
- For chart-card scenes, "text" may be structured multiline content:
  - line 1: headline
  - line 2: subhead
  - line 3+: rows formatted as Label|Value|Color
- "editorial-seat-arc" uses the same structured multiline chart format as "chart-card".
- For editorial-stat-ring scenes, "text" may be structured multiline content:
  - line 1: headline (optionally with [[highlight phrase]])
  - line 2: subhead or source line
  - line 3: Value|Suffix|Color
- For world-map-focus scenes, "text" may be structured multiline content:
  - line 1: headline
  - line 2: subhead
  - line 3: COUNTRY: Country Name
- For editorial-bar-chart scenes, "text" may be structured multiline content:
  - line 1: headline
  - line 2: subhead
  - line 3+: rows formatted as Label|Value|Color (values in 0..100)
- For timeline scenes ("vox-timeline", "vox-timeline-ribbon", "vox-timeline-ledger"), "text" may be structured multiline content:
  - line 1: kicker
  - line 2: headline
  - line 3+: rows formatted as Date|Title|Caption|focus
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
