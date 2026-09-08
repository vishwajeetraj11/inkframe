import { FPS } from "./constants";
import { validateCaptionCues, type CaptionCue } from "./captions";
import type { Clip } from "./types";

const MAX_CONTENT_CHARS = 200_000;
const MAX_SEGMENTS = 1_000;
const FRAME_TOLERANCE_SECONDS = 1 / FPS;

export interface WhisperTranscriptSegment {
  start: number;
  end: number;
  text: string;
}

const fail = (message: string): never => { throw new Error(`Invalid Whisper transcript: ${message}`); };

/** Parse the deliberately small, local-Whisper JSON interchange format. */
export const parseWhisperTranscript = (content: string): { segments: WhisperTranscriptSegment[] } => {
  if (typeof content !== "string" || content.length > MAX_CONTENT_CHARS) fail("content is missing or exceeds 200,000 characters.");
  let value: unknown;
  try { value = JSON.parse(content); } catch { fail("content is not valid JSON."); }

  const root = value as unknown;
  let entries: unknown[] | undefined;
  if (Array.isArray(root)) entries = root;
  else if (root && typeof root === "object") {
    const object = root as Record<string, unknown>;
    if (Array.isArray(object.segments)) entries = object.segments;
    else if (Array.isArray(object.words)) entries = object.words;
  }
  const safeEntries = entries ?? fail("a non-empty segments or words array is required.");
  if (safeEntries.length === 0) fail("a non-empty segments or words array is required.");
  if (safeEntries.length > MAX_SEGMENTS) fail("at most 1,000 entries are supported.");

  const segments: WhisperTranscriptSegment[] = [];
  let previousEnd = 0;
  safeEntries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") fail(`entry ${index + 1} is malformed.`);
    const item = entry as Record<string, unknown>;
    const start = item.start;
    const end = item.end;
    const startNumber = typeof start === "number" ? start : Number.NaN;
    const endNumber = typeof end === "number" ? end : Number.NaN;
    if (!Number.isFinite(startNumber) || !Number.isFinite(endNumber) || startNumber < 0 || endNumber <= startNumber) fail(`entry ${index + 1} has invalid timing.`);
    if (index > 0 && startNumber < previousEnd) fail(`entry ${index + 1} is overlapping or out of order.`);
    const words = Array.isArray(item.words) ? item.words : [];
    const wordText = words.map((word) => word && typeof word === "object" && typeof (word as Record<string, unknown>).word === "string" ? (word as Record<string, unknown>).word as string : "").join("");
    const text = typeof item.text === "string" ? item.text.trim()
      : typeof item.word === "string" ? item.word.trim() : wordText.trim();
    if (!text) fail(`entry ${index + 1} has empty text.`);
    if (text.length > 4000) fail(`entry ${index + 1} text exceeds 4,000 characters.`);
    segments.push({ start: startNumber, end: endNumber, text });
    previousEnd = endNumber;
  });
  return { segments };
};

export interface TranscriptCueInput {
  content: string;
  clip: Clip;
  trackId: string;
  idPrefix: string;
}

/** Convert clip-local transcript seconds into exclusive-end project frames. */
export const transcriptToCaptionCues = ({ content, clip, trackId, idPrefix }: TranscriptCueInput): CaptionCue[] => {
  if (clip.kind !== "video") throw new Error("Transcript captions require a video clip.");
  if (clip.timeMapping && clip.timeMapping.kind !== "normal") throw new Error("Transcript captions require normal playback.");
  if (!trackId.trim() || !idPrefix.trim()) throw new Error("Transcript captions require a track ID and ID prefix.");
  if (!Number.isInteger(clip.startFrame) || !Number.isInteger(clip.endFrame) || clip.endFrame <= clip.startFrame) throw new Error("Transcript clip has an invalid frame range.");
  const parsed = parseWhisperTranscript(content);
  const durationFrames = clip.endFrame - clip.startFrame;
  const durationSeconds = durationFrames / FPS;
  const raw: CaptionCue[] = [];
  for (const [index, segment] of parsed.segments.entries()) {
    if (segment.start < -FRAME_TOLERANCE_SECONDS || segment.end > durationSeconds + FRAME_TOLERANCE_SECONDS) throw new Error(`Transcript entry ${index + 1} falls outside the clip.`);
    const localStart = Math.max(0, segment.start);
    const localEnd = Math.min(durationSeconds, segment.end);
    const startFrame = clip.startFrame + Math.floor(localStart * FPS + 1e-9);
    const endFrame = clip.startFrame + Math.ceil(localEnd * FPS - 1e-9);
    if (endFrame <= startFrame) throw new Error(`Transcript entry ${index + 1} is too short after frame quantization.`);
    raw.push({ id: `${idPrefix}-${index + 1}`, trackId, startFrame, endFrame, text: segment.text });
  }
  // Quantization can make two source-adjacent ranges overlap. Preserve both only
  // when trimming the previous exclusive end leaves a positive interval.
  for (let index = 1; index < raw.length; index += 1) {
    if (raw[index].startFrame < raw[index - 1].endFrame) {
      const cappedEnd = raw[index].startFrame;
      if (cappedEnd <= raw[index - 1].startFrame) throw new Error("Transcript captions overlap after frame quantization.");
      raw[index - 1] = { ...raw[index - 1], endFrame: cappedEnd };
    }
  }
  const validation = validateCaptionCues(raw);
  if (!validation.ok) throw new Error(validation.issues[0]?.message ?? "Invalid transcript captions.");
  return validation.cues;
};

export const transcriptionClipFingerprint = (clip: Clip): string => JSON.stringify({
  id: clip.id,
  assetId: clip.assetId,
  startFrame: clip.startFrame,
  endFrame: clip.endFrame,
  trimStartFrame: clip.trimStartFrame,
  trimEndFrame: clip.trimEndFrame,
  timeMapping: clip.timeMapping ?? null,
});
