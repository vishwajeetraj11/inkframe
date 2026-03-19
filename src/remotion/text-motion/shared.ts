import type { CSSProperties } from "react";
import { interpolate } from "remotion";
import type {
  TextMotionAnimation,
  TextMotionFontFamily,
  TextMotionProject,
} from "@/lib/text-motion/types";
import { REMOTION_FONT_STACKS } from "../fonts";

export const FONT_STACK_BY_FAMILY: Record<TextMotionFontFamily, string> = {
  sans: REMOTION_FONT_STACKS.sans,
  serif: REMOTION_FONT_STACKS.serif,
  mono: REMOTION_FONT_STACKS.mono,
  display: REMOTION_FONT_STACKS.display,
  condensed: REMOTION_FONT_STACKS.condensed,
  slab: REMOTION_FONT_STACKS.serif,
  modern: REMOTION_FONT_STACKS.display,
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return `rgba(103, 232, 249, ${alpha})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const normalizeWord = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const splitTextWithAccent = (
  text: string,
  accentWord?: string,
): string[] => {
  const accent = accentWord?.trim();
  if (!accent || !text.toLowerCase().includes(accent.toLowerCase())) {
    return [text];
  }

  return text
    .replace(
      new RegExp(escapeRegExp(accent), "i"),
      (match) => `__ACCENT__${match}__ACCENT__`,
    )
    .split("__ACCENT__");
};

export const getAnimatedStyle = (
  animation: TextMotionAnimation,
  frame: number,
  durationInFrames: number,
): CSSProperties => {
  const entryOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  switch (animation) {
    case "slide-up": {
      const translateY = interpolate(frame, [0, 18], [64, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

      return {
        opacity: entryOpacity,
        transform: `translateY(${translateY}px)`,
      };
    }
    case "slide-left": {
      const translateX = interpolate(frame, [0, 18], [84, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return {
        opacity: entryOpacity,
        transform: `translateX(${translateX}px)`,
      };
    }
    case "slide-right": {
      const translateX = interpolate(frame, [0, 18], [-84, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return {
        opacity: entryOpacity,
        transform: `translateX(${translateX}px)`,
      };
    }
    case "pop": {
      const scale = interpolate(frame, [0, 14], [0.78, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return {
        opacity: entryOpacity,
        transform: `scale(${scale})`,
      };
    }
    case "bounce": {
      const entry = interpolate(frame, [0, 10], [0.84, 1.08], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const settle = interpolate(frame, [10, 22], [1.08, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return {
        opacity: entryOpacity,
        transform: `translateY(${Math.sin(frame / 3.3) * 3}px) scale(${frame < 10 ? entry : settle})`,
      };
    }
    case "zoom-spin": {
      const scale = interpolate(frame, [0, 16], [1.4, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const rotate = interpolate(frame, [0, 18], [-16, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

      return {
        opacity: entryOpacity,
        transform: `scale(${scale}) rotate(${rotate}deg)`,
      };
    }
    case "glitch": {
      const jitterX = Math.sin(frame * 1.5) * 3.2;
      const jitterY = Math.cos(frame * 1.15) * 1.6;
      return {
        opacity: entryOpacity,
        transform: `translate(${jitterX}px, ${jitterY}px)`,
        filter: `drop-shadow(${Math.sin(frame) * 2}px 0 0 rgba(255,0,102,0.6))`,
      };
    }
    case "wipe": {
      const clipProgress = interpolate(frame, [0, 20], [0, 100], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return {
        opacity: entryOpacity,
        clipPath: `inset(0 ${100 - clipProgress}% 0 0)`,
      };
    }
    case "fade": {
      const fadeIn = interpolate(frame, [0, 10], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const fadeOut = interpolate(
        frame,
        [Math.max(0, durationInFrames - 10), durationInFrames],
        [1, 0],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        },
      );

      return {
        opacity: fadeIn * fadeOut,
      };
    }
    case "typewriter": {
      const opacity = interpolate(frame, [0, 6], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return {
        opacity,
      };
    }
    default: {
      return {};
    }
  }
};

export const renderTypewriterText = (
  text: string,
  frame: number,
  durationInFrames: number,
): string => {
  const safeDuration = Math.max(1, durationInFrames);
  const visibleChars = Math.round(
    interpolate(frame, [0, Math.max(1, safeDuration - 6)], [0, text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  return text.slice(0, Math.max(0, visibleChars));
};

export const getSceneImage = (
  project: TextMotionProject,
  scene: TextMotionProject["scenes"][number],
  fallbackToFirst = false,
): TextMotionProject["imageAssets"][number] | undefined =>
  scene.imageAssetId
    ? project.imageAssets.find((asset) => asset.id === scene.imageAssetId)
    : fallbackToFirst
      ? project.imageAssets[0]
      : undefined;

export const normalizeAccentWord = (value: string): string => normalizeWord(value);
