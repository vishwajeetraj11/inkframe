import type { Clip } from "@/lib/editor/types";

const FPS = 30;
const OUTPUT_SAMPLE_RATE = 16_000;
const MAX_FETCH_BYTES = 128 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

export interface PrepareTranscriptionAudioOptions {
  url: string;
  clip: Clip;
  signal?: AbortSignal;
}

export interface PreparedTranscriptionAudio {
  blob: Blob;
  filename: string;
  durationSeconds: number;
}

/** Encode mono floating-point samples as a browser-compatible 16-bit PCM WAV. */
export function encodeMonoWav(samples: Float32Array, sampleRate = OUTPUT_SAMPLE_RATE): Blob {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) throw new Error("WAV sample rate must be a positive integer.");
  const dataSize = samples.length * 2;
  const bytes = new ArrayBuffer(44 + dataSize);
  const view = new DataView(bytes);
  const text = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, dataSize, true);
  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767), true);
  }
  return new Blob([bytes], { type: "audio/wav" });
}

function abortError(message: string): DOMException {
  return new DOMException(message, "AbortError");
}

function safeFilename(id: string): string {
  const stem = id.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/\.{2,}/g, "_").replace(/^\.+/, "").replace(/_+/g, "_").slice(0, 96) || "clip";
  return `transcription-${stem}.wav`;
}

async function readResponse(response: Response, signal: AbortSignal): Promise<ArrayBuffer> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_FETCH_BYTES) throw new Error("Transcription audio exceeds the 128 MB maximum.");
  if (!response.body) {
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_FETCH_BYTES) throw new Error("Transcription audio exceeds the 128 MB maximum.");
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      if (signal.aborted) throw signal.reason ?? abortError("Transcription audio was cancelled.");
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_FETCH_BYTES) throw new Error("Transcription audio exceeds the 128 MB maximum.");
      chunks.push(part.value);
    }
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}

/** Fetch a video, decode its source audio, and return the clip's normal-speed window as mono 16 kHz WAV. */
export async function prepareTranscriptionAudio({ url, clip, signal }: PrepareTranscriptionAudioOptions): Promise<PreparedTranscriptionAudio> {
  const durationFrames = clip.endFrame - clip.startFrame;
  if (clip.kind !== "video") throw new Error("Transcription audio requires a video clip.");
  if (!Number.isInteger(durationFrames) || durationFrames <= 0 || !Number.isInteger(clip.trimStartFrame) || !Number.isInteger(clip.trimEndFrame) || clip.trimStartFrame < 0 || clip.trimEndFrame <= clip.trimStartFrame) {
    throw new Error("Invalid clip trims.");
  }
  if (clip.timeMapping && clip.timeMapping.kind !== "normal") throw new Error("Retimed and freeze-frame clips are not supported for transcription.");
  if (clip.trimEndFrame - clip.trimStartFrame < durationFrames) throw new Error("Clip trims are shorter than the timeline duration.");

  const controller = new AbortController();
  const relayAbort = () => controller.abort(signal?.reason ?? abortError("Transcription audio was cancelled."));
  signal?.addEventListener("abort", relayAbort, { once: true });
  if (signal?.aborted) relayAbort();
  const timer = setTimeout(() => controller.abort(new DOMException("Transcription audio timed out.", "TimeoutError")), TIMEOUT_MS);
  let context: AudioContext | undefined;
  const checkAbort = () => { if (controller.signal.aborted) throw controller.signal.reason ?? abortError("Transcription audio was cancelled."); };
  const raceAbort = async <T>(promise: Promise<T>): Promise<T> => {
    checkAbort();
    let onAbort = () => {};
    const cancelled = new Promise<never>((_, reject) => { onAbort = () => reject(controller.signal.reason ?? abortError("Transcription audio was cancelled.")); controller.signal.addEventListener("abort", onAbort, { once: true }); });
    try { return await Promise.race([promise, cancelled]); } finally { controller.signal.removeEventListener("abort", onAbort); }
  };
  try {
    checkAbort();
    const response = await raceAbort(fetch(url, { signal: controller.signal }));
    if (!response.ok) throw new Error(`Could not load clip audio (${response.status}).`);
    const bytes = await readResponse(response, controller.signal);
    checkAbort();
    const AudioContextCtor = (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) throw new Error("This browser does not support audio decoding.");
    context = new AudioContextCtor();
    let decoded: AudioBuffer;
    try { decoded = await raceAbort(context.decodeAudioData(bytes)); }
    catch (cause) {
      checkAbort();
      throw new Error("No decodable audio was found. The clip may be silent or use an unsupported audio codec.", { cause });
    }
    const sourceStart = clip.trimStartFrame / FPS;
    const sourceEnd = sourceStart + durationFrames / FPS;
    if (sourceStart < 0 || sourceEnd > decoded.duration + 1 / decoded.sampleRate) throw new Error("Clip trims are outside the decoded audio duration.");
    if (!decoded.numberOfChannels || decoded.length < 1) throw new Error("The video has no audio track.");
    const outputLength = Math.max(1, Math.round(durationFrames / FPS * OUTPUT_SAMPLE_RATE));
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
    const mono = new Float32Array(outputLength);
    for (let index = 0; index < outputLength; index++) {
      const sourcePosition = sourceStart * decoded.sampleRate + index * decoded.sampleRate / OUTPUT_SAMPLE_RATE;
      const left = Math.floor(sourcePosition); const fraction = sourcePosition - left;
      for (const channel of channels) mono[index] += (channel[Math.min(left, channel.length - 1)] ?? 0) * (1 - fraction) + (channel[Math.min(left + 1, channel.length - 1)] ?? 0) * fraction;
      mono[index] /= channels.length;
    }
    return { blob: encodeMonoWav(mono), filename: safeFilename(clip.id), durationSeconds: durationFrames / FPS };
  } finally {
    clearTimeout(timer); signal?.removeEventListener("abort", relayAbort); controller.abort();
    if (context) void context.close().catch(() => {});
  }
}
