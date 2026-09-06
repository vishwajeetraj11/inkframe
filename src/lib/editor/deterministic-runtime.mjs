/** Shared verbatim by domain code, preview, and the export worker. */
export function evaluateChannel(points, frame, fallback = 0) {
  if (!points?.length) return fallback;
  if (frame <= points[0].frame) return points[0].value;
  for (let i = 1; i < points.length; i++) {
    const left = points[i - 1], right = points[i];
    if (frame < right.frame) {
      if (left.interpolation === 'hold') return left.value;
      return left.value + (right.value - left.value) * (frame - left.frame) / (right.frame - left.frame);
    }
  }
  return points[points.length - 1].value;
}

export function evaluateTimeMap(mapping, frame, trimStartFrame, fps = 30) {
  if (mapping?.kind === 'hold') return mapping.sourceTimeUs;
  const origin = mapping?.sourceStartTimeUs ?? trimStartFrame * 1e6 / fps;
  if (mapping?.kind !== 'speed' || !mapping.points?.length) return origin + frame * 1e6 / fps;
  const points = mapping.points;
  let integral = 0, cursor = 0;
  const target = Math.max(0, frame);
  if (points[0].frame > 0) {
    cursor = Math.min(target, points[0].frame);
    integral = cursor * points[0].speed;
  }
  for (let i = 0; i < points.length && cursor < target; i++) {
    const left = points[i], right = points[i + 1];
    const start = Math.max(cursor, left.frame);
    const end = Math.min(target, right?.frame ?? target);
    if (end <= start) continue;
    const slope = right && left.interpolation !== 'hold' ? (right.speed - left.speed) / (right.frame - left.frame) : 0;
    integral += left.speed * (end - start) + slope * ((end - left.frame) ** 2 - (start - left.frame) ** 2) / 2;
    cursor = end;
  }
  return origin + integral * 1e6 / fps;
}

export function evaluateGainEnvelope(points, frame) {
  return evaluateChannel(points, frame, 1);
}

export function evaluateAudioGain(clip, frame, trackGain = 1) {
  const duration = clip.durationFrames;
  const fadeIn = Math.max(0, Math.min(duration, clip.fadeInFrames ?? 0));
  const fadeOut = Math.max(0, Math.min(duration, clip.fadeOutFrames ?? 0));
  const fade = Math.max(0, Math.min(1, fadeIn ? frame / fadeIn : 1, fadeOut ? (duration - frame) / fadeOut : 1));
  return (clip.volume ?? 1) * trackGain * fade * evaluateGainEnvelope(clip.gainEnvelope, frame);
}

/** Produce immutable per-frame properties without mutating the canonical clip. */
export function evaluateClip(clip, localFrame) {
  const channels = clip.keyframes;
  if (!channels) return clip;
  const hasSpatial = ['x', 'y', 'scale', 'rotation'].some(property => channels[property]?.length);
  const transform = hasSpatial ? { x: .5, y: .5, scale: 1, rotation: 0, anchor: { x: .5, y: .5 }, ...clip.transform } : clip.transform;
  for (const property of ['x', 'y', 'scale', 'rotation']) {
    if (channels[property]?.length) transform[property] = evaluateChannel(channels[property], localFrame, transform[property]);
  }
  return { ...clip, ...(transform ? { transform } : {}), opacity: evaluateChannel(channels.opacity, localFrame, clip.opacity ?? 1) };
}
