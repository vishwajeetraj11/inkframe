import {
  type AudioTrack,
  type Clip,
  type TextOverlay,
} from "../types";
import {
  clamp,
  normalizeTextOverlayFontFamily,
  normalizeTextOverlayFontStyle,
  normalizeTextOverlayFontWeight,
  toSafeInt,
} from "./helpers";

const normalizeTextOverlayAnimation = (
  animation: TextOverlay["animation"],
  durationInFrames: number,
): TextOverlay["animation"] => {
  if (!animation) return undefined;
  const durationFrames = clamp(
    toSafeInt(animation.durationFrames, 0),
    0,
    durationInFrames,
  );
  const validKinds = new Set([
    "fade",
    "rise",
    "slide-left",
    "punch",
    "typewriter",
    "word-reveal",
  ]);
  const normalized: NonNullable<TextOverlay["animation"]> = {
    ...(animation.in && validKinds.has(animation.in) ? { in: animation.in } : {}),
    ...(animation.out && validKinds.has(animation.out) ? { out: animation.out } : {}),
    durationFrames,
  };
  return normalized.in || normalized.out || durationFrames > 0
    ? normalized
    : undefined;
};

export const normalizeClips = (clips: Clip[]): Clip[] =>
  clips.map((clip) => ({ ...clip, volume: clamp(clip.volume, 0, 1) }));

export const normalizeTextOverlays = (textOverlays: TextOverlay[]): TextOverlay[] =>
  textOverlays
    .map((overlay) => {
      const startFrame = Math.max(0, toSafeInt(overlay.startFrame, 0));
      const requestedEndFrame = Math.max(
        startFrame + 1,
        toSafeInt(overlay.endFrame, startFrame + 1),
      );
      const endFrame = Math.max(startFrame + 1, requestedEndFrame);

      return {
        ...overlay,
        startFrame,
        endFrame,
        x: clamp(overlay.x, 0, 100),
        y: clamp(overlay.y, 0, 100),
        fontSize: clamp(Math.round(overlay.fontSize), 12, 200),
        fontFamily: normalizeTextOverlayFontFamily(overlay.fontFamily),
        fontWeight: normalizeTextOverlayFontWeight(overlay.fontWeight),
        fontStyle: normalizeTextOverlayFontStyle(overlay.fontStyle),
        textAlign: (
          overlay.textAlign === "left" || overlay.textAlign === "right"
            ? overlay.textAlign
            : "center"
        ) as TextOverlay["textAlign"],
        stylePreset: "classic" as const,
        animation: normalizeTextOverlayAnimation(
          (overlay as Partial<TextOverlay>).animation,
          endFrame - startFrame,
        ),
      };
    })
    .filter((overlay) => overlay.text.trim().length > 0);

export const normalizeAudioTracks = (audioTracks: AudioTrack[]): AudioTrack[] =>
  audioTracks.map((track) => {
    const startFrame = Math.max(0, toSafeInt(track.startFrame, 0));
    const endFrame = Math.max(startFrame + 1, toSafeInt(track.endFrame, startFrame + 1));
    const trimStartFrame = Math.max(0, toSafeInt(track.trimStartFrame, 0));
    const trimEndFrame = Math.max(
      trimStartFrame + 1,
      toSafeInt(track.trimEndFrame, trimStartFrame + 1),
    );

    return {
      ...track,
      startFrame,
      endFrame,
      trimStartFrame,
      trimEndFrame,
      volume: clamp(track.volume, 0, 1),
      fadeInFrames: clamp(
        toSafeInt((track as Partial<AudioTrack>).fadeInFrames ?? 0, 0),
        0,
        endFrame - startFrame,
      ),
      fadeOutFrames: clamp(
        toSafeInt((track as Partial<AudioTrack>).fadeOutFrames ?? 0, 0),
        0,
        endFrame - startFrame,
      ),
      muted: Boolean((track as Partial<AudioTrack>).muted),
    };
  });
