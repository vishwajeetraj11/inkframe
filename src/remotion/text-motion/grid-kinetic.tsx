import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type {
  TextMotionAnimation,
  TextMotionProject,
} from "@/lib/text-motion/types";
import { SceneImage } from "./scene-image";
import {
  FONT_STACK_BY_FAMILY,
  clamp,
  hexToRgba,
  normalizeAccentWord,
  renderTypewriterText,
} from "./shared";
const splitSceneForAccent = (
  text: string,
  accentWord?: string,
): {
  accent: string;
  stackLines: string[];
} => {
  const words = text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return {
      accent: "",
      stackLines: [],
    };
  }

  const normalizedAccent = accentWord ? normalizeAccentWord(accentWord) : "";
  const accentIndex = normalizedAccent
    ? words.findIndex((word) => normalizeAccentWord(word) === normalizedAccent)
    : -1;
  const resolvedAccentIndex = accentIndex >= 0 ? accentIndex : words.length - 1;
  const accent = words[resolvedAccentIndex];
  const stackWords = words.filter((_, index) => index !== resolvedAccentIndex);

  if (stackWords.length === 0) {
    return {
      accent,
      stackLines: [],
    };
  }

  const stackLines =
    stackWords.length <= 2
      ? [stackWords.join(" ")]
      : stackWords.length === 3
        ? [stackWords[0], stackWords.slice(1).join(" ")]
        : [
            stackWords.slice(0, 2).join(" "),
            stackWords.slice(2, 4).join(" "),
            stackWords.slice(4).join(" "),
          ].filter((line) => line.length > 0);

  return {
    accent,
    stackLines,
  };
};

const getGridKineticMotion = (
  animation: TextMotionAnimation,
  frame: number,
  durationInFrames: number,
): {
  opacity: number;
  stackTransform: string;
  accentTransform: string;
  stackBlur: number;
  accentBlur: number;
  ghostOffset: number;
  ghostOpacity: number;
  clipPath?: string;
} => {
  let accentStartX = 120;
  let stackStartX = -48;
  let accentStartScale = 1.06;
  let accentStartRotate = 0;
  let bounceY = 0;

  switch (animation) {
    case "slide-left": {
      accentStartX = 220;
      stackStartX = -60;
      break;
    }
    case "slide-right": {
      accentStartX = -220;
      stackStartX = 60;
      break;
    }
    case "slide-up": {
      accentStartX = 0;
      stackStartX = 0;
      bounceY = 80;
      break;
    }
    case "bounce": {
      accentStartX = 80;
      stackStartX = -24;
      accentStartScale = 1.14;
      bounceY = Math.sin(frame / 3.1) * 8;
      break;
    }
    case "zoom-spin": {
      accentStartX = 120;
      stackStartX = -32;
      accentStartScale = 1.22;
      accentStartRotate = -8;
      break;
    }
    case "pop": {
      accentStartX = 32;
      stackStartX = -10;
      accentStartScale = 0.9;
      break;
    }
    case "wipe": {
      accentStartX = 140;
      stackStartX = -40;
      break;
    }
    case "glitch": {
      accentStartX = 72;
      stackStartX = -16;
      bounceY = Math.sin(frame * 1.2) * 4;
      break;
    }
    case "fade":
    case "typewriter":
    default: {
      break;
    }
  }

  const enterProgress = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacityOut = interpolate(
    frame,
    [Math.max(0, durationInFrames - 8), durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const accentX = interpolate(enterProgress, [0, 1], [accentStartX, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const stackX = interpolate(enterProgress, [0, 1], [stackStartX, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const accentScale = interpolate(enterProgress, [0, 1], [accentStartScale, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const accentRotate = interpolate(enterProgress, [0, 1], [accentStartRotate, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const accentBlur = interpolate(enterProgress, [0, 1], [22, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const stackBlur = interpolate(enterProgress, [0, 1], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ghostOffset = interpolate(enterProgress, [0, 1], [180, 38], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ghostOpacity = interpolate(enterProgress, [0, 1], [0.24, 0.08], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const clipPath =
    animation === "wipe"
      ? `inset(0 ${100 - interpolate(enterProgress, [0, 1], [0, 100])}% 0 0)`
      : undefined;

  return {
    opacity: enterProgress * opacityOut,
    stackTransform: `translate3d(${stackX}px, ${bounceY * 0.35}px, 0)`,
    accentTransform: `translate3d(${accentX}px, ${bounceY}px, 0) scale(${accentScale}) rotate(${accentRotate}deg)`,
    stackBlur,
    accentBlur,
    ghostOffset,
    ghostOpacity,
    clipPath,
  };
};

export const GridKineticBackground = ({
  project,
  frame,
}: {
  project: TextMotionProject;
  frame: number;
}) => {
  const glowX = 62 + Math.sin(frame / 38) * 4;
  const glowY = 34 + Math.cos(frame / 42) * 3;

  return (
    <>
      <AbsoluteFill
        style={{
          background: `linear-gradient(120deg, ${project.theme.backgroundFrom} 0%, #030809 42%, ${project.theme.backgroundTo} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: [
            `radial-gradient(circle at ${glowX}% ${glowY}%, ${hexToRgba(project.theme.accentColor, 0.24)} 0%, rgba(0,0,0,0) 32%)`,
            `radial-gradient(circle at 104% 8%, ${hexToRgba(project.theme.accentColor, 0.18)} 0%, rgba(0,0,0,0) 36%)`,
            "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.16))",
          ].join(", "),
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.4,
          backgroundImage: [
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 44px)",
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 44px)",
          ].join(", "),
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "-8% -4% -8% 38%",
          background: `linear-gradient(90deg, rgba(0,0,0,0) 0%, ${hexToRgba(project.theme.accentColor, 0.16)} 45%, rgba(0,0,0,0) 100%)`,
          filter: "blur(54px)",
          transform: `translateX(${Math.sin(frame / 32) * 18}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(90deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.12) 44%, rgba(0,0,0,0.26) 100%)",
        }}
      />
    </>
  );
};
export const GridKineticSceneView = ({
  scene,
  project,
  hasPersistentRail,
}: {
  scene: TextMotionProject["scenes"][number];
  project: TextMotionProject;
  hasPersistentRail: boolean;
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const durationInFrames = Math.max(1, scene.durationInFrames);
  const displayText =
    scene.animation === "typewriter"
      ? renderTypewriterText(scene.text, frame, durationInFrames)
      : scene.text;
  const motion = getGridKineticMotion(scene.animation, frame, durationInFrames);
  const { accent, stackLines } = splitSceneForAccent(displayText, scene.accentWord);
  const isPortrait = height >= width;
  const accentLength = Math.max(1, accent.length);
  const accentFontSize = clamp(
    (isPortrait ? 430 : 300) - accentLength * (isPortrait ? 15 : 10),
    isPortrait ? 150 : 120,
    isPortrait ? 360 : 260,
  );
  const stackFontSize = isPortrait ? 78 : 56;
  const leftInset = isPortrait ? "7.5%" : "6.5%";
  const stackTop = hasPersistentRail ? (isPortrait ? "30%" : "23%") : isPortrait ? "36%" : "30%";
  const accentLeft = hasPersistentRail ? (isPortrait ? "34%" : "30%") : isPortrait ? "23%" : "28%";
  const accentTop = isPortrait ? "39%" : "34%";
  const accentFont =
    scene.fontFamily === "serif" || scene.fontFamily === "mono"
      ? FONT_STACK_BY_FAMILY.condensed
      : FONT_STACK_BY_FAMILY[scene.fontFamily] ?? FONT_STACK_BY_FAMILY.condensed;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <GridKineticBackground project={project} frame={frame} />
      <SceneImage project={project} scene={scene} opacityMultiplier={0.28} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: motion.opacity,
        }}
      >
        {stackLines.length > 0 ? (
          <div
            style={{
              position: "absolute",
              left: leftInset,
              top: stackTop,
              width: hasPersistentRail ? (isPortrait ? "24%" : "20%") : isPortrait ? "34%" : "26%",
              transform: motion.stackTransform,
              filter: `blur(${motion.stackBlur}px)`,
              clipPath: motion.clipPath,
            }}
          >
            {stackLines.map((line, index) => {
              const ratio = stackLines.length === 1 ? 1 : 0.62 + index * 0.22;
              return (
                <div
                  key={`${scene.id}-stack-${line}-${index}`}
                  style={{
                    color: project.theme.textColor,
                    fontFamily: FONT_STACK_BY_FAMILY.sans,
                    fontWeight: 800,
                    fontSize: stackFontSize * ratio,
                    lineHeight: 0.88,
                    letterSpacing: -2.4,
                    textTransform: "lowercase",
                    textWrap: "balance",
                    textShadow: "0 10px 28px rgba(0,0,0,0.42)",
                  }}
                >
                  {line}
                </div>
              );
            })}
          </div>
        ) : null}

        {[2, 1].map((layer) => (
          <div
            key={`${scene.id}-ghost-${layer}`}
            style={{
              position: "absolute",
              left: accentLeft,
              top: accentTop,
              color: hexToRgba(project.theme.accentColor, motion.ghostOpacity * (layer === 2 ? 0.7 : 1)),
              fontFamily: accentFont,
              fontWeight: Math.max(800, scene.fontWeight),
              fontSize: accentFontSize,
              lineHeight: 0.82,
              letterSpacing: -5,
              textTransform: "lowercase",
              filter: `blur(${motion.accentBlur + layer * 6}px)`,
              transform: `${motion.accentTransform} translateX(${motion.ghostOffset * layer}px)`,
              transformOrigin: "left center",
              whiteSpace: "nowrap",
              clipPath: motion.clipPath,
            }}
          >
            {accent}
          </div>
        ))}

        <div
          style={{
            position: "absolute",
            left: accentLeft,
            top: accentTop,
            color: project.theme.accentColor,
            fontFamily: accentFont,
            fontWeight: Math.max(800, scene.fontWeight),
            fontSize: accentFontSize,
            lineHeight: 0.82,
            letterSpacing: -5,
            textTransform: "lowercase",
            filter: `blur(${motion.accentBlur}px) drop-shadow(0 16px 32px ${hexToRgba(project.theme.accentColor, 0.18)})`,
            transform: motion.accentTransform,
            transformOrigin: "left center",
            whiteSpace: "nowrap",
            clipPath: motion.clipPath,
          }}
        >
          {accent}
        </div>
      </div>
    </AbsoluteFill>
  );
};

