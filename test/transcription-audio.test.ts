import { afterEach, describe, expect, it, vi } from "vitest";
import type { Clip } from "@/lib/editor/types";
import { encodeMonoWav, prepareTranscriptionAudio } from "@/lib/export/transcription-audio";

const clip = (overrides: Partial<Clip> = {}): Clip => ({ id: "clip/../voice", assetId: "video", kind: "video", startFrame: 90, endFrame: 120, trimStartFrame: 60, trimEndFrame: 90, volume: 1, ...overrides });

afterEach(() => vi.unstubAllGlobals());

describe("transcription audio", () => {
  it("encodes mono PCM WAV with a valid header and clipping", async () => {
    const blob = encodeMonoWav(new Float32Array([-2, -1, 0, 1, 2]), 16_000);
    const bytes = new DataView(await blob.arrayBuffer());
    expect(blob.type).toBe("audio/wav");
    expect(new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 4))).toBe("RIFF");
    expect(bytes.getUint16(22, true)).toBe(1);
    expect(bytes.getUint32(24, true)).toBe(16_000);
    expect(bytes.getInt16(44, true)).toBe(-32768);
    expect(bytes.getInt16(52, true)).toBe(32767);
  });

  it("uses source trimStart and clip duration, downmixes, resamples, and sanitizes filename", async () => {
    const sampleRate = 30;
    const left = Float32Array.from({ length: 120 }, (_, index) => index / 120);
    const right = new Float32Array(120);
    const decoded = { sampleRate, length: 120, duration: 4, numberOfChannels: 2, getChannelData: (index: number) => index ? right : left } as unknown as AudioBuffer;
    const close = vi.fn().mockResolvedValue(undefined);
    const decodeAudioData = vi.fn().mockResolvedValue(decoded);
    vi.stubGlobal("AudioContext", class { decodeAudioData = decodeAudioData; close = close; });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]))));
    const result = await prepareTranscriptionAudio({ url: "blob:video", clip: clip() });
    expect(result.filename).toBe("transcription-clip_voice.wav");
    expect(result.durationSeconds).toBe(1);
    expect((await result.blob.arrayBuffer()).byteLength).toBe(44 + 16_000 * 2);
    const wav = new DataView(await result.blob.arrayBuffer());
    expect(wav.getInt16(44, true)).toBe(Math.round(0.25 * 32767)); // source frame 60, averaged across two channels
    expect(decodeAudioData).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it.each([
    ["image", clip({ kind: "image" })],
    ["retimed", clip({ timeMapping: { kind: "hold", sourceTimeUs: 0 } })],
    ["invalid trim", clip({ trimEndFrame: 60 })],
  ])("rejects %s clips before fetching", async (_, input) => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(prepareTranscriptionAudio({ url: "blob:video", clip: input })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects source windows beyond decoded audio and closes the context", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const decoded = { sampleRate: 30, length: 30, duration: 1, numberOfChannels: 1, getChannelData: () => new Float32Array(30) } as unknown as AudioBuffer;
    vi.stubGlobal("AudioContext", class { decodeAudioData = vi.fn().mockResolvedValue(decoded); close = close; });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1]))));
    await expect(prepareTranscriptionAudio({ url: "blob:video", clip: clip({ trimStartFrame: 60, trimEndFrame: 90 }) })).rejects.toThrow("outside");
    expect(close).toHaveBeenCalledOnce();
  });
});
