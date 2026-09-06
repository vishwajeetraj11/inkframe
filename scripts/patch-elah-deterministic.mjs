import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(process.cwd(), 'node_modules/@elah/core');
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (manifest.version !== '0.4.1') throw new Error(`Deterministic runtime requires @elah/core 0.4.1, found ${manifest.version}`);
const marker = 'INKFRAME_DETERMINISTIC_V1';
const runtime = await readFile(join(process.cwd(), 'src/lib/editor/deterministic-runtime.mjs'), 'utf8');
await writeFile(join(root, 'dist/deterministic-runtime.mjs'), runtime);
const replace = (source, old, replacement) => {
  if (!source.includes(old)) throw new Error(`Elah dependency layout changed: ${old.slice(0, 100)}`);
  return source.replace(old, replacement);
};
async function patch(relative, mutate, required) {
  const path = join(root, 'dist', relative);
  let source = await readFile(path, 'utf8');
  if (!source.includes(marker)) source = `// ${marker}\n` + mutate(source);
  for (const text of required) if (!source.includes(text)) throw new Error(`Incomplete deterministic patch in ${relative}: ${text}`);
  await writeFile(path, source);
}
await patch('resolver/resolveTimeline.js', source => {
  source = `import { evaluateClip, evaluateTimeMap, evaluateAudioGain } from '../deterministic-runtime.mjs';\n` + source;
  source = replace(source, 'for (const clip of clips) {', 'for (const originalClip of clips) {\n            const clip = evaluateClip(originalClip, frame - originalClip.startFrame);');
  source = replace(source, 'const sourceFrame = frame - clip.startFrame + clip.sourceStartFrame;', 'const sourceFrame = evaluateTimeMap(clip.timeMapping, frame - clip.startFrame, clip.sourceStartFrame, project.fps) * project.fps / 1e6;');
  source = replace(source, 'const resolvedAudioVolume = volume * Math.max(0, Math.min(fadeInGain, fadeOutGain));', 'const resolvedAudioVolume = evaluateAudioGain(clip, localAudioFrame, trackGain);');
  return source;
}, ['evaluateClip(originalClip', 'evaluateTimeMap(clip.timeMapping', 'evaluateAudioGain(clip']);
// Normal playback must retain integer cache keys; avoid a microsecond roundtrip.
{
  const path = join(root, 'dist/resolver/resolveTimeline.js');
  const original = 'const sourceFrame = evaluateTimeMap(clip.timeMapping, frame - clip.startFrame, clip.sourceStartFrame, project.fps) * project.fps / 1e6;';
  const corrected = "const sourceFrame = !clip.timeMapping || clip.timeMapping.kind === 'normal' ? frame - clip.startFrame + clip.sourceStartFrame : evaluateTimeMap(clip.timeMapping, frame - clip.startFrame, clip.sourceStartFrame, project.fps) * project.fps / 1e6;";
  let source = await readFile(path, 'utf8');
  if (source.includes(original)) source = source.replace(original, corrected);
  if (!source.includes(corrected)) throw new Error('Unable to preserve normal playback cache keys');
  await writeFile(path, source);
}
await patch('export/ExportWorker.js', source => {
  source = `import { evaluateTimeMap } from '../deterministic-runtime.mjs';\n` + source;
  // Preserve existing center-of-frame sampling for ordinary playback; mapped
  // video uses exactly the domain timestamp, including an exact hold timestamp.
  return replace(source, '(clip.sourceStartFrame + i + 0.5) / fps', "clip.timeMapping && clip.timeMapping.kind !== 'normal' ? evaluateTimeMap(clip.timeMapping, i, clip.sourceStartFrame, fps) / 1e6 : (clip.sourceStartFrame + i + 0.5) / fps");
}, ['evaluateTimeMap(clip.timeMapping']);
await patch('export/exportVideo.js', source => {
  source = `import { evaluateAudioGain } from '../deterministic-runtime.mjs';\n` + source;
  source = replace(source, 'return track && !track.muted && !track.disabled;', "return track && !track.muted && !track.disabled && (!project.tracks.some(t => t.kind === 'audio' && t.solo) || track.solo);");
  const start = source.indexOf('            const clipEndSec = clipStartSec + clipDurationSec;');
  const end = source.indexOf('            node.connect(gain).connect(ctx.destination);', start);
  if (start < 0 || end < 0) throw new Error('Unable to locate patched offline fade envelope');
  source = source.slice(0, start) + `            const track = project.tracks.find(t => t.id === clip.trackId);
            const curveLength = Math.max(2, Math.ceil(clipDurationSec * sampleRate) + 1);
            const curve = new Float32Array(curveLength);
            for (let sample = 0; sample < curveLength; sample++) {
                curve[sample] = evaluateAudioGain(clip, sample * clip.durationFrames / (curveLength - 1), track?.volume ?? 1);
            }
            gain.gain.setValueCurveAtTime(curve, clipStartSec, clipDurationSec);
` + source.slice(end);
  return source;
}, ['evaluateAudioGain(clip', 'gain.gain.setValueCurveAtTime']);
await patch('media/audio/AudioPlaybackController.js', source => {
  source = `import { evaluateAudioGain } from '../../deterministic-runtime.mjs';\n` + source;
  source = replace(source, 'if (ctx)\n                    this._rampGain(existing.gain.gain, clip.volume, ctx.currentTime);', 'if (ctx && !existing.inkframeAutomated)\n                    this._rampGain(existing.gain.gain, clip.volume, ctx.currentTime);');
  source = replace(source, 'const needRestart = transportChanged ||', 'const needRestart = transportChanged || (existing && existing.inkframeProject !== this._getProject()) ||');
  source = replace(source, '        gain.gain.value = volume;\n        node.connect(gain);', `        gain.gain.value = volume;
        const project = this._getProject();
        const canonical = project.clips[trackId]?.find(clip => clip.id === clipId);
        const localFrame = canonical ? this._playback.currentFrame - canonical.startFrame : 0;
        const automated = Boolean(canonical && (canonical.gainEnvelope || canonical.fadeInFrames || canonical.fadeOutFrames));
        const remainingFrames = canonical ? Math.max(0, canonical.durationFrames - localFrame) : 0;
        const startAt = ctx.currentTime + 0.02;
        if (automated && remainingFrames > 0) {
            const duration = remainingFrames / project.fps / playbackRate;
            const length = Math.max(2, Math.ceil(duration * ctx.sampleRate) + 1);
            const curve = new Float32Array(length);
            const track = project.tracks.find(track => track.id === trackId);
            for (let sample = 0; sample < length; sample++) {
                curve[sample] = evaluateAudioGain(canonical, localFrame + sample * remainingFrames / (length - 1), track?.muted ? 0 : (track?.volume ?? 1));
            }
            gain.gain.setValueCurveAtTime(curve, startAt, duration);
        }
        node.connect(gain);`);
  source = replace(source, '        node.start(ctx.currentTime + 0.02, offset);\n        this._active.set(clipId, { node, gain, trackId });', `        node.start(startAt, offset);
        if (canonical && remainingFrames > 0) node.stop(startAt + remainingFrames / project.fps / playbackRate);
        this._active.set(clipId, { node, gain, trackId, inkframeAutomated: automated, inkframeProject: project });`);
  return source;
}, ['evaluateAudioGain(canonical', 'inkframeAutomated', 'node.stop(startAt']);
await patch('media/video/FrameCache.js', source => replace(source,
  'const victimKey = behindVictim !== null ? behindVictim : aheadVictim;',
  'const victimKey = behindVictim !== null && (aheadVictim === null || behindMaxDist >= aheadMaxDist) ? behindVictim : aheadVictim;'),
  ['behindMaxDist >= aheadMaxDist']);
await patch('media/video/StreamingFrameProducer.js', source => {
  source = replace(source, "        this._state = 'active';", "        this._state = 'active';\n        this._inkframeIntervals = new Map();");
  source = replace(source, '        const frame = this._cache.get(sourceFrame, 2);', `        const requestedUs = sourceFrame * this._usPerFrame;
        let frame = null;
        let selectedStart = -Infinity;
        for (const [key, interval] of this._inkframeIntervals) {
            if (!this._cache.has(key)) continue;
            let end = interval.end;
            if (end === null) {
                const later = [...this._inkframeIntervals.values()].filter(value => value.start > interval.start);
                end = later.length ? Math.min(...later.map(value => value.start)) : interval.start + this._usPerFrame;
            }
            if (requestedUs + 1e-6 >= interval.start && requestedUs < end - 1e-6 && interval.start > selectedStart) {
                frame = this._cache.get(key);
                selectedStart = interval.start;
            }
        }`);
  source = replace(source, '    async _copyAndCache(frame, sourceFrameIdx, timestampUs) {\n        let bitmap = null;', `    async _copyAndCache(frame, sourceFrameIdx, timestampUs) {
        const durationUs = frame.duration;
        let bitmap = null;`);
  source = replace(source, '        this._cache.put(sourceFrameIdx, bitmap);', `        this._cache.put(sourceFrameIdx, bitmap);
        this._inkframeIntervals.set(sourceFrameIdx, { start: timestampUs, end: Number.isFinite(durationUs) && durationUs > 0 ? timestampUs + durationUs : null });
        for (const key of this._inkframeIntervals.keys()) if (!this._cache.has(key)) this._inkframeIntervals.delete(key);`);
  source = replace(source, '        this._cache.dispose();', '        this._cache.dispose();\n        this._inkframeIntervals.clear();');
  return source;
}, ['this._inkframeIntervals = new Map()', 'requestedUs < end', 'durationUs = frame.duration']);
// Upgrade interval cache keys without changing decoder scheduling counters.
{
  const path = join(root, 'dist/media/video/StreamingFrameProducer.js');
  let source = await readFile(path, 'utf8');
  const old = '        this._cache.put(sourceFrameIdx, bitmap);\n        this._inkframeIntervals.set(sourceFrameIdx,';
  const upgraded = '        const cacheKey = timestampUs / this._usPerFrame;\n        this._cache.put(cacheKey, bitmap);\n        this._inkframeIntervals.set(cacheKey,';
  if (source.includes(old)) source = source.replace(old, upgraded);
  source = source.replace('const requestedUs = sourceFrame * this._usPerFrame;', 'const requestedUs = Math.round(sourceFrame * this._usPerFrame);');
  if (!source.includes(upgraded)) throw new Error('Unable to preserve high-FPS cache timestamps');
  await writeFile(path, source);
}
{
  const path = join(root, 'dist/export/exportVideo.js');
  let source = await readFile(path, 'utf8');
  if (!source.includes('INKFRAME_AUDIO_STREAM_PROBE_V1')) {
    source = replace(source, '    const audioClips = allClips.filter(c => {', '    let audioClips = allClips.filter(c => {');
    source = replace(source, "    const OAC = typeof OfflineAudioContext !== 'undefined'", `    // INKFRAME_AUDIO_STREAM_PROBE_V1: absence is different from decode failure.
    const bytesBySrc = new Map();
    const loadAudioBytes = (src) => {
        if (!bytesBySrc.has(src)) bytesBySrc.set(src, audioResolver(src));
        return bytesBySrc.get(src);
    };
    const mirrors = audioClips.filter(clip => clip.id.startsWith('inkframe-video-audio-'));
    const silentSources = new Set();
    if (mirrors.length) {
        const mb = await import('mediabunny');
        for (const src of new Set(mirrors.map(clip => clip.src))) {
            const bytes = await loadAudioBytes(src);
            const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(new Blob([bytes])) });
            try {
                if (!await input.getPrimaryAudioTrack()) silentSources.add(src);
            } finally {
                input.dispose();
            }
        }
        audioClips = audioClips.filter(clip => !clip.id.startsWith('inkframe-video-audio-') || !silentSources.has(clip.src));
        if (!audioClips.length) return null;
    }
    const OAC = typeof OfflineAudioContext !== 'undefined'`);
    source = replace(source, 'promise = audioResolver(src).then((buf) => ctx.decodeAudioData(buf));', 'promise = loadAudioBytes(src).then((buf) => ctx.decodeAudioData(buf));');
  }
  source = source.replace('return track && !track.muted && !track.disabled &&', 'return track && (c.volume ?? 1) > 0 && (track.volume ?? 1) > 0 && !track.muted && !track.disabled &&');
  if (!source.includes('loadAudioBytes(src).then') || !source.includes('input.getPrimaryAudioTrack()')) throw new Error('Incomplete audio stream probe');
  await writeFile(path, source);
}
await patch('media/video/demuxer/createMediabunnyBackend.js', source => {
  source = replace(source, '    let _disposed = false;', '    let _disposed = false;\n    let _atEnd = false;');
  source = replace(source, '    return {\n        async open(src) {', '    return {\n        get isAtEnd() { return _atEnd; },\n        async open(src) {');
  source = replace(source, '        async *packets([startUs, endUs]) {\n            _assertOpen(_sink, _config);', '        async *packets([startUs, endUs]) {\n            _assertOpen(_sink, _config);\n            if (_atEnd) return;');
  source = replace(source, '            _nextPacket = pkt;\n            _lastEndSec = endSec;', '            _nextPacket = pkt;\n            _lastEndSec = endSec;\n            _atEnd = pkt === null;');
  source = replace(source, '        async seekToKeyframe(timeUs) {\n            _assertOpen(_sink, _config);', '        async seekToKeyframe(timeUs) {\n            _assertOpen(_sink, _config);\n            _atEnd = false;');
  return source;
}, ['get isAtEnd()', '_atEnd = pkt === null', 'if (_atEnd) return']);
await patch('media/video/demuxer/MediabunnyDemuxer.js', source => replace(source,
  '    get isOpen() {', '    get isAtEnd() { return this._backend?.isAtEnd ?? false; }\n    get isOpen() {'), ['get isAtEnd()']);
await patch('media/video/VideoDecoderManager.js', source => {
  source = replace(source, '    feed(timeRangeUs) {', '    feed(timeRangeUs) {\n        if (this._demuxer?.isAtEnd) return;');
  source = replace(source, '                packetCount++;\n            }\n        }\n        catch (error) {', `                packetCount++;
            }
            // Flush only at confirmed EOF to release delayed B-frames. Flushing
            // ordinary bursts would require a new keyframe on the next decode.
            if (packetCount > 0 && this._demuxer.isAtEnd && gen === this._feedGeneration && this._state === 'Ready') {
                await this._decoder.flush();
            }
        }
        catch (error) {`);
  source = replace(source, '        const pending = this._feedPendingRange;', '        const pending = this._demuxer.isAtEnd ? null : this._feedPendingRange;');
  return source;
}, ['if (this._demuxer?.isAtEnd) return', 'packetCount > 0 && this._demuxer.isAtEnd', 'await this._decoder.flush()']);
await patch('media/video/demuxer/MediabunnyDemuxer.d.ts', source => {
  source = replace(source, 'export interface DemuxerBackend {', 'export interface DemuxerBackend {\n    readonly isAtEnd?: boolean;');
  return replace(source, '    get isOpen(): boolean;', '    get isOpen(): boolean;\n    get isAtEnd(): boolean;');
}, ['readonly isAtEnd?: boolean;', 'get isAtEnd(): boolean;']);
await patch('types/index.d.ts', source => replace(source, '    fadeOutFrames?: FrameCount;', `    fadeOutFrames?: FrameCount;
    keyframes?: Partial<Record<'x' | 'y' | 'scale' | 'rotation' | 'opacity', Array<{ id: string; frame: number; value: number; interpolation: 'linear' | 'hold' }>>>;
    timeMapping?: { kind: 'normal' } | { kind: 'hold'; sourceTimeUs: number } | { kind: 'speed'; points: Array<{ frame: number; speed: number; interpolation: 'linear' | 'hold' }>; sourceStartTimeUs?: number };
    gainEnvelope?: Array<{ frame: number; value: number; interpolation?: 'linear' | 'hold' }>;`), ['keyframes?:', 'timeMapping?:', 'gainEnvelope?:']);
console.log(`Elah ${manifest.version} deterministic runtime ready.`);
