export interface BeatAnalysisResult {
  /** Detected onsets in seconds relative to the beginning of the samples. */
  beatTimesSeconds: number[];
  bpm: number | null;
  confidence: number;
  warnings: string[];
}

const MAX_ANALYSIS_SECONDS = 60;

/** Lightweight energy-onset estimation; these are candidate beats, not musical downbeats. */
export function detectMusicBeats(samples: Float32Array, sampleRate: number): BeatAnalysisResult {
  const warnings: string[] = [];
  const empty = (): BeatAnalysisResult => ({ beatTimesSeconds: [], bpm: null, confidence: 0, warnings });
  if (!Number.isFinite(sampleRate) || sampleRate < 1000 || sampleRate > 384000 || samples.length === 0) {
    warnings.push("Audio samples or sample rate are invalid.");
    return empty();
  }
  const length = Math.min(samples.length, Math.floor(sampleRate * MAX_ANALYSIS_SECONDS));
  if (samples.length > length) warnings.push("Beat analysis was limited to the first 60 seconds.");
  const hop = Math.max(1, Math.round(sampleRate * 0.01));
  const count = Math.ceil(length / hop);
  const energy = new Float64Array(count);
  // Bound work even for high sample rates, while retaining an amplitude envelope.
  const stride = Math.max(1, Math.floor(sampleRate / 22050));
  let invalid = false;
  let maximumEnergy = 0;
  for (let bin = 0; bin < count; bin++) {
    let sum = 0;
    let n = 0;
    for (let i = bin * hop; i < Math.min(length, (bin + 1) * hop); i += stride) {
      const sample = samples[i];
      if (!Number.isFinite(sample)) { invalid = true; continue; }
      sum += Math.min(1, Math.abs(sample)) ** 2;
      n++;
    }
    energy[bin] = n ? Math.sqrt(sum / n) : 0;
    maximumEnergy = Math.max(maximumEnergy, energy[bin]);
  }
  if (invalid) warnings.push("Non-finite audio samples were ignored.");
  if (maximumEnergy < 0.0001) {
    warnings.push("No audible rhythmic events were found in this audio window.");
    return empty();
  }
  const onset = new Float64Array(count);
  let maxOnset = 0;
  for (let i = 1; i < count; i++) {
    onset[i] = Math.max(0, energy[i] - energy[i - 1]);
    maxOnset = Math.max(maxOnset, onset[i]);
  }
  const candidates: number[] = [];
  const minSeparation = Math.ceil(0.2 * sampleRate / hop);
  for (let i = 1; i < count - 1; i++) {
    let localSum = 0;
    const left = Math.max(0, i - 30);
    const right = Math.min(count - 1, i + 30);
    for (let j = left; j <= right; j++) localSum += onset[j];
    const threshold = Math.max(maxOnset * 0.12, localSum / (right - left + 1) * 2.5, 0.0001);
    if (onset[i] < threshold || onset[i] < onset[i - 1] || onset[i] <= onset[i + 1]) continue;
    const previous = candidates.at(-1);
    if (previous !== undefined && i - previous < minSeparation) {
      if (onset[i] > onset[previous]) candidates[candidates.length - 1] = i;
    } else {
      candidates.push(i);
    }
  }
  const beatTimesSeconds = candidates.map((bin) => bin * hop / sampleRate);
  if (beatTimesSeconds.length < 3) {
    warnings.push("Too few rhythmic events were found to estimate a reliable tempo.");
    return { beatTimesSeconds, bpm: null, confidence: 0, warnings };
  }
  const intervals = beatTimesSeconds.slice(1).map((time, i) => time - beatTimesSeconds[i]);
  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const regular = intervals.filter((interval) => Math.abs(interval - median) <= median * 0.12).length;
  const confidence = Math.min(1, regular / intervals.length * Math.min(1, intervals.length / 8));
  let bpm = 60 / median;
  // Resolve the usual half/double tempo ambiguity to a conventional editing range.
  while (bpm > 180) bpm /= 2;
  while (bpm < 60) bpm *= 2;
  if (confidence < 0.5) warnings.push("The rhythm is irregular; detected events may not match musical beats.");
  warnings.push("Beat detection estimates audio onsets and does not identify musical downbeats.");
  return { beatTimesSeconds, bpm: Math.round(bpm * 10) / 10, confidence, warnings };
}
