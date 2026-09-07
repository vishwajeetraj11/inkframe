import { FPS, MAX_DURATION_FRAMES } from "./constants";

export interface BeatMontageInput {
  videos: Array<{ assetId: string; durationSeconds: number; preferredStartSeconds?: number }>;
  durationSeconds: number;
  beatTimesSeconds: number[];
  minShotSeconds: number;
  maxShotSeconds: number;
}

export interface BeatMontagePlan {
  shots: Array<{
    assetId: string;
    startFrame: number;
    endFrame: number;
    trimStartFrame: number;
    trimEndFrame: number;
  }>;
  durationFrames: number;
  warnings: string[];
}

const finitePositive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/** End frames are exclusive; all time values are seconds relative to the music start. */
export function planBeatMontage(input: BeatMontageInput): BeatMontagePlan {
  if (!input || !Array.isArray(input.videos) || input.videos.length < 1 || input.videos.length > 100) {
    throw new Error("Provide between 1 and 100 source videos.");
  }
  if (!finitePositive(input.durationSeconds) || input.durationSeconds > MAX_DURATION_FRAMES / FPS) {
    throw new Error(`Montage duration must be greater than zero and at most ${MAX_DURATION_FRAMES / FPS} seconds.`);
  }
  if (!finitePositive(input.minShotSeconds) || !finitePositive(input.maxShotSeconds)
    || input.minShotSeconds > input.maxShotSeconds || input.maxShotSeconds > MAX_DURATION_FRAMES / FPS) {
    throw new Error("Shot lengths must be positive, minimum no greater than maximum, and maximum at most 60 seconds.");
  }
  const durationFrames = Math.round(input.durationSeconds * FPS);
  const minFrames = Math.max(1, Math.ceil(input.minShotSeconds * FPS - 1e-9));
  const maxFrames = Math.floor(input.maxShotSeconds * FPS + 1e-9);
  if (durationFrames < 1 || maxFrames < minFrames || durationFrames < minFrames) {
    throw new Error("Requested duration and shot limits cannot fit whole video frames. Increase duration or adjust shot limits.");
  }
  const videos = input.videos.map((video) => {
    if (!video || typeof video.assetId !== "string" || !video.assetId.trim() || video.assetId.length > 256
      || !finitePositive(video.durationSeconds) || video.durationSeconds > 86400) {
      throw new Error("Each video needs an asset ID (1–256 characters) and a duration greater than zero, at most 24 hours.");
    }
    if (video.preferredStartSeconds !== undefined
      && (typeof video.preferredStartSeconds !== "number" || !Number.isFinite(video.preferredStartSeconds)
        || video.preferredStartSeconds < 0 || video.preferredStartSeconds > 86400)) {
      throw new Error("Preferred source starts must be finite seconds between zero and 24 hours.");
    }
    const frames = Math.floor(video.durationSeconds * FPS);
    if (frames < 1) throw new Error(`Video ${video.assetId} is shorter than one frame. Choose a longer source.`);
    return { ...video, frames };
  });
  if (!Array.isArray(input.beatTimesSeconds) || input.beatTimesSeconds.length > 10000
    || input.beatTimesSeconds.some((time) => typeof time !== "number" || !Number.isFinite(time) || time < 0 || time > 86400)) {
    throw new Error("Provide at most 10,000 finite beat times between zero and 24 hours.");
  }
  const beats = new Set(input.beatTimesSeconds.map((time) => Math.round(time * FPS))
    .filter((frame) => frame > 0 && frame < durationFrames));

  // Feasibility includes the next source's length: greedy beat snapping alone can
  // strand a final fragment or reach a short source that cannot satisfy the minimum.
  // Prefix sums keep this bounded at O(durationFrames² / minFrames), at most 3.24M cells.
  const maxShots = Math.floor(durationFrames / minFrames);
  const feasible = Array.from({ length: maxShots + 1 }, () => new Uint8Array(durationFrames + 1));
  feasible[maxShots][durationFrames] = 1;
  for (let index = maxShots - 1; index >= 0; index--) {
    const next = feasible[index + 1];
    const prefix = new Uint16Array(durationFrames + 2);
    for (let frame = 0; frame <= durationFrames; frame++) prefix[frame + 1] = prefix[frame] + next[frame];
    const available = Math.min(maxFrames, videos[index % videos.length].frames);
    feasible[index][durationFrames] = 1;
    for (let start = 0; start + minFrames <= durationFrames; start++) {
      const low = start + minFrames;
      const high = Math.min(durationFrames, start + available);
      if (high >= low && prefix[high + 1] > prefix[low]) feasible[index][start] = 1;
    }
  }
  if (!feasible[0][0]) {
    throw new Error("Cannot fill the requested duration with these videos in order and these shot limits. Lower the minimum shot length, increase the maximum, adjust duration, or replace short videos.");
  }

  const shots: BeatMontagePlan["shots"] = [];
  const warnings: string[] = [];
  let start = 0;
  let unsyncedCuts = 0;
  let clampedStarts = 0;
  while (start < durationFrames) {
    const index = shots.length;
    const video = videos[index % videos.length];
    const low = start + minFrames;
    const high = Math.min(durationFrames, start + maxFrames, start + video.frames);
    const target = (low + high) / 2;
    let end = -1;
    let bestScore = Infinity;
    for (let candidate = low; candidate <= high; candidate++) {
      if (!feasible[index + 1][candidate]) continue;
      // Beat alignment wins, then distance from the middle of the allowed window.
      const score = (beats.has(candidate) ? 0 : MAX_DURATION_FRAMES + 1) + Math.abs(candidate - target);
      if (score < bestScore) { bestScore = score; end = candidate; }
    }
    const length = end - start;
    const requestedStart = Math.round((video.preferredStartSeconds ?? 0) * FPS);
    const trimStartFrame = Math.min(requestedStart, video.frames - length);
    if (trimStartFrame !== requestedStart) clampedStarts++;
    shots.push({ assetId: video.assetId, startFrame: start, endFrame: end, trimStartFrame, trimEndFrame: trimStartFrame + length });
    if (end < durationFrames && !beats.has(end)) unsyncedCuts++;
    start = end;
  }
  if (Math.abs(durationFrames / FPS - input.durationSeconds) > 1e-9) warnings.push(`Duration rounded to ${durationFrames} frames at ${FPS} fps.`);
  if (unsyncedCuts) warnings.push(`${unsyncedCuts} cut(s) could not align to supplied beats within the shot and source limits.`);
  if (clampedStarts) warnings.push(`${clampedStarts} preferred source start(s) were moved earlier to fit the shot.`);
  if (shots.length > videos.length) warnings.push("Source videos repeat to fill the requested duration.");
  return { shots, durationFrames, warnings };
}
