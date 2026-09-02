import {
  DEFAULT_CLIP_DURATION_FRAMES,
  MAX_DURATION_FRAMES,
} from "./constants";
import type {
  AspectPreset,
  AudioTrack,
  Clip,
  ProjectSession,
  TextOverlay,
  VersionTimeline,
} from "./types";

export const createEmptyVersionTimeline = (
  aspect: AspectPreset,
): VersionTimeline => ({
  aspect,
  clips: [],
  textOverlays: [],
  audioTracks: [],
  transitions: [],
});

export const createInitialProjectSession = (): ProjectSession => ({
  activeVersion: "reel_9_16",
  versions: {
    reel_9_16: createEmptyVersionTimeline("reel_9_16"),
    widescreen_16_9: createEmptyVersionTimeline("widescreen_16_9"),
  },
});

export const createDefaultClip = (
  id: string,
  assetId: string,
  kind: "video" | "image",
): Clip => ({
  id,
  assetId,
  kind,
  startFrame: 0,
  endFrame: DEFAULT_CLIP_DURATION_FRAMES,
  trimStartFrame: 0,
  trimEndFrame: DEFAULT_CLIP_DURATION_FRAMES,
  volume: 1,
});

export const createDefaultTextOverlay = (id: string): TextOverlay => ({
  id,
  text: "New text",
  startFrame: 0,
  endFrame: DEFAULT_CLIP_DURATION_FRAMES,
  x: 50,
  y: 50,
  fontSize: 64,
  color: "#ffffff",
  fontFamily: "sans",
  fontWeight: 700,
  fontStyle: "normal",
  textAlign: "center",
  stylePreset: "classic",
  createdaleyTexture: "plain",
  syncMediaToTimelineEvents: false,
});

export const createDefaultAudioTrack = (
  id: string,
  assetId: string,
): AudioTrack => ({
  id,
  assetId,
  startFrame: 0,
  endFrame: MAX_DURATION_FRAMES,
  trimStartFrame: 0,
  trimEndFrame: MAX_DURATION_FRAMES,
  volume: 1,
  fadeInFrames: 0,
  fadeOutFrames: 0,
  muted: false,
});
