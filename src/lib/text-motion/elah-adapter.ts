import type { Clip, Project, Track } from "@elah/editor";
import { ASPECT_PRESETS } from "@/lib/editor/constants";
import type {
  TextMotionFontFamily,
  TextMotionProject,
} from "./types";

const TRACK_HEIGHT = 40;

const fontFamilyMap: Record<TextMotionFontFamily, string> = {
  sans: "sans-serif",
  serif: "serif",
  mono: "monospace",
  display: "Impact, sans-serif",
  condensed: "Arial Narrow, sans-serif",
  slab: "Rockwell, serif",
  modern: "Helvetica Neue, sans-serif",
};

const createTrack = (
  id: string,
  name: string,
  kind: Track["kind"],
  order: number,
): Track => ({
  id,
  name,
  kind,
  order,
  height: TRACK_HEIGHT,
  locked: false,
  disabled: false,
  muted: false,
  solo: false,
  volume: 1,
});

const createBackgroundTransform = (
  width: number,
  height: number,
) => ({
  x: 0.5,
  y: 0.5,
  scale: Math.max(width, height) / Math.min(width, height),
  rotation: 0,
  anchor: { x: 0.5, y: 0.5 },
});

const adaptiveFontSize = (text: string, base: number): number => {
  const length = text.trim().length;
  if (length > 80) return Math.round(base * 0.55);
  if (length > 50) return Math.round(base * 0.7);
  if (length > 28) return Math.round(base * 0.84);
  return base;
};

export const toElahTextMotionProject = (
  project: TextMotionProject,
): Project => {
  const preset = ASPECT_PRESETS[project.aspect];
  const totalFrames = Math.max(
    1,
    project.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0),
  );
  const tracks: Track[] = [];
  const clips: Record<string, Clip[]> = {};

  const backgroundTrack = createTrack("text-motion-background", "Background", "video", 0);
  tracks.push(backgroundTrack);
  clips[backgroundTrack.id] = [
    {
      id: "text-motion-background-clip",
      trackId: backgroundTrack.id,
      type: "shape",
      name: "Theme background",
      startFrame: 0,
      durationFrames: totalFrames,
      sourceStartFrame: 0,
      sourceDurationFrames: totalFrames,
      shapeKind: "rect",
      shapeFill: project.theme.backgroundFrom,
      shapeStrokeWidth: 0,
      transform: createBackgroundTransform(preset.width, preset.height),
      volume: 1,
      opacity: 1,
      locked: true,
      disabled: false,
    },
  ];

  const imageById = new Map(project.imageAssets.map((asset) => [asset.id, asset]));
  let cursor = 0;
  project.scenes.forEach((scene, index) => {
    const image = scene.imageAssetId ? imageById.get(scene.imageAssetId) : undefined;
    if (image) {
      const track = createTrack(
        `text-motion-image-${scene.id}`,
        `Image ${index + 1}`,
        "video",
        tracks.length,
      );
      tracks.push(track);
      clips[track.id] = [
        {
          id: `image-${scene.id}`,
          trackId: track.id,
          type: "image",
          name: image.name,
          startFrame: cursor,
          durationFrames: scene.durationInFrames,
          sourceStartFrame: 0,
          sourceDurationFrames: scene.durationInFrames,
          src: image.dataUrl,
          volume: 1,
          opacity: scene.imageOpacity ?? 0.72,
          locked: false,
          disabled: false,
        },
      ];
    }

    const track = createTrack(
      `text-motion-text-${scene.id}`,
      `Scene ${index + 1}`,
      "elements",
      tracks.length,
    );
    const baseFontSize = project.aspect === "reel_9_16" ? 108 : 92;
    tracks.push(track);
    clips[track.id] = [
      {
        id: scene.id,
        trackId: track.id,
        type: "text",
        name: `Scene ${index + 1}`,
        startFrame: cursor,
        durationFrames: scene.keepOnScreen ? totalFrames - cursor : scene.durationInFrames,
        sourceStartFrame: 0,
        sourceDurationFrames: scene.durationInFrames,
        content: scene.text,
        fontSize: adaptiveFontSize(scene.text, baseFontSize),
        color: project.theme.textColor,
        fontFamily: fontFamilyMap[scene.fontFamily],
        fontWeight: scene.fontWeight >= 600 ? "bold" : "normal",
        textAlign: "center",
        textAnimation: {
          in: "fade",
          out: "fade",
          durationFrames: Math.max(4, Math.min(12, Math.floor(scene.durationInFrames / 3))),
        },
        transform: {
          x: 0.5,
          y: project.template === "photo-card" ? 0.72 : 0.5,
          scale: 1,
          rotation: 0,
          anchor: { x: 0.5, y: 0.5 },
        },
        volume: 1,
        opacity: 1,
        locked: false,
        disabled: false,
      },
    ];
    cursor += scene.durationInFrames;
  });

  return {
    id: `text-motion-${project.aspect}`,
    fps: preset.fps,
    stage: { width: preset.width, height: preset.height },
    tracks,
    clips,
    transitions: [],
    version: 1,
    masterVolume: 1,
  };
};
