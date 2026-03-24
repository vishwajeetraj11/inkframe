import {
  formatEditorialStatRingValue,
  parseEditorialStatRingText,
  splitEditorialStatRingHeadline,
} from "@/lib/editor/editorial-stat-ring";
import type { CreatedaleyOpenerTexture } from "@/lib/editor/types";
import { Easing, interpolate } from "remotion";
import type { PresetRendererProps } from "./types";
import {
  NewsCrumpleTexture,
  STAT_RING_HEADLINE_STACK,
  STAT_RING_NUMBER_STACK,
  clamp01,
  getRevealClipPath,
} from "./shared";

const getStatRingPaperFill = (texture: CreatedaleyOpenerTexture): string => {
  switch (texture) {
    case "dots":
      return "linear-gradient(180deg, #faf5ea 0%, #f2e8d7 100%)";
    case "grid-dots":
      return "linear-gradient(180deg, #f8f0e1 0%, #eadfca 100%)";
    case "newsprint-grain":
      return "linear-gradient(180deg, #f1eadc 0%, #e3d7c1 100%)";
    case "warm-editorial":
      return "linear-gradient(180deg, #f6ecd7 0%, #e9d0a7 54%, #deb886 100%)";
    case "plain":
    default:
      return "linear-gradient(180deg, #fbf8f2 0%, #f6f2e9 100%)";
  }
};

const getStatRingPaperShade = (texture: CreatedaleyOpenerTexture): string => {
  switch (texture) {
    case "dots":
      return (
        "radial-gradient(circle at 18% 14%, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0) 26%)," +
        "radial-gradient(circle at 84% 74%, rgba(173, 132, 70, 0.12), rgba(173, 132, 70, 0) 28%)"
      );
    case "grid-dots":
      return (
        "radial-gradient(circle at 18% 14%, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0) 25%)," +
        "radial-gradient(circle at 82% 74%, rgba(130, 103, 64, 0.12), rgba(130, 103, 64, 0) 28%)"
      );
    case "newsprint-grain":
      return (
        "radial-gradient(circle at 18% 14%, rgba(255, 255, 255, 0.44), rgba(255, 255, 255, 0) 24%)," +
        "linear-gradient(180deg, rgba(116, 90, 57, 0.02) 0%, rgba(116, 90, 57, 0.1) 100%)"
      );
    case "warm-editorial":
      return (
        "radial-gradient(circle at 18% 14%, rgba(255, 248, 234, 0.84), rgba(255, 248, 234, 0) 26%)," +
        "radial-gradient(circle at 82% 74%, rgba(194, 118, 39, 0.18), rgba(194, 118, 39, 0) 30%)," +
        "linear-gradient(180deg, rgba(112, 82, 48, 0.02) 0%, rgba(112, 82, 48, 0.12) 100%)"
      );
    case "plain":
    default:
      return (
        "radial-gradient(circle at 18% 14%, rgba(255, 255, 255, 0.76), rgba(255, 255, 255, 0) 24%)," +
        "linear-gradient(180deg, rgba(92, 76, 54, 0.02) 0%, rgba(92, 76, 54, 0) 100%)"
      );
  }
};

const getStatRingTextureDotBackground = (
  texture: CreatedaleyOpenerTexture,
  isVertical: boolean,
): { backgroundImage: string; backgroundSize: string; opacity: number } | null => {
  switch (texture) {
    case "dots":
      return {
        backgroundImage:
          "radial-gradient(circle at 2px 2px, rgba(88, 64, 36, 0.22) 1.3px, transparent 1.5px)",
        backgroundSize: isVertical ? "18px 18px" : "20px 20px",
        opacity: 1,
      };
    case "grid-dots":
      return {
        backgroundImage:
          "radial-gradient(circle at 2px 2px, rgba(88, 64, 36, 0.2) 1.2px, transparent 1.45px)",
        backgroundSize: isVertical ? "18px 18px" : "20px 20px",
        opacity: 1,
      };
    case "warm-editorial":
      return {
        backgroundImage:
          "radial-gradient(circle at 2px 2px, rgba(120, 72, 24, 0.18) 1.25px, transparent 1.55px)",
        backgroundSize: isVertical ? "18px 18px" : "20px 20px",
        opacity: 1,
      };
    default:
      return null;
  }
};

const getStatRingTextureGridBackground = (
  texture: CreatedaleyOpenerTexture,
): { background: string; opacity: number } | null => {
  switch (texture) {
    case "grid-dots":
      return {
        background:
          "repeating-linear-gradient(0deg, rgba(88, 76, 58, 0.14) 0 1.25px, transparent 1.25px 112px)," +
          "repeating-linear-gradient(90deg, rgba(88, 76, 58, 0.14) 0 1.25px, transparent 1.25px 112px)",
        opacity: 1,
      };
    case "plain":
      return {
        background:
          "repeating-linear-gradient(0deg, rgba(88, 76, 58, 0.045) 0 1px, transparent 1px 112px)," +
          "repeating-linear-gradient(90deg, rgba(88, 76, 58, 0.045) 0 1px, transparent 1px 112px)",
        opacity: 1,
      };
    default:
      return null;
  }
};

const getStatRingTextureVeil = (
  texture: CreatedaleyOpenerTexture,
): { background: string; opacity: number } | null => {
  switch (texture) {
    case "newsprint-grain":
      return {
        background:
          "linear-gradient(180deg, rgba(80, 58, 32, 0.04) 0%, rgba(80, 58, 32, 0.11) 100%)",
        opacity: 1,
      };
    case "warm-editorial":
      return {
        background:
          "linear-gradient(180deg, rgba(163, 94, 28, 0.04) 0%, rgba(163, 94, 28, 0.12) 100%)",
        opacity: 1,
      };
    default:
      return null;
  }
};

export const renderEditorialStatRingPreset = ({
  overlay,
  frame,
  animation,
  aspect,
  hasMediaClips,
}: PresetRendererProps) => {
  const { headline, highlight, subhead, value, suffix, color } =
    parseEditorialStatRingText(overlay.text);
  const { before, highlighted, after } = splitEditorialStatRingHeadline(
    headline,
    highlight,
  );
  const statRingTexture = overlay.createdaleyTexture ?? "plain";
  const isVertical = aspect === "reel_9_16";
  const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
  const sheetEntry = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const headlineReveal = interpolate(frame, [0, 10, 18, 24], [0, 0.08, 0.55, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subheadReveal = interpolate(frame, [6, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const ringReveal = interpolate(frame, [18, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const counterReveal = interpolate(frame, [20, 48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const highlightProgress = highlighted
    ? interpolate(frame, [28, 42], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: easeOut,
      })
    : 0;
  const pullback = interpolate(frame, [38, 72], [isVertical ? 1.06 : 1.12, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const wrapperOpacity = animation.baseOpacity;
  const wrapperBlur = animation.blur * 0.1;
  const wrapperTranslateY = animation.baseTranslateY * 0.05;
  const wrapperScale = animation.baseScale * pullback;
  const paperInset = hasMediaClips
    ? isVertical
      ? "1.4%"
      : "2.4%"
    : isVertical
      ? "1.2%"
      : "2.8%";
  const paperRadius = hasMediaClips ? (isVertical ? 28 : 10) : 0;
  const headlineSize = overlay.fontSize * (isVertical ? 0.64 : 0.75);
  const subheadSize = overlay.fontSize * (isVertical ? 0.17 : 0.2);
  const statSize = overlay.fontSize * (isVertical ? 1.16 : 1.26);
  const layout = isVertical
    ? {
        headerLeft: "8.5%",
        headerTop: "29.5%",
        headerWidth: "83%",
        ringLeft: "50%",
        ringTop: "59%",
        ringWidth: "43%",
      }
    : {
        headerLeft: "7.7%",
        headerTop: "37.2%",
        headerWidth: "56.5%",
        ringLeft: "79.2%",
        ringTop: "55.3%",
        ringWidth: "32.2%",
      };
  const ringRadius = 42;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringTarget = clamp01(value / 100);
  const ringSweep =
    ringReveal <= 0 ? 0 : Math.max(0.001, ringTarget * ringReveal * ringCircumference);
  const counterRaw = value * counterReveal;
  const displayValue =
    counterReveal >= 1
      ? value
      : Number.isInteger(value)
        ? Math.floor(counterRaw)
        : Number(counterRaw.toFixed(1));
  const ringPresence = interpolate(frame, [18, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const ringScale = interpolate(ringPresence, [0, 1], [0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ringStrokeWidth = isVertical ? 3.9 : 4.5;
  const dotTexture = getStatRingTextureDotBackground(statRingTexture, isVertical);
  const gridTexture = getStatRingTextureGridBackground(statRingTexture);
  const textureVeil = getStatRingTextureVeil(statRingTexture);
  const showNewsprintTexture =
    statRingTexture === "newsprint-grain" || statRingTexture === "warm-editorial";
  const newsprintOpacity = statRingTexture === "warm-editorial" ? 0.18 : 0.24;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: wrapperOpacity,
        filter: `blur(${wrapperBlur}px)`,
        transform: `translateY(${wrapperTranslateY}px) scale(${wrapperScale})`,
      }}
    >
      {hasMediaClips ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 50% 50%, rgba(10, 10, 14, 0) 52%, rgba(10, 10, 14, 0.6) 100%)",
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: paperInset,
          borderRadius: paperRadius,
          overflow: "hidden",
          background: getStatRingPaperFill(statRingTexture),
          boxShadow: hasMediaClips
            ? "0 22px 60px rgba(0, 0, 0, 0.28), inset 0 0 0 1px rgba(110, 92, 66, 0.08)"
            : "inset 0 0 0 1px rgba(110, 92, 66, 0.05)",
          transform: `scale(${interpolate(sheetEntry, [0, 1], [0.994, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })})`,
          transformOrigin: "center center",
        }}
      >
        {showNewsprintTexture ? (
          <NewsCrumpleTexture
            style={{
              opacity: newsprintOpacity,
              mixBlendMode: "multiply",
              pointerEvents: "none",
            }}
          />
        ) : null}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: getStatRingPaperShade(statRingTexture),
            pointerEvents: "none",
          }}
        />

        {gridTexture ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: gridTexture.background,
              opacity: gridTexture.opacity,
              pointerEvents: "none",
            }}
          />
        ) : null}

        {dotTexture ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: dotTexture.backgroundImage,
              backgroundSize: dotTexture.backgroundSize,
              opacity: dotTexture.opacity,
              mixBlendMode: "multiply",
              pointerEvents: "none",
            }}
          />
        ) : null}

        {textureVeil ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: textureVeil.background,
              opacity: textureVeil.opacity,
              mixBlendMode: "multiply",
              pointerEvents: "none",
            }}
          />
        ) : null}

        <div
          style={{
            position: "absolute",
            left: layout.headerLeft,
            top: layout.headerTop,
            width: layout.headerWidth,
            color: overlay.color,
          }}
        >
          <div
            style={{
              display: "block",
              clipPath: getRevealClipPath(headlineReveal),
              opacity: interpolate(headlineReveal, [0, 1], [0.2, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              paddingBottom: "0.08em",
            }}
          >
            <div
              style={{
                fontFamily: STAT_RING_HEADLINE_STACK,
                fontWeight: 700,
                fontSize: `${headlineSize}px`,
                lineHeight: 1.02,
                letterSpacing: "-0.035em",
                maxWidth: "100%",
                whiteSpace: "normal",
                textWrap: "wrap",
                paddingBottom: "0.12em",
              }}
            >
              {before}
              {highlighted ? (
                <span
                  style={{
                    position: "relative",
                    display: "inline-block",
                    fontStyle: "italic",
                    padding: "0.01em 0.12em 0.08em",
                    overflow: "visible",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: "0.02em",
                      right: "0.02em",
                      top: "0.41em",
                      bottom: "0.06em",
                      backgroundColor: color,
                      transform: `scaleX(${highlightProgress})`,
                      transformOrigin: "left center",
                      opacity: highlightProgress > 0 ? 0.88 : 0,
                      zIndex: 0,
                    }}
                  />
                  <span
                    style={{
                      position: "relative",
                      zIndex: 1,
                      fontStyle: "italic",
                    }}
                  >
                    {highlighted}
                  </span>
                </span>
              ) : null}
              {after}
            </div>
          </div>

          <div
            style={{
              marginTop: isVertical ? "0.78em" : "0.78em",
              maxWidth: isVertical ? "92%" : "71%",
              color: "rgba(68, 64, 59, 0.42)",
              fontFamily: STAT_RING_HEADLINE_STACK,
              fontWeight: 500,
              fontStyle: "italic",
              fontSize: `${subheadSize}px`,
              lineHeight: 1.19,
              opacity: subheadReveal,
              clipPath: getRevealClipPath(subheadReveal),
              transform: `translateY(${interpolate(subheadReveal, [0, 1], [8, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px)`,
            }}
          >
            {subhead}
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: layout.ringLeft,
            top: layout.ringTop,
            width: layout.ringWidth,
            aspectRatio: "1 / 1",
            transform: `translate(-50%, -50%) scale(${ringScale})`,
            opacity: ringPresence,
            filter: `blur(${interpolate(ringPresence, [0, 1], [1.6, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
            <circle
              cx="50"
              cy="50"
              r={ringRadius}
              fill="none"
              stroke={color}
              strokeWidth={ringStrokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${ringSweep} ${ringCircumference}`}
              transform="rotate(-90 50 50)"
            />
            <circle
              cx="50"
              cy="50"
              r={ringRadius}
              fill="none"
              stroke={color}
              strokeWidth={ringStrokeWidth * 0.64}
              strokeLinecap="round"
              strokeDasharray={`${ringSweep} ${ringCircumference}`}
              opacity={0.18}
              transform="rotate(-90 50 50)"
            />
          </svg>

          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.04em",
              color,
              fontFamily: STAT_RING_NUMBER_STACK,
              fontWeight: 600,
              fontStyle: "italic",
              lineHeight: 1,
            }}
          >
            <span
              style={{
                fontSize: `${statSize}px`,
                letterSpacing: "-0.05em",
              }}
            >
              {formatEditorialStatRingValue(displayValue, "")}
            </span>
            <span
              style={{
                fontSize: `${statSize * 0.78}px`,
                letterSpacing: "-0.045em",
                transform: "translateY(0.03em)",
              }}
            >
              {suffix}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
