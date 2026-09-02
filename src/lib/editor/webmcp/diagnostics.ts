import { ASPECT_PRESETS, MAX_DURATION_FRAMES } from "../constants";
import { getVersionRenderDurationInFrames } from "../timeline";
import type {
  AspectPreset,
  AssetRef,
  VersionTimeline,
} from "../types";

export type EditorValidationSeverity = "error" | "warning" | "info";

export interface EditorValidationIssue {
  code: string;
  severity: EditorValidationSeverity;
  message: string;
  entityId?: string;
  frame?: number;
  fixable: boolean;
  suggestedAction?: string;
}

export interface EditorValidationReport {
  aspect: AspectPreset;
  readyForExport: boolean;
  durationInFrames: number;
  durationSeconds: number;
  counts: {
    errors: number;
    warnings: number;
    info: number;
    clips: number;
    textOverlays: number;
    audioTracks: number;
    transitions: number;
  };
  issues: EditorValidationIssue[];
}

const issue = (
  code: string,
  severity: EditorValidationSeverity,
  message: string,
  details: Pick<EditorValidationIssue, "entityId" | "frame"> = {},
): EditorValidationIssue => ({
  code,
  severity,
  message,
  ...details,
  fixable: [
    "legacy-text-preset",
    "unsafe-text-position",
    "small-text",
    "text-after-visual",
    "motion-too-long",
  ].includes(code),
  suggestedAction: [
    "legacy-text-preset",
    "unsafe-text-position",
    "small-text",
    "text-after-visual",
    "motion-too-long",
  ].includes(code)
    ? "Run editor_auto_fix_project with confirmed: true."
    : undefined,
});

export interface EditorAutoFixChange {
  entityId: string;
  field: string;
  from: unknown;
  to: unknown;
  reason: string;
}

export interface EditorAutoFixResult {
  version: VersionTimeline;
  changes: EditorAutoFixChange[];
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

/**
 * Apply conservative, deterministic corrections that do not remove media or
 * rewrite authored copy. Ambiguous problems remain visible in validation.
 */
export const autoFixEditorVersion = (
  version: VersionTimeline,
): EditorAutoFixResult => {
  const changes: EditorAutoFixChange[] = [];
  const visualEndFrame = version.clips.reduce(
    (maximum, clip) => Math.max(maximum, clip.endFrame),
    0,
  );
  const minimumReadableSize = version.aspect === "reel_9_16" ? 32 : 24;

  const textOverlays = version.textOverlays.map((overlay) => {
    const next = { ...overlay };
    const set = (field: string, value: unknown, reason: string) => {
      const previous = next[field as keyof typeof next];
      if (Object.is(previous, value)) return;
      changes.push({ entityId: overlay.id, field, from: previous, to: value, reason });
      Object.assign(next, { [field]: value });
    };

    set("x", clamp(next.x, 6, 94), "Move text into the horizontal safe area.");
    set("y", clamp(next.y, 8, 90), "Move text into the vertical safe area.");
    set(
      "fontSize",
      Math.max(minimumReadableSize, next.fontSize),
      "Raise text to the minimum readable size for this canvas.",
    );
    if (next.stylePreset !== "classic") {
      set("stylePreset", "classic", "Use the text style with complete Elah preview/export parity.");
    }
    if (
      visualEndFrame > 0 &&
      next.endFrame > visualEndFrame &&
      next.startFrame < visualEndFrame
    ) {
      set("endFrame", visualEndFrame, "End text with the final visual frame.");
    }
    if (next.animation) {
      const visibleFrames = Math.max(1, next.endFrame - next.startFrame);
      const maximumMotionFrames = Math.max(1, Math.floor(visibleFrames / 2));
      if (next.animation.durationFrames > maximumMotionFrames) {
        set(
          "animation",
          { ...next.animation, durationFrames: maximumMotionFrames },
          "Keep entrance and exit motion within the visible text duration.",
        );
      }
    }
    return next;
  });

  return {
    version: { ...version, textOverlays },
    changes,
  };
};

export const validateEditorVersion = (
  version: VersionTimeline,
  assets: readonly AssetRef[],
): EditorValidationReport => {
  const issues: EditorValidationIssue[] = [];
  const assetIds = new Set(assets.map((asset) => asset.assetId));
  const preset = ASPECT_PRESETS[version.aspect];
  let durationInFrames = 1;

  try {
    durationInFrames = getVersionRenderDurationInFrames(version);
  } catch {
    issues.push(issue("invalid-timeline", "error", "The visual timeline could not be resolved."));
  }

  if (version.clips.length === 0 && version.textOverlays.length === 0) {
    issues.push(issue("empty-canvas", "error", "Add a visual clip or text overlay before export."));
  }

  if (durationInFrames > MAX_DURATION_FRAMES) {
    issues.push(
      issue(
        "duration-limit",
        "error",
        `The timeline is ${durationInFrames - MAX_DURATION_FRAMES} frames over the 60 second limit.`,
      ),
    );
  }

  const orderedClips = [...version.clips].sort((left, right) => left.startFrame - right.startFrame);
  orderedClips.forEach((clip, index) => {
    if (!assetIds.has(clip.assetId)) {
      issues.push(
        issue("missing-asset", "error", `Clip ${clip.id} references a missing asset.`, {
          entityId: clip.id,
          frame: clip.startFrame,
        }),
      );
    }
    if (clip.endFrame <= clip.startFrame || clip.trimEndFrame <= clip.trimStartFrame) {
      issues.push(
        issue("invalid-clip-range", "error", `Clip ${clip.id} has an invalid time range.`, {
          entityId: clip.id,
          frame: clip.startFrame,
        }),
      );
    }
    const previous = orderedClips[index - 1];
    if (previous && clip.startFrame > previous.endFrame) {
      issues.push(
        issue(
          "visual-gap",
          "warning",
          `There is a ${clip.startFrame - previous.endFrame} frame gap before clip ${clip.id}.`,
          { entityId: clip.id, frame: previous.endFrame },
        ),
      );
    }
    if (previous && clip.startFrame < previous.endFrame) {
      issues.push(
        issue(
          "visual-overlap",
          "warning",
          `Clip ${clip.id} overlaps ${previous.id} outside a transition.`,
          { entityId: clip.id, frame: clip.startFrame },
        ),
      );
    }
  });

  const visualEndFrame = orderedClips.reduce((maximum, clip) => Math.max(maximum, clip.endFrame), 0);
  version.textOverlays.forEach((overlay) => {
    if (!overlay.text.trim()) {
      issues.push(
        issue("empty-text", "error", `Text overlay ${overlay.id} is empty.`, {
          entityId: overlay.id,
          frame: overlay.startFrame,
        }),
      );
    }
    if (overlay.stylePreset !== "classic") {
      issues.push(
        issue(
          "legacy-text-preset",
          "warning",
          `Text overlay ${overlay.id} uses ${overlay.stylePreset}; only classic has complete Elah parity.`,
          { entityId: overlay.id, frame: overlay.startFrame },
        ),
      );
    }
    if (overlay.x < 6 || overlay.x > 94 || overlay.y < 8 || overlay.y > 90) {
      issues.push(
        issue(
          "unsafe-text-position",
          "warning",
          `Text overlay ${overlay.id} is close to the canvas edge and may be cropped by platform UI.`,
          { entityId: overlay.id, frame: overlay.startFrame },
        ),
      );
    }
    const minimumReadableSize = version.aspect === "reel_9_16" ? 32 : 24;
    if (overlay.fontSize < minimumReadableSize) {
      issues.push(
        issue(
          "small-text",
          "warning",
          `Text overlay ${overlay.id} may be hard to read at ${overlay.fontSize}px.`,
          { entityId: overlay.id, frame: overlay.startFrame },
        ),
      );
    }
    const approximateCharactersPerLine = Math.max(
      1,
      Math.floor((preset.width * 0.9) / (overlay.fontSize * 0.56)),
    );
    const estimatedWrappedLineCount = overlay.text
      .split("\n")
      .reduce(
        (count, line) =>
          count + Math.max(1, Math.ceil(line.length / approximateCharactersPerLine)),
        0,
      );
    const estimatedTextHeight = estimatedWrappedLineCount * overlay.fontSize * 1.2;
    if (estimatedTextHeight > preset.height * 0.72) {
      issues.push(
        issue(
          "possible-text-overflow",
          "warning",
          `Text overlay ${overlay.id} may wrap beyond the safe canvas height. Shorten the copy or reduce its size.`,
          { entityId: overlay.id, frame: overlay.startFrame },
        ),
      );
    }
    if (visualEndFrame > 0 && overlay.endFrame > visualEndFrame) {
      issues.push(
        issue(
          "text-after-visual",
          "warning",
          `Text overlay ${overlay.id} continues after the last visual clip.`,
          { entityId: overlay.id, frame: visualEndFrame },
        ),
      );
    }
    const overlayDuration = overlay.endFrame - overlay.startFrame;
    if (overlay.animation && overlay.animation.durationFrames * 2 > overlayDuration) {
      issues.push(
        issue(
          "motion-too-long",
          "warning",
          `Text motion on ${overlay.id} consumes more than half of its visible duration.`,
          { entityId: overlay.id, frame: overlay.startFrame },
        ),
      );
    }
  });

  version.audioTracks.forEach((track) => {
    if (!assetIds.has(track.assetId)) {
      issues.push(
        issue("missing-audio-asset", "error", `Audio track ${track.id} references a missing asset.`, {
          entityId: track.id,
          frame: track.startFrame,
        }),
      );
    }
  });

  const clipIndex = new Map(version.clips.map((clip, index) => [clip.id, index]));
  version.transitions.forEach((transition) => {
    const fromIndex = clipIndex.get(transition.fromClipId);
    const toIndex = clipIndex.get(transition.toClipId);
    if (fromIndex === undefined || toIndex === undefined || toIndex !== fromIndex + 1) {
      issues.push(
        issue(
          "invalid-transition-edge",
          "error",
          `Transition ${transition.id} must connect adjacent visual clips.`,
          { entityId: transition.id },
        ),
      );
    }
  });

  const errors = issues.filter((item) => item.severity === "error").length;
  const warnings = issues.filter((item) => item.severity === "warning").length;
  const info = issues.filter((item) => item.severity === "info").length;

  return {
    aspect: version.aspect,
    readyForExport: errors === 0,
    durationInFrames,
    durationSeconds: Number((durationInFrames / preset.fps).toFixed(3)),
    counts: {
      errors,
      warnings,
      info,
      clips: version.clips.length,
      textOverlays: version.textOverlays.length,
      audioTracks: version.audioTracks.length,
      transitions: version.transitions.length,
    },
    issues,
  };
};

export const inspectEditorFrame = (
  version: VersionTimeline,
  frame: number,
) => ({
  aspect: version.aspect,
  frame,
  seconds: Number((frame / ASPECT_PRESETS[version.aspect].fps).toFixed(3)),
  activeClips: version.clips
    .filter((clip) => frame >= clip.startFrame && frame < clip.endFrame)
    .map(({ id, assetId, kind, startFrame, endFrame }) => ({
      id,
      assetId,
      kind,
      startFrame,
      endFrame,
    })),
  activeTextOverlays: version.textOverlays
    .filter((overlay) => frame >= overlay.startFrame && frame < overlay.endFrame)
    .map(({ id, text, x, y, fontSize, color, animation }) => ({
      id,
      text: text.slice(0, 240),
      x,
      y,
      fontSize,
      color,
      animation,
    })),
  activeAudioTracks: version.audioTracks
    .filter((track) => frame >= track.startFrame && frame < track.endFrame)
    .map(({ id, assetId, volume, muted }) => ({ id, assetId, volume, muted: muted ?? false })),
  activeTransitions: version.transitions
    .filter((transition) => {
      const toClip = version.clips.find((clip) => clip.id === transition.toClipId);
      if (!toClip) return false;
      const start = toClip.startFrame - Math.floor(transition.durationInFrames / 2);
      return frame >= start && frame < start + transition.durationInFrames;
    })
    .map(({ id, kind, fromClipId, toClipId, durationInFrames, direction, easing }) => ({
      id,
      kind: kind ?? "fade",
      fromClipId,
      toClipId,
      durationInFrames,
      direction,
      easing,
    })),
});
