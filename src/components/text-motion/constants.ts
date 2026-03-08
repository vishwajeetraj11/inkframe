import { TEXT_MOTION_ANIMATIONS } from "@/lib/text-motion/constants";
import type {
  TextMotionAnimation,
  TextMotionFontFamily,
  TextMotionFontStyle,
  TextMotionProject,
} from "@/lib/text-motion/types";
import { clampDuration } from "@/lib/text-motion/utils";

export const TEXT_MOTION_ANIMATION_OPTIONS: TextMotionAnimation[] = [
  ...TEXT_MOTION_ANIMATIONS,
];
export const TEXT_MOTION_FONT_FAMILY_OPTIONS: TextMotionFontFamily[] = [
  "sans",
  "serif",
  "mono",
  "display",
  "condensed",
  "slab",
  "modern",
];
export const TEXT_MOTION_FONT_STYLE_OPTIONS: TextMotionFontStyle[] = [
  "normal",
  "italic",
];

export const ALEXANDER_DEMO_PROMPT = `Create a 32s high-energy kinetic typography reel about ALEXANDER THE GREAT.
Use 9:16. 9 scenes, 3-4s each.
Style: stacked bold uppercase, condensed/display fonts, white + steel gray + one gold accent.
Keep 3 key lines persistent as a small left caption rail.
Use animation mix: slide-left, wipe, zoom-spin, bounce, pop (avoid too much fade/typewriter).
Tone: epic, sharp, modern trailer.

Scene copy:
1) ALEXANDER OF MACEDON
2) TWENTY YEARS OLD. KING.
3) HE CROSSED INTO ASIA
4) GRANICUS. ISSUS. GAUGAMELA.
5) EMPIRE AGAINST EMPIRE
6) EGYPT CROWNED HIM PHARAOH
7) CITIES ROSE IN HIS NAME
8) NO DEFEAT. ONLY DISTANCE.
9) A LEGEND BEFORE THIRTY-TWO

Accent words to highlight:
- KING
- GAUGAMELA
- PHARAOH
- LEGEND

Theme colors:
- backgroundFrom: #05070d
- backgroundTo: #0d1324
- textColor: #f3f4f6
- accentColor: #f59e0b`;

export const framesToSeconds = (frames: number): string => (frames / 30).toFixed(1);
export const secondsToFrames = (seconds: number): number => clampDuration(seconds * 30);
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);
export const templateLabel = (template: TextMotionProject["template"]): string =>
  template === "grid-kinetic"
    ? "Grid Kinetic"
    : template === "photo-card"
      ? "Photo Card"
      : "Default";
