import { FPS, MAX_DURATION_FRAMES } from "./constants";

/** Plain caption text on an exclusive-end, project-frame interval. */
export interface CaptionCue {
  id: string;
  trackId: string;
  startFrame: number;
  endFrame: number;
  text: string;
}

export interface CaptionIssue {
  code: "INVALID_CUE" | "DUPLICATE_ID" | "OVERLAP" | "MALFORMED" | "UNSUPPORTED";
  message: string;
  cueIndex?: number;
}

export type CaptionValidationResult =
  | { ok: true; cues: CaptionCue[] }
  | { ok: false; issues: CaptionIssue[] };

/** Validate the entire replacement batch; never return a partially valid import. */
export const validateCaptionCues = (cues: readonly CaptionCue[]): CaptionValidationResult => {
  const issues: CaptionIssue[] = [];
  const ids = new Set<string>();
  const byTrack = new Map<string, Array<{ cue: CaptionCue; index: number }>>();
  cues.forEach((cue, index) => {
    if (!cue.id.trim() || !cue.trackId.trim() || !cue.text.trim() ||
      !Number.isInteger(cue.startFrame) || !Number.isInteger(cue.endFrame) ||
      cue.startFrame < 0 || cue.endFrame <= cue.startFrame ||
      cue.endFrame > MAX_DURATION_FRAMES) {
      issues.push({ code: "INVALID_CUE", cueIndex: index, message: `Cue ${index + 1} needs IDs, text, and a valid frame range within ${MAX_DURATION_FRAMES} frames.` });
    }
    if (ids.has(cue.id)) {
      issues.push({ code: "DUPLICATE_ID", cueIndex: index, message: `Duplicate caption ID: ${cue.id}.` });
    }
    ids.add(cue.id);
    const track = byTrack.get(cue.trackId) ?? [];
    track.push({ cue, index });
    byTrack.set(cue.trackId, track);
  });
  for (const entries of byTrack.values()) {
    entries.sort((a, b) => a.cue.startFrame - b.cue.startFrame || a.index - b.index);
    let latestEnd = -1;
    for (const { cue, index } of entries) {
      if (cue.startFrame < latestEnd) {
        issues.push({ code: "OVERLAP", cueIndex: index, message: `Cue ${index + 1} overlaps another caption on track ${cue.trackId}.` });
      }
      latestEnd = Math.max(latestEnd, cue.endFrame);
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, cues: cues.map((cue) => ({ ...cue })) };
};

const timestampMs = (value: string, format: "srt" | "vtt"): number | null => {
  const match = format === "srt"
    ? /^(\d{2,}):([0-5]\d):([0-5]\d),(\d{3})$/.exec(value)
    : /^(?:(\d{2,}):)?([0-5]\d):([0-5]\d)\.(\d{3})$/.exec(value);
  if (!match) return null;
  const result = ((Number(match[1] ?? 0) * 60 + Number(match[2])) * 60 + Number(match[3])) * 1000 + Number(match[4]);
  return Number.isSafeInteger(result) ? result : null;
};

export interface CaptionImportInput {
  format: "srt" | "vtt";
  content: string;
  trackId: string;
  idPrefix: string;
}

/**
 * Import plain SRT/WebVTT atomically. Start timestamps round down and end
 * timestamps round up to 30-fps frames. Quantized collisions are errors.
 * Settings, markup, styling, and metadata are reported rather than discarded.
 */
export const importCaptions = ({ format, content, trackId, idPrefix }: CaptionImportInput): CaptionValidationResult => {
  const issues: CaptionIssue[] = [];
  if (!trackId.trim() || !idPrefix.trim()) {
    return { ok: false, issues: [{ code: "INVALID_CUE", message: "A caption track ID and cue ID prefix are required." }] };
  }
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  const blocks = normalized ? normalized.split(/\n[ \t]*\n/) : [];
  if (format === "vtt") {
    const header = blocks.shift();
    if (header !== "WEBVTT") {
      return { ok: false, issues: [{ code: "MALFORMED", message: "WebVTT requires a WEBVTT header followed by a blank line; header metadata is unsupported." }] };
    }
  }
  if (!blocks.length) {
    return { ok: false, issues: [{ code: "MALFORMED", message: "No caption cues were found." }] };
  }
  const cues: CaptionCue[] = [];
  blocks.forEach((block, cueIndex) => {
    const lines = block.split("\n");
    if (format === "vtt" && /^(NOTE(?:\s|$)|STYLE(?:\s|$)|REGION(?:\s|$))/.test(lines[0])) {
      issues.push({ code: "UNSUPPORTED", cueIndex, message: `Block ${cueIndex + 1} contains unsupported WebVTT metadata or styling.` });
      return;
    }
    let timingIndex = 0;
    if (!lines[0].includes("-->")) {
      if (format === "srt" && !/^\d+$/.test(lines[0].trim())) {
        issues.push({ code: "MALFORMED", cueIndex, message: `Cue ${cueIndex + 1} has an invalid SRT sequence number.` });
        return;
      }
      timingIndex = 1;
    }
    const timing = /^(\S+)\s+-->\s+(\S+)(.*)$/.exec(lines[timingIndex] ?? "");
    const startMs = timing ? timestampMs(timing[1], format) : null;
    const endMs = timing ? timestampMs(timing[2], format) : null;
    if (startMs === null || endMs === null || endMs <= startMs) {
      issues.push({ code: "MALFORMED", cueIndex, message: `Cue ${cueIndex + 1} needs valid timestamps and positive source duration.` });
      return;
    }
    if (timing?.[3].trim()) {
      issues.push({ code: "UNSUPPORTED", cueIndex, message: `Cue ${cueIndex + 1} uses unsupported caption positioning or settings.` });
      return;
    }
    const text = lines.slice(timingIndex + 1).join("\n").trim();
    if (/<[^>]*>|&(?:#\w+|\w+);/.test(text)) {
      issues.push({ code: "UNSUPPORTED", cueIndex, message: `Cue ${cueIndex + 1} contains markup or escaped entities; provide plain caption text.` });
      return;
    }
    cues.push({
      id: `${idPrefix}-${cueIndex + 1}`,
      trackId,
      startFrame: Math.floor(startMs * FPS / 1000),
      endFrame: Math.ceil(endMs * FPS / 1000),
      text,
    });
  });
  const validation = validateCaptionCues(cues);
  if (!validation.ok) issues.push(...validation.issues);
  return issues.length ? { ok: false, issues } : { ok: true, cues };
};
