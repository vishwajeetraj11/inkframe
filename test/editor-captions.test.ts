import { describe, expect, it } from "vitest";
import { importCaptions, validateCaptionCues, type CaptionCue } from "@/lib/editor/captions";

const parse = (content: string, format: "srt" | "vtt" = "srt") => importCaptions({ content, format, trackId: "captions", idPrefix: "import" });
const cue = (id: string, startFrame: number, endFrame: number, trackId = "captions"): CaptionCue => ({ id, startFrame, endFrame, trackId, text: "Hello" });

describe("caption import", () => {
  it("quantizes once with floor starts and ceil ends, preserving multiline plain text", () => {
    expect(parse("\uFEFF1\r\n00:00:00,050 --> 00:00:01,050\r\nHello\r\nworld\r\n\r\n2\r\n00:00:02,000 --> 00:00:03,000\r\nSecond"))
      .toEqual({ ok: true, cues: [
        { ...cue("import-1", 1, 32), text: "Hello\nworld" },
        { ...cue("import-2", 60, 90), text: "Second" },
      ] });
  });
  it("supports WebVTT identifiers and short or full timestamps deterministically", () => {
    const input = "WEBVTT\n\nopening\n00:00.000 --> 00:01.000\nFirst\n\n00:00:01.000 --> 00:00:02.000\nSecond";
    const result = parse(input, "vtt");
    expect(result.ok).toBe(true);
    expect(result).toEqual(parse(input, "vtt"));
    if (result.ok) expect(result.cues.map((item) => [item.id, item.startFrame, item.endFrame])).toEqual([["import-1", 0, 30], ["import-2", 30, 60]]);
  });
  it.each([
    "1\n00:00:01,000 --> 00:00:01,000\nZero",
    "1\n00:00:02,000 --> 00:00:01,000\nReverse",
    "1\n00:60:00,000 --> 00:60:01,000\nBad timestamp",
    "1\n00:00:00,000 --> 00:01:00,001\nToo long",
    "1\n00:00:00,000 --> 00:00:01,000\n",
    "",
  ])("rejects malformed, empty, zero-length or overlong content: %s", (input) => {
    const result = parse(input);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("cues");
  });
  it("rejects adjacent source cues that overlap after quantization", () => {
    const result = parse("1\n00:00:00,000 --> 00:00:00,050\nFirst\n\n2\n00:00:00,050 --> 00:00:01,000\nSecond");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.code === "OVERLAP")).toBe(true);
  });
  it.each([
    "WEBVTT\n\n00:00.000 --> 00:01.000 align:start\nText",
    "WEBVTT\n\n00:00.000 --> 00:01.000\n<b>Text</b>",
    "WEBVTT\n\nSTYLE\n::cue {color:red}",
    "WEBVTT\n\nNOTE ignored text",
    "WEBVTT\n\n00:00.000 --> 00:01.000\nA &amp; B",
  ])("reports unsupported features without silently dropping them", (input) => {
    const result = parse(input, "vtt");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.code === "UNSUPPORTED")).toBe(true);
  });
});

describe("atomic caption validation", () => {
  it("allows exact boundary adjacency and independent caption tracks", () => {
    expect(validateCaptionCues([cue("a", 0, 30), cue("b", 30, 1800), cue("c", 0, 30, "translation")]).ok).toBe(true);
  });
  it("detects nested overlaps in unsorted batches without mutating input", () => {
    const input = [cue("c", 60, 90), cue("a", 0, 120), cue("b", 30, 50)];
    const snapshot = structuredClone(input);
    const result = validateCaptionCues(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.filter((issue) => issue.code === "OVERLAP")).toHaveLength(2);
    expect(input).toEqual(snapshot);
  });
  it("rejects duplicate IDs, noninteger timing, blank text and invalid ranges atomically", () => {
    const result = validateCaptionCues([cue("same", 0, 30), { ...cue("same", 30.5, 40), text: " " }, cue("bad", -1, 0)]);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("cues");
  });
});
