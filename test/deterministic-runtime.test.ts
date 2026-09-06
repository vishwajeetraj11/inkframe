import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Project } from "@elah/core";
import { resolveTimeline } from "../node_modules/@elah/core/dist/resolver/resolveTimeline.js";
import { evaluateChannel, evaluateTimeMap, evaluateAudioGain } from "@/lib/editor/deterministic-runtime.mjs";

const project = (): Project => ({ id: "runtime", version: 1, fps: 30, stage: { width: 1920, height: 1080 }, tracks: [{ id: "video", name: "Video", kind: "video", order: 0, height: 40, locked: false, disabled: false, muted: false, solo: false, volume: 1 }], clips: { video: [{ id: "clip", trackId: "video", type: "video", name: "Clip", src: "blob:clip", startFrame: 0, durationFrames: 60, sourceStartFrame: 0, sourceDurationFrames: 300 }] }, transitions: [] });

describe("shared deterministic renderer runtime", () => {
  it("holds channel endpoints and interpolates outgoing segments", () => {
    const points = [{ frame: 10, value: 2, interpolation: "hold" as const }, { frame: 20, value: 4 }, { frame: 30, value: 8 }];
    expect(evaluateChannel(points, 0)).toBe(2);
    expect(evaluateChannel(points, 19)).toBe(2);
    expect(evaluateChannel(points, 20)).toBe(4);
    expect(evaluateChannel(points, 25)).toBe(6);
    expect(evaluateChannel(points, 100)).toBe(8);
  });

  it("integrates ramp speed and preserves exact hold timestamps", () => {
    const mapping = { kind: "speed" as const, points: [{ frame: 0, speed: 1 }, { frame: 30, speed: 3 }] };
    expect(evaluateTimeMap(mapping, 30, 0)).toBe(2e6);
    expect(evaluateTimeMap(mapping, 60, 0)).toBe(5e6);
    expect(evaluateTimeMap({ kind: "hold", sourceTimeUs: 123456 }, 50, 0)).toBe(123456);
  });

  it("uses shared animation and source time without changing the project", () => {
    const p = project();
    p.clips.video[0].keyframes = { x: [{ id: "a", frame: 0, value: 0, interpolation: "linear" }, { id: "b", frame: 30, value: 1, interpolation: "linear" }] };
    p.clips.video[0].timeMapping = { kind: "hold", sourceTimeUs: 123456 };
    const before = JSON.stringify(p);
    expect(resolveTimeline(15, p).videos[0]).toMatchObject({ sourceFrame: 123456 * 30 / 1e6, transform: { x: .5 } });
    expect(JSON.stringify(p)).toBe(before);
  });

  it("matches offline gain curves to preview including overlapping fades and lane volume", async () => {
    const source = readFileSync("node_modules/@elah/core/dist/export/exportVideo.js", "utf8");
    const body = source.slice(source.indexOf("async function renderAudioMix"), source.indexOf("export async function exportVideo"));
    let curve: Float32Array | undefined;
    class OfflineContext {
      destination = {};
      decodeAudioData() { return Promise.resolve({ duration: 10 }); }
      createBufferSource() { return { buffer: null, connect: () => ({ connect: () => {} }), start: () => {} }; }
      createGain() { return { gain: { setValueCurveAtTime: (values: Float32Array) => { curve = values; } } }; }
      startRendering() { return Promise.resolve({ numberOfChannels: 1, length: 1, getChannelData: () => new Float32Array(1) }); }
    }
    const mix = new Function("OfflineAudioContext", "evaluateAudioGain", "getTotalFrames", "mlog", `${body}; return renderAudioMix;`)(OfflineContext, evaluateAudioGain, () => 60, () => {});
    const p = project(); p.tracks[0].kind = "audio"; p.tracks[0].volume = .5;
    const clip = p.clips.video[0]; clip.type = "audio"; clip.volume = .8; clip.fadeInFrames = 60; clip.fadeOutFrames = 60;
    clip.gainEnvelope = [{ frame: 0, value: 1 }, { frame: 30, value: .5 }, { frame: 60, value: 1 }];
    await mix(p, async () => new ArrayBuffer(1));
    for (const frame of [0, 15, 30, 45, 59]) {
      const sample = Math.round(frame / 60 * (curve!.length - 1));
      expect(curve![sample]).toBeCloseTo(resolveTimeline(frame, p).audios[0].volume, 6);
    }
  });

  it("retains exact integer cache keys for ordinary source playback", () => {
    const p = project(); p.clips.video[0].sourceStartFrame = 17; p.clips.video[0].durationFrames = 1800;
    for (let frame = 0; frame < 1800; frame++) expect(resolveTimeline(frame, p).videos[0].sourceFrame).toBe(frame + 17);
  });

  it("does not change automatic fitting for opacity-only animation", () => {
    const p = project();
    p.clips.video[0].keyframes = { opacity: [{ id: "a", frame: 0, value: .5, interpolation: "hold" }] };
    expect(resolveTimeline(10, p).videos[0].transform).toBeUndefined();
    expect(resolveTimeline(10, p).videos[0].opacity).toBe(.5);
  });

  it("schedules the same envelope for live playback from a seek offset", () => {
    const source = readFileSync("node_modules/@elah/core/dist/media/audio/AudioPlaybackController.js", "utf8");
    const body = source.slice(source.indexOf("const GAIN_RAMP_S")).replace("export class", "class");
    const Controller = new Function("evaluateAudioGain", "trace", "defaultAudioResolver", `${body}; return AudioPlaybackController;`)(evaluateAudioGain, () => {}, () => {});
    const p = project(); p.tracks[0].kind = "audio";
    const clip = p.clips.video[0]; clip.type = "audio"; clip.fadeInFrames = 60; clip.fadeOutFrames = 60;
    clip.gainEnvelope = [{ frame: 0, value: 1 }, { frame: 30, value: .5 }, { frame: 60, value: 1 }];
    let curve: Float32Array | undefined;
    let stoppedAt = 0;
    const ctx = { currentTime: 2, sampleRate: 44100, createBufferSource: () => ({ buffer: null, playbackRate: { value: 1 }, connect: () => {}, start: () => {}, stop: (at: number) => { stoppedAt = at; } }), createGain: () => ({ gain: { value: 1, setValueCurveAtTime: (values: Float32Array) => { curve = values; } }, connect: () => {} }) };
    const controller = new Controller({ currentFrame: 15 }, () => p);
    controller._ctx = ctx; controller._masterGain = {};
    controller._ensureTrackNodes = () => ({ gain: {} });
    controller._startClipNode("clip", "video", { duration: 10 }, .5, .5, 1);
    expect(stoppedAt).toBeCloseTo(3.52);
    expect(curve![0]).toBeCloseTo(evaluateAudioGain(clip, 15));
    expect(curve![22050]).toBeCloseTo(evaluateAudioGain(clip, 30));
    expect(controller._active.get("clip").inkframeAutomated).toBe(true);
  });

  it("retains the requested first frame when backward seeking into a prewarmed cache", () => {
    const source = readFileSync("node_modules/@elah/core/dist/media/video/FrameCache.js", "utf8").replace("export class", "class");
    const Cache = new Function(`${source}; return FrameCache;`)();
    const cache = new Cache(30);
    cache.setPivot(29);
    for (let frame = 29; frame <= 45; frame++) cache.put(frame, { close() {} });
    cache.setPivot(0);
    for (let frame = 0; frame <= 16; frame++) cache.put(frame, { close() {} });
    expect(cache.has(0)).toBe(true);
    expect(cache.has(45)).toBe(false);
    expect(cache.size).toBe(30);
  });

  it("selects a low-FPS cached frame only within its actual timestamp interval", () => {
    const source = readFileSync("node_modules/@elah/core/dist/media/video/StreamingFrameProducer.js", "utf8");
    const body = source.slice(source.indexOf("const DEFAULT_FPS")).replace("export class", "class");
    const Producer = new Function("GpuDebugCounters", `${body}; return StreamingFrameProducer;`)({});
    const producer = Object.create(Producer.prototype);
    const bitmap = { close() {} };
    producer._state = "active"; producer._usPerFrame = 1e6 / 30; producer._manager = { state: "Ready" };
    producer._cache = { setPivot() {}, has: (key: number) => key === 96, get: () => bitmap, size: 1 };
    producer._inkframeIntervals = new Map([[96, { start: 3.2e6, end: 3.4e6 }]]);
    expect(producer.getCurrent(3.399 * 30)).toBe(bitmap);
    expect(producer.getCurrent(3.4 * 30)).toBeNull();
    expect(producer.getCurrent(3.199 * 30)).toBeNull();
  });

  it("preserves distinct 60fps and clustered VFR frames that share rounded project indices", async () => {
    const source = readFileSync("node_modules/@elah/core/dist/media/video/StreamingFrameProducer.js", "utf8");
    const body = source.slice(source.indexOf("const DEFAULT_FPS")).replace("export class", "class");
    const Producer = new Function("GpuDebugCounters", `${body}; return StreamingFrameProducer;`)({});
    const cacheSource = readFileSync("node_modules/@elah/core/dist/media/video/FrameCache.js", "utf8").replace("export class", "class");
    const Cache = new Function(`${cacheSource}; return FrameCache;`)();
    const producer = Object.create(Producer.prototype);
    Object.assign(producer, { _state: "active", _usPerFrame: 1e6 / 30, _manager: { state: "Ready" }, _cache: new Cache(30), _inkframeIntervals: new Map(), _highestDecodedFrame: -1, _convert: async (frame: { bitmap: object }) => frame.bitmap });
    const blue = { close() {} }, red = { close() {} }, green = { close() {} };
    await producer._copyAndCache({ duration: 16666, bitmap: blue, close() {} }, 1, 16667);
    await producer._copyAndCache({ duration: 2667, bitmap: red, close() {} }, 1, 33333);
    await producer._copyAndCache({ duration: 30667, bitmap: green, close() {} }, 1, 36000);
    expect(producer.getCurrent(20833 * 30 / 1e6)).toBe(blue);
    expect(producer.getCurrent(34000 * 30 / 1e6)).toBe(red);
    expect(producer.getCurrent(37000 * 30 / 1e6)).toBe(green);
    await producer._copyAndCache({ duration: 33333, bitmap: red, close() {} }, 2, 66667);
    expect(producer.getCurrent(2)).toBe(red);
    expect(producer._cache.size).toBe(4);
  });

  it("probes mirrors for absent audio before allowing silence and propagates unknown probe failures", async () => {
    const source = readFileSync("node_modules/@elah/core/dist/export/exportVideo.js", "utf8");
    const body = source.slice(source.indexOf("async function renderAudioMix"), source.indexOf("export async function exportVideo")).replace("await import('mediabunny')", "mockedMb");
    let audioTrack: object | null = null;
    let probeError: Error | null = null;
    let disposed = 0;
    const mb = { ALL_FORMATS: [], BlobSource: class {}, Input: class { async getPrimaryAudioTrack() { if (probeError) throw probeError; return audioTrack; } dispose() { disposed++; } } };
    const mix = new Function("OfflineAudioContext", "evaluateAudioGain", "getTotalFrames", "mlog", "mockedMb", `${body}; return renderAudioMix;`)(undefined, evaluateAudioGain, () => 60, () => {}, mb);
    const p = project(); p.tracks[0].kind = "audio"; p.clips.video[0].type = "audio"; p.clips.video[0].id = "inkframe-video-audio-source";
    const resolver = async () => new ArrayBuffer(1);
    expect(await mix(p, resolver, () => { throw new Error("unexpected audio issue"); })).toBeNull();
    expect(disposed).toBe(1);
    audioTrack = {};
    await expect(mix(p, resolver, () => { throw new Error("missing backend"); })).rejects.toThrow("missing backend");
    probeError = new Error("corrupt video header");
    await expect(mix(p, resolver)).rejects.toThrow("corrupt video header");
    expect(disposed).toBe(3);
    p.clips.video[0].volume = 0;
    expect(await mix(p, () => { throw new Error("zero-gain source should not be fetched"); })).toBeNull();
    expect(disposed).toBe(3);
  });

  it("copies the exact domain runtime into the worker dependency", () => {
    expect(readFileSync("node_modules/@elah/core/dist/deterministic-runtime.mjs", "utf8")).toBe(readFileSync("src/lib/editor/deterministic-runtime.mjs", "utf8"));
  });
});
