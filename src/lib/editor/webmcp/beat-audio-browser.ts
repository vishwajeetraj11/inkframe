import { detectMusicBeats, type BeatAnalysisResult } from "@/lib/editor/beat-analysis";

const MAX_AUDIO_BYTES = 32 * 1024 * 1024;
const ANALYSIS_TIMEOUT_MS = 30_000;

export interface MusicAnalysisOptions {
  startSeconds: number;
  durationSeconds: number;
  signal?: AbortSignal;
}

/** Fetch/decode in the browser, then inspect at most 60 seconds of the selected window. */
export async function analyzeMusicUrl(
  url: string,
  options: MusicAnalysisOptions,
): Promise<BeatAnalysisResult & { durationSeconds: number }> {
  if (!Number.isFinite(options.startSeconds) || options.startSeconds < 0 ||
      !Number.isFinite(options.durationSeconds) || options.durationSeconds <= 0) {
    throw new Error("Audio analysis requires a nonnegative start and a positive finite duration.");
  }
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = setTimeout(() => controller.abort(new DOMException("Audio analysis timed out.", "TimeoutError")), ANALYSIS_TIMEOUT_MS);
  let context: AudioContext | undefined;
  const checkAbort = () => {
    if (controller.signal.aborted) throw controller.signal.reason ?? new DOMException("Audio analysis cancelled.", "AbortError");
  };
  const bounded = async <T>(promise: Promise<T>): Promise<T> => {
    checkAbort();
    let onAbort: () => void = () => {};
    const cancelled = new Promise<never>((_, reject) => {
      onAbort = () => reject(controller.signal.reason ?? new DOMException("Audio analysis cancelled.", "AbortError"));
      controller.signal.addEventListener("abort", onAbort, { once: true });
    });
    try { return await Promise.race([promise, cancelled]); }
    finally { controller.signal.removeEventListener("abort", onAbort); }
  };
  try {
    checkAbort();
    const response = await bounded(fetch(url, { signal: controller.signal }));
    if (!response.ok) throw new Error(`Could not load music for beat analysis (${response.status}).`);
    if (Number(response.headers.get("content-length")) > MAX_AUDIO_BYTES) {
      throw new Error("Music is too large for beat analysis (32 MB maximum).");
    }
    if (!response.body) throw new Error("The music response did not contain audio data.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await bounded(reader.read());
        if (done) break;
        size += value.byteLength;
        if (size > MAX_AUDIO_BYTES) throw new Error("Music is too large for beat analysis (32 MB maximum).");
        chunks.push(value);
      }
    } finally {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    checkAbort();
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    if (typeof AudioContext === "undefined") throw new Error("This browser does not support audio decoding.");
    context = new AudioContext();
    const decoded = await bounded(context.decodeAudioData(bytes.buffer));
    checkAbort();
    const start = Math.floor(options.startSeconds * decoded.sampleRate);
    if (start >= decoded.length) throw new Error("The selected music window starts after the audio ends.");
    const length = Math.min(decoded.length - start, Math.floor(Math.min(60, options.durationSeconds) * decoded.sampleRate));
    if (length < 1) throw new Error("The selected music window is empty.");
    const stride = Math.max(1, Math.ceil(decoded.sampleRate / 22050));
    const mono = new Float32Array(Math.ceil(length / stride));
    // RMS channel mixing avoids cancelling opposite-phase stereo transients.
    const channels = Array.from({ length: Math.min(decoded.numberOfChannels, 8) }, (_, i) => decoded.getChannelData(i));
    for (let i = 0; i < mono.length; i++) {
      let energy = 0;
      for (const channel of channels) energy += channel[start + i * stride] ** 2;
      mono[i] = Math.sqrt(energy / channels.length);
    }
    checkAbort();
    const result = detectMusicBeats(mono, decoded.sampleRate / stride);
    if (options.durationSeconds > 60) result.warnings.push("The selected music window was limited to 60 seconds.");
    return { ...result, durationSeconds: length / decoded.sampleRate };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
    controller.abort();
    if (context) void context.close().catch(() => {});
  }
}
