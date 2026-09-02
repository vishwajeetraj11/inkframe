import { FPS } from "./constants";

export const SOUND_EFFECT_LIBRARY = [
  { id: "whoosh", label: "Whoosh", defaultDurationInFrames: 30, tone: "sweep" },
  { id: "page-turn", label: "Page Turn", defaultDurationInFrames: 36, tone: "noise" },
  { id: "whip", label: "Whip", defaultDurationInFrames: 24, tone: "sweep" },
  { id: "mouse-click", label: "Mouse Click", defaultDurationInFrames: 8, tone: "click" },
  { id: "ui-switch", label: "UI Switch", defaultDurationInFrames: 10, tone: "square" },
  { id: "shutter-modern", label: "Shutter Modern", defaultDurationInFrames: 10, tone: "click" },
  { id: "shutter-old", label: "Shutter Old", defaultDurationInFrames: 12, tone: "noise" },
  { id: "ding", label: "Ding", defaultDurationInFrames: 20, tone: "sine" },
  { id: "low-hit", label: "Low Hit", defaultDurationInFrames: 28, tone: "low" },
  { id: "impact", label: "Impact", defaultDurationInFrames: 24, tone: "impact" },
  { id: "error-pulse", label: "Error Pulse", defaultDurationInFrames: 30, tone: "square" },
] as const;

export type SoundEffectId = (typeof SOUND_EFFECT_LIBRARY)[number]["id"];
type SoundEffect = (typeof SOUND_EFFECT_LIBRARY)[number];

export const getSoundEffectById = (id: SoundEffectId): SoundEffect | undefined =>
  SOUND_EFFECT_LIBRARY.find((effect) => effect.id === id);

const writeAscii = (view: DataView, offset: number, value: string): void => {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
};

const sampleFor = (effect: SoundEffect, time: number, duration: number): number => {
  const progress = Math.min(1, time / Math.max(duration, 0.001));
  const envelope = Math.pow(1 - progress, effect.tone === "sine" ? 2 : 1.25);
  const phase = Math.PI * 2;
  if (effect.tone === "noise") {
    const deterministicNoise = Math.sin((time * 12_989.8 + 78.233) * 437.5453) % 1;
    return deterministicNoise * envelope * 0.55;
  }
  if (effect.tone === "click") {
    return Math.sin(time * phase * 1_600) * Math.pow(1 - progress, 5) * 0.8;
  }
  if (effect.tone === "square") {
    return Math.sign(Math.sin(time * phase * 440)) * envelope * 0.32;
  }
  if (effect.tone === "low") {
    return Math.sin(time * phase * (96 - progress * 42)) * envelope * 0.72;
  }
  if (effect.tone === "impact") {
    return (
      Math.sin(time * phase * (150 - progress * 100)) * envelope * 0.68 +
      Math.sin(time * phase * 820) * Math.pow(1 - progress, 4) * 0.18
    );
  }
  if (effect.tone === "sweep") {
    return Math.sin(time * phase * (180 + progress * 1_200)) * envelope * 0.48;
  }
  return Math.sin(time * phase * 880) * envelope * 0.45;
};

const effectUrlCache = new Map<SoundEffectId, string>();

export const getSoundEffectDataUrl = (effect: SoundEffect): string => {
  const cached = effectUrlCache.get(effect.id);
  if (cached) return cached;

  const sampleRate = 22_050;
  const durationSeconds = effect.defaultDurationInFrames / FPS;
  const sampleCount = Math.max(1, Math.round(sampleRate * durationSeconds));
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, sampleCount * 2, true);
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const sample = Math.max(-1, Math.min(1, sampleFor(effect, time, durationSeconds)));
    view.setInt16(44 + index * 2, Math.round(sample * 0x7fff), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  const url = `data:audio/wav;base64,${btoa(binary)}`;
  effectUrlCache.set(effect.id, url);
  return url;
};
