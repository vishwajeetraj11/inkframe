import { describe, expect, it } from "vitest";
import { detectMusicBeats } from "@/lib/editor/beat-analysis";

describe("music beat detection", () => {
  it("finds a synthetic 120 BPM pulse train with stable timing", () => {
    const sampleRate = 8000;
    const samples = new Float32Array(sampleRate * 8);
    for (let time = 0.25; time < 8; time += 0.5) {
      const start = Math.round(time * sampleRate);
      for (let i = 0; i < 240; i++) samples[start + i] = Math.sin(i * 0.4) * Math.exp(-i / 60);
    }
    const result = detectMusicBeats(samples, sampleRate);
    expect(result.bpm).toBeCloseTo(120, 0);
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.beatTimesSeconds).toHaveLength(16);
    expect(result.beatTimesSeconds[0]).toBeCloseTo(0.25, 2);
    expect(result.beatTimesSeconds.at(-1)).toBeCloseTo(7.75, 2);
  });

  it("does not invent beats for silence or sustained amplitude", () => {
    for (const samples of [new Float32Array(16000), new Float32Array(16000).fill(0.25)]) {
      const result = detectMusicBeats(samples, 8000);
      expect(result.beatTimesSeconds).toEqual([]);
      expect(result.bpm).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });

  it("handles invalid inputs without returning non-finite values", () => {
    for (const rate of [0, -1, NaN, Infinity, 999999]) {
      expect(detectMusicBeats(new Float32Array(100), rate).bpm).toBeNull();
    }
    expect(detectMusicBeats(new Float32Array(), 8000).beatTimesSeconds).toEqual([]);
    const result = detectMusicBeats(new Float32Array(8000).fill(NaN), 8000);
    expect(result.confidence).toBe(0);
    expect(result.beatTimesSeconds).toEqual([]);
    expect(result.warnings).toContain("Non-finite audio samples were ignored.");
  });

  it("bounds analysis to one minute", () => {
    const result = detectMusicBeats(new Float32Array(8000 * 61), 8000);
    expect(result.warnings).toContain("Beat analysis was limited to the first 60 seconds.");
  });
});
