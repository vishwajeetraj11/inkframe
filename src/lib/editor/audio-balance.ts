import { buildDuckingEnvelope, type AudioDuckingRule, type AudioItemRef, type GainPoint } from "./audio-ducking";
import type { VersionTimeline } from "./types";

export interface AudioBalanceInput {
  music: AudioItemRef;
  narration: AudioItemRef[];
  strength: "gentle" | "balanced" | "strong";
  ruleId: string;
}

/** Plans timeline-based ducking; does not analyze samples or detect speech. */
export function planAudioBalance(version: VersionTimeline, input: AudioBalanceInput): {
  rule: AudioDuckingRule; envelope: GainPoint[]; warnings: string[];
} {
  const attenuation = { gentle: -6, balanced: -12, strong: -18 };
  if (!Object.hasOwn(attenuation, input.strength)) throw new Error("Invalid audio balance strength.");
  if (!input.ruleId.trim()) throw new Error("Audio balance requires a nonempty rule ID.");
  const entities = [...version.clips, ...version.audioTracks, ...version.textOverlays,
    ...version.transitions, ...(version.tracks ?? []), ...(version.captionCues ?? []), ...(version.duckingRules ?? [])];
  if (entities.some(item => item.id === input.ruleId)) throw new Error("Audio balance rule ID already exists.");
  if (!input.narration.length) throw new Error("Select at least one narration source.");
  const resolve = (ref: AudioItemRef) => {
    const item = ref.kind === "audio" ? version.audioTracks.find(item => item.id === ref.id)
      : ref.kind === "video" ? version.clips.find(item => item.id === ref.id && item.kind === "video") : undefined;
    if (!item) throw new Error(`Audio balance source does not exist: ${ref.kind}:${ref.id}.`);
    if (!Number.isFinite(item.startFrame) || !Number.isFinite(item.endFrame) || item.endFrame <= item.startFrame)
      throw new Error(`Audio balance source has an invalid timeline interval: ${ref.id}.`);
    if (!Number.isFinite(item.volume) || item.volume <= 0 || ("muted" in item && item.muted)
      || ("timeMapping" in item && item.timeMapping && item.timeMapping.kind !== "normal"))
      throw new Error(`Audio balance source is not audible: ${ref.id}. Unmute it and use normal playback.`);
    return item;
  };
  const music = resolve(input.music);
  const seen = new Set([`${input.music.kind}:${input.music.id}`]);
  for (const ref of input.narration) {
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) throw new Error("Music and narration references must all be distinct.");
    seen.add(key);
    const narration = resolve(ref);
    if (narration.startFrame >= music.endFrame || narration.endFrame <= music.startFrame)
      throw new Error(`Narration source does not overlap the music: ${ref.id}.`);
  }
  const rule: AudioDuckingRule = {
    id: input.ruleId, target: { ...input.music }, triggers: input.narration.map(ref => ({ ...ref })),
    attenuationDb: attenuation[input.strength], attackFrames: 6, releaseFrames: 15,
  };
  const envelope = buildDuckingEnvelope({ ...version, duckingRules: [...(version.duckingRules ?? []), rule] }, input.music);
  if (!envelope) throw new Error("Could not build an audio balance envelope.");
  const warnings = ["Ducking follows selected narration timeline intervals, including any silence; no speech detection or loudness analysis was performed."];
  if (version.duckingRules?.some(existing => existing.target.kind === input.music.kind && existing.target.id === input.music.id))
    warnings.push("Existing ducking rules are included; the strongest attenuation wins.");
  return { rule, envelope, warnings };
}
