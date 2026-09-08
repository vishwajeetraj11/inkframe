import { describe, expect, it } from "vitest";
import { parseWhisperTranscript, transcriptToCaptionCues, transcriptionClipFingerprint } from "@/lib/editor/local-transcription";
import type { Clip } from "@/lib/editor/types";

const clip: Clip = { id: "clip", assetId: "asset", kind: "video", startFrame: 30, endFrame: 120, trimStartFrame: 0, trimEndFrame: 90, volume: 1 };

describe("local transcription", () => {
  it("parses Whisper segments and word entries", () => {
    expect(parseWhisperTranscript(JSON.stringify({ segments: [{ start: 0, end: 1.01, text: " Hello " }] }))).toEqual({ segments: [{ start: 0, end: 1.01, text: "Hello" }] });
    expect(parseWhisperTranscript(JSON.stringify({ words: [{ start: 0, end: .2, word: "Hi" }] })).segments[0].text).toBe("Hi");
  });
  it.each([JSON.stringify({ segments: [{ start: -1, end: 1, text: "x" }] }), JSON.stringify({ segments: [{ start: 1, end: 2, text: "x" }, { start: 1.5, end: 3, text: "y" }] }), JSON.stringify({ segments: [{ start: 0, end: 1, text: " " }] })])("rejects malformed transcript", (value) => expect(() => parseWhisperTranscript(value)).toThrow());
  it("quantizes clip-local seconds and keeps IDs stable", () => {
    expect(transcriptToCaptionCues({ content: JSON.stringify({ segments: [{ start: .05, end: 1.05, text: "Hello" }] }), clip, trackId: "captions", idPrefix: "whisper" })).toEqual([{ id: "whisper-1", trackId: "captions", startFrame: 31, endFrame: 62, text: "Hello" }]);
  });
  it("rejects retimed, non-video, and out-of-bounds clips", () => {
    const input = { content: JSON.stringify({ segments: [{ start: 0, end: 1, text: "x" }] }), trackId: "c", idPrefix: "x" };
    expect(() => transcriptToCaptionCues({ ...input, clip: { ...clip, kind: "image" } })).toThrow();
    expect(() => transcriptToCaptionCues({ ...input, clip: { ...clip, timeMapping: { kind: "hold", sourceTimeUs: 0 } } })).toThrow();
    expect(() => transcriptToCaptionCues({ ...input, clip, content: JSON.stringify({ segments: [{ start: 0, end: 4, text: "x" }] }) })).toThrow();
  });
  it("fingerprint changes when source identity or timing changes", () => {
    expect(transcriptionClipFingerprint(clip)).toBe(transcriptionClipFingerprint({ ...clip }));
    expect(transcriptionClipFingerprint(clip)).not.toBe(transcriptionClipFingerprint({ ...clip, trimEndFrame: 89 }));
    expect(transcriptionClipFingerprint(clip)).not.toBe(transcriptionClipFingerprint({ ...clip, startFrame: 31 }));
  });
});
