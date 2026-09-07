import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeMusicUrl } from "@/lib/editor/webmcp/beat-audio-browser";

function fixture(durationSeconds = 8) {
  const sampleRate = 8000;
  const samples = new Float32Array(sampleRate * durationSeconds);
  for (let time = 0.25; time < durationSeconds; time += 0.5) {
    const start = Math.round(time * sampleRate);
    for (let i = 0; i < 240 && start + i < samples.length; i++) {
      samples[start + i] = Math.sin(i * 0.4) * Math.exp(-i / 60);
    }
  }
  const decoded = {
    sampleRate, length: samples.length, numberOfChannels: 1,
    getChannelData: () => samples,
  } as unknown as AudioBuffer;
  const decode = vi.fn<(...args: [ArrayBuffer]) => Promise<AudioBuffer>>().mockResolvedValue(decoded);
  const close = vi.fn().mockResolvedValue(undefined);
  const createContext = vi.fn();
  vi.stubGlobal("AudioContext", class {
    constructor() { createContext(); }
    decodeAudioData = decode;
    close = close;
  });
  const reader = {
    read: vi.fn().mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) }).mockResolvedValue({ done: true }),
    cancel: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
  };
  const response = { ok: true, status: 200, headers: new Headers(), body: { getReader: () => reader } };
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return { decoded, decode, close, createContext, fetchMock, reader, response };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("browser music analysis", () => {
  it("analyzes the selected window with relative beat times and releases resources", async () => {
    const f = fixture();
    const result = await analyzeMusicUrl("blob:music", { startSeconds: 2, durationSeconds: 3 });
    expect(result.durationSeconds).toBe(3);
    expect(result.beatTimesSeconds).toHaveLength(6);
    expect(result.beatTimesSeconds[0]).toBeCloseTo(0.25, 2);
    expect(result.beatTimesSeconds.at(-1)).toBeCloseTo(2.75, 2);
    expect(f.close).toHaveBeenCalledOnce();
    expect(f.reader.cancel).toHaveBeenCalledOnce();
    expect(f.reader.releaseLock).toHaveBeenCalledOnce();
    expect(f.fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it("reports available duration when decoded audio is shorter than the request", async () => {
    const f = fixture(3);
    const result = await analyzeMusicUrl("blob:short", { startSeconds: 2, durationSeconds: 10 });
    expect(result.durationSeconds).toBe(1);
    expect(result.beatTimesSeconds.every((time) => time < 1)).toBe(true);
    expect(f.close).toHaveBeenCalledOnce();
  });

  it("caps the selected window at 60 seconds", async () => {
    fixture(65);
    const result = await analyzeMusicUrl("blob:long", { startSeconds: 1, durationSeconds: 64 });
    expect(result.durationSeconds).toBe(60);
    expect(result.beatTimesSeconds.every((time) => time < 60)).toBe(true);
    expect(result.warnings).toContain("The selected music window was limited to 60 seconds.");
  });

  it.each([
    { startSeconds: -1, durationSeconds: 2 },
    { startSeconds: NaN, durationSeconds: 2 },
    { startSeconds: 0, durationSeconds: 0 },
    { startSeconds: 0, durationSeconds: Infinity },
  ])("rejects invalid windows before fetching: %j", async (options) => {
    const f = fixture();
    await expect(analyzeMusicUrl("blob:music", options)).rejects.toThrow("nonnegative start");
    expect(f.fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a window after the audio ends and still closes the context", async () => {
    const f = fixture(3);
    await expect(analyzeMusicUrl("blob:music", { startSeconds: 3, durationSeconds: 1 })).rejects.toThrow("after the audio ends");
    expect(f.close).toHaveBeenCalledOnce();
  });

  it("does not fetch when already cancelled", async () => {
    const f = fixture();
    const controller = new AbortController();
    controller.abort();
    await expect(analyzeMusicUrl("blob:music", { startSeconds: 0, durationSeconds: 2, signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(f.fetchMock).not.toHaveBeenCalled();
    expect(f.createContext).not.toHaveBeenCalled();
  });

  it("cancels an outstanding decode, closes its context, and removes the caller listener", async () => {
    const f = fixture();
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");
    let decoding!: () => void;
    const started = new Promise<void>((resolve) => { decoding = resolve; });
    f.decode.mockImplementation(() => { decoding(); return new Promise(() => {}); });
    const analysis = analyzeMusicUrl("blob:music", { startSeconds: 0, durationSeconds: 2, signal: controller.signal });
    const rejected = expect(analysis).rejects.toMatchObject({ name: "AbortError" });
    await started;
    controller.abort();
    await rejected;
    expect(f.close).toHaveBeenCalledOnce();
    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("times out a fetch that never settles", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.fetchMock.mockReturnValue(new Promise(() => {}));
    const rejected = expect(analyzeMusicUrl("blob:music", { startSeconds: 0, durationSeconds: 2 })).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(30_000);
    await rejected;
    expect(f.fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("propagates fetch failures before creating a context", async () => {
    const f = fixture();
    f.fetchMock.mockRejectedValue(new Error("Network unavailable"));
    await expect(analyzeMusicUrl("https://example.test/music.mp3", { startSeconds: 0, durationSeconds: 2 })).rejects.toThrow("Network unavailable");
    expect(f.createContext).not.toHaveBeenCalled();
  });

  it("rejects unsuccessful HTTP responses", async () => {
    const f = fixture();
    f.response.ok = false;
    f.response.status = 404;
    await expect(analyzeMusicUrl("https://example.test/music.mp3", { startSeconds: 0, durationSeconds: 2 })).rejects.toThrow("404");
    expect(f.decode).not.toHaveBeenCalled();
  });

  it("rejects oversized content-length before consuming the body", async () => {
    const f = fixture();
    f.response.headers.set("content-length", String(32 * 1024 * 1024 + 1));
    await expect(analyzeMusicUrl("blob:large", { startSeconds: 0, durationSeconds: 2 })).rejects.toThrow("32 MB");
    expect(f.reader.read).not.toHaveBeenCalled();
    expect(f.createContext).not.toHaveBeenCalled();
  });

  it("enforces the byte limit on streams without a content-length", async () => {
    const f = fixture();
    f.reader.read.mockReset().mockResolvedValueOnce({ done: false, value: new Uint8Array(32 * 1024 * 1024 + 1) });
    await expect(analyzeMusicUrl("blob:large", { startSeconds: 0, durationSeconds: 2 })).rejects.toThrow("32 MB");
    expect(f.reader.cancel).toHaveBeenCalledOnce();
    expect(f.reader.releaseLock).toHaveBeenCalledOnce();
    expect(f.createContext).not.toHaveBeenCalled();
  });

  it("closes the context after a decoder error", async () => {
    const f = fixture();
    f.decode.mockRejectedValue(new Error("Unsupported audio format"));
    await expect(analyzeMusicUrl("blob:broken", { startSeconds: 0, durationSeconds: 2 })).rejects.toThrow("Unsupported audio format");
    expect(f.close).toHaveBeenCalledOnce();
  });
});
