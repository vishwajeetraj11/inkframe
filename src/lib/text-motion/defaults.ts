import {
  MIN_SCENE_DURATION_FRAMES,
  TEXT_MOTION_FPS,
} from "./constants";
import type {
  TextMotionProject,
  TextMotionScene,
} from "./types";
import type { AspectPreset } from "../editor/types";

export const createDefaultTextMotionScene = (
  id: string,
  text: string,
): TextMotionScene => ({
  id,
  text,
  durationInFrames: MIN_SCENE_DURATION_FRAMES * 2,
  animation: "slide-up",
  fontFamily: "sans",
  fontWeight: 700,
  fontStyle: "normal",
  keepOnScreen: false,
});

export const createDefaultTextMotionProject = (
  aspect: AspectPreset,
): TextMotionProject => ({
  title: "Text Motion",
  aspect,
  template: "default",
  theme: {
    backgroundFrom: "#0f172a",
    backgroundTo: "#1e293b",
    textColor: "#f8fafc",
    accentColor: "#67e8f9",
  },
  imageAssets: [],
  scenes: [
    createDefaultTextMotionScene("scene-1", "Hook your audience in 3 seconds."),
    {
      id: "scene-2",
      text: "Turn ideas into kinetic typography.",
      durationInFrames: TEXT_MOTION_FPS * 2,
      animation: "pop",
      fontFamily: "sans",
      fontWeight: 800,
      fontStyle: "normal",
      keepOnScreen: true,
    },
    {
      id: "scene-3",
      text: "Export for Reels and widescreen in one click.",
      durationInFrames: TEXT_MOTION_FPS * 2,
      animation: "typewriter",
      fontFamily: "serif",
      fontWeight: 700,
      fontStyle: "normal",
      keepOnScreen: true,
    },
  ],
});

export const createGridKineticTextMotionProject = (
  aspect: AspectPreset,
): TextMotionProject => ({
  title: "Grid Kinetic",
  aspect,
  template: "grid-kinetic",
  theme: {
    backgroundFrom: "#020504",
    backgroundTo: "#0a1b13",
    textColor: "#f4f7f5",
    accentColor: "#26f58f",
  },
  imageAssets: [],
  scenes: [
    {
      id: "scene-1",
      text: "animating text",
      durationInFrames: TEXT_MOTION_FPS * 2,
      animation: "slide-left",
      accentWord: "text",
      fontFamily: "sans",
      fontWeight: 800,
      fontStyle: "normal",
      keepOnScreen: true,
    },
    {
      id: "scene-2",
      text: "like this",
      durationInFrames: Math.round(TEXT_MOTION_FPS * 1.6),
      animation: "wipe",
      accentWord: "this",
      fontFamily: "sans",
      fontWeight: 700,
      fontStyle: "normal",
      keepOnScreen: true,
    },
    {
      id: "scene-3",
      text: "can be",
      durationInFrames: Math.round(TEXT_MOTION_FPS * 1.4),
      animation: "slide-right",
      accentWord: "be",
      fontFamily: "sans",
      fontWeight: 700,
      fontStyle: "normal",
      keepOnScreen: true,
    },
    {
      id: "scene-4",
      text: "challenging",
      durationInFrames: Math.round(TEXT_MOTION_FPS * 1.9),
      animation: "zoom-spin",
      accentWord: "challenging",
      fontFamily: "condensed",
      fontWeight: 800,
      fontStyle: "normal",
      keepOnScreen: false,
    },
    {
      id: "scene-5",
      text: "but this template",
      durationInFrames: Math.round(TEXT_MOTION_FPS * 1.9),
      animation: "slide-left",
      accentWord: "template",
      fontFamily: "sans",
      fontWeight: 800,
      fontStyle: "normal",
      keepOnScreen: true,
    },
    {
      id: "scene-6",
      text: "shows you how",
      durationInFrames: TEXT_MOTION_FPS * 2,
      animation: "bounce",
      accentWord: "how",
      fontFamily: "condensed",
      fontWeight: 900,
      fontStyle: "normal",
      keepOnScreen: false,
    },
  ],
});

export const createPhotoCardTextMotionProject = (
  aspect: AspectPreset,
): TextMotionProject => ({
  title: "Photo Card",
  aspect,
  template: "photo-card",
  theme: {
    backgroundFrom: "#ebe4da",
    backgroundTo: "#d8cec1",
    textColor: "#201711",
    accentColor: "#c2410c",
  },
  imageAssets: [],
  scenes: [
    {
      id: "scene-1",
      text: "Add media",
      durationInFrames: Math.round(TEXT_MOTION_FPS * 1.8),
      animation: "slide-up",
      accentWord: "media",
      fontFamily: "serif",
      fontWeight: 600,
      fontStyle: "normal",
      keepOnScreen: false,
    },
    {
      id: "scene-2",
      text: "Add text to photo",
      durationInFrames: Math.round(TEXT_MOTION_FPS * 1.9),
      animation: "pop",
      accentWord: "text",
      fontFamily: "modern",
      fontWeight: 600,
      fontStyle: "normal",
      keepOnScreen: false,
    },
    {
      id: "scene-3",
      text: "Zoom into the story",
      durationInFrames: Math.round(TEXT_MOTION_FPS * 2.2),
      animation: "slide-left",
      accentWord: "story",
      fontFamily: "serif",
      fontWeight: 700,
      fontStyle: "normal",
      keepOnScreen: false,
    },
  ],
});
