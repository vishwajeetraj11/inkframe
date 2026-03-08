import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type {
  TextMotionAnimation,
  TextMotionProject,
} from "@/lib/text-motion/types";
import {
  FONT_STACK_BY_FAMILY,
  clamp,
  hexToRgba,
  getSceneImage,
  renderTypewriterText,
  splitTextWithAccent,
} from "./shared";
const getPhotoCardMotion = (
  animation: TextMotionAnimation,
  frame: number,
  durationInFrames: number,
): {
  opacity: number;
  cardTransform: string;
  imageTransform: string;
  captionTransform: string;
  scribbleTransform: string;
  clipPath?: string;
} => {
  let startX = 0;
  let startY = 42;
  let startRotate = -3.2;
  let startScale = 0.9;
  const captionStartY = 24;

  switch (animation) {
    case "slide-left": {
      startX = 128;
      startRotate = -4.5;
      break;
    }
    case "slide-right": {
      startX = -128;
      startRotate = 4.5;
      break;
    }
    case "slide-up": {
      startY = 96;
      break;
    }
    case "bounce": {
      startY = 68;
      startScale = 0.82;
      break;
    }
    case "zoom-spin": {
      startScale = 0.72;
      startRotate = -9;
      break;
    }
    case "pop": {
      startScale = 0.76;
      break;
    }
    case "wipe": {
      startX = 34;
      break;
    }
    case "glitch": {
      startX = 20;
      startY = 16;
      break;
    }
    case "fade":
    case "typewriter":
    default: {
      break;
    }
  }

  const enter = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const travel = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(enter, [0, 1], [startX, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(enter, [0, 1], [startY, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }) - interpolate(travel, [0, 1], [0, 20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotation = interpolate(enter, [0, 1], [startRotate, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }) + Math.sin(frame / 48) * 0.4;
  const scale = interpolate(enter, [0, 1], [startScale, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }) * interpolate(travel, [0, 1], [1, 1.14], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionY = interpolate(enter, [0, 1], [captionStartY, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scribbleScale = interpolate(enter, [0, 1], [0.7, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const clipPath =
    animation === "wipe"
      ? `inset(0 ${100 - interpolate(enter, [0, 1], [0, 100])}% 0 0)`
      : undefined;

  return {
    opacity: interpolate(frame, [0, 6], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    cardTransform: `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rotation}deg)`,
    imageTransform: `scale(${1.02 + travel * 0.08})`,
    captionTransform: `translateY(${captionY}px)`,
    scribbleTransform: `rotate(-3deg) scaleX(${scribbleScale})`,
    clipPath,
  };
};

export const PhotoCardBackground = ({
  project,
  frame,
  isPortrait,
}: {
  project: TextMotionProject;
  frame: number;
  isPortrait: boolean;
}) => {
  const driftX = Math.sin(frame / 52) * 8;
  const driftY = Math.cos(frame / 60) * 6;

  return (
    <>
      <AbsoluteFill
        style={{
          background: `linear-gradient(155deg, ${project.theme.backgroundFrom} 0%, ${project.theme.backgroundTo} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.18,
          backgroundImage: [
            "linear-gradient(rgba(0,0,0,0.08) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(0,0,0,0.08) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: isPortrait ? "40px 40px" : "48px 48px",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: isPortrait ? "4.5% 6.5%" : "7% 9%",
          borderRadius: isPortrait ? 34 : 30,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05) 38%, rgba(255,255,255,0.02) 100%)",
          boxShadow: "0 28px 72px rgba(0,0,0,0.12)",
          transform: `translate(${driftX}px, ${driftY}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.02) 26%, rgba(0,0,0,0.08) 100%)",
        }}
      />
    </>
  );
};

export const PhotoCardSceneView = ({
  scene,
  project,
}: {
  scene: TextMotionProject["scenes"][number];
  project: TextMotionProject;
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const durationInFrames = Math.max(1, scene.durationInFrames);
  const motion = getPhotoCardMotion(scene.animation, frame, durationInFrames);
  const displayText =
    scene.animation === "typewriter"
      ? renderTypewriterText(scene.text, frame, durationInFrames)
      : scene.text;
  const parts = splitTextWithAccent(displayText, scene.accentWord);
  const sceneImage = getSceneImage(project, scene, true);
  const isPortrait = height >= width;
  const captionFontSize = clamp(
    (isPortrait ? 58 : 44) - displayText.length * (isPortrait ? 0.18 : 0.12),
    isPortrait ? 28 : 24,
    isPortrait ? 58 : 44,
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <PhotoCardBackground project={project} frame={frame} isPortrait={isPortrait} />

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: isPortrait ? "50%" : "52%",
          width: isPortrait ? "58%" : "42%",
          height: isPortrait ? "64%" : "72%",
          opacity: motion.opacity,
          transform: `translate(-50%, -50%) ${motion.cardTransform}`,
          transformOrigin: "center center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: isPortrait ? 26 : 24,
            background: "rgba(247, 242, 234, 0.98)",
            padding: isPortrait ? 22 : 18,
            boxShadow: "0 30px 72px rgba(0,0,0,0.2)",
          }}
        >
          <div
            style={{
              height: sceneImage ? "76%" : "100%",
              borderRadius: isPortrait ? 18 : 16,
              overflow: "hidden",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.8), rgba(230,224,213,0.95))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: sceneImage ? 0 : "8%",
            }}
          >
            {sceneImage ? (
              <Img
                src={sceneImage.dataUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: motion.imageTransform,
                }}
              />
            ) : (
              <div
                style={{
                  color: project.theme.textColor,
                  fontFamily: FONT_STACK_BY_FAMILY.serif,
                  fontSize: isPortrait ? 56 : 42,
                  fontWeight: 600,
                  lineHeight: 0.95,
                  letterSpacing: -1.4,
                  textAlign: "center",
                  textWrap: "balance",
                }}
              >
                {displayText}
              </div>
            )}
          </div>

          {sceneImage ? (
            <div
              style={{
                position: "absolute",
                left: isPortrait ? 26 : 22,
                right: isPortrait ? 26 : 22,
                bottom: isPortrait ? 20 : 18,
                minHeight: isPortrait ? "16%" : "18%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  transform: motion.captionTransform,
                  clipPath: motion.clipPath,
                  color: project.theme.textColor,
                  fontFamily:
                    FONT_STACK_BY_FAMILY[scene.fontFamily] ?? FONT_STACK_BY_FAMILY.modern,
                  fontWeight: scene.fontWeight,
                  fontStyle: scene.fontStyle,
                  fontSize: captionFontSize,
                  lineHeight: 0.92,
                  letterSpacing: -1.4,
                  textAlign: "center",
                  textWrap: "balance",
                }}
              >
                {parts.map((part, index) =>
                  index % 2 === 1 ? (
                    <span
                      key={`${scene.id}-photo-${index}`}
                      style={{ color: project.theme.accentColor }}
                    >
                      {part}
                    </span>
                  ) : (
                    <span key={`${scene.id}-photo-${index}`}>{part}</span>
                  ),
                )}
              </div>

              <div
                style={{
                  alignSelf: "center",
                  marginTop: 10,
                  width: "70%",
                  height: 16,
                  borderBottom: `4px solid ${hexToRgba(project.theme.accentColor, 0.82)}`,
                  borderRadius: 999,
                  opacity: 0.9,
                  transform: motion.scribbleTransform,
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

