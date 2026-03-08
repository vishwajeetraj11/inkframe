import { parseCreatedaleyOpenerText } from "@/lib/editor/createdaley-opener";
import { Easing, interpolate } from "remotion";
import type { PresetRendererProps } from "./types";
import {
  CREATEDALEY_EDGE_SIDES,
  EDITORIAL_SERIF_STACK,
  NEWS_CRUMPLE_TEXTURE_SRC,
  clamp01,
  getCreatedaleyEdgeBandClipPath,
  getCreatedaleyPaperBounds,
  getCreatedaleyPaperClipPath,
  getRevealClipPath,
  getRevealSweepLeft,
} from "./shared";
export const renderCreatedaleyOpenerPreset = ({
  overlay,
  frame,
  animation,
  aspect,
  hasMediaClips,
}: PresetRendererProps) => {
  const { wordmark, pronunciation, partOfSpeech, definition } =
    parseCreatedaleyOpenerText(overlay.text);
  const isVertical = aspect === "reel_9_16";
  const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
  const paperReveal = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const wordSettle = interpolate(frame, [8, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const wordReveal = interpolate(frame, [8, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const pronunciationReveal = interpolate(frame, [24, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const partOfSpeechReveal = interpolate(frame, [30, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const ruleReveal = interpolate(frame, [34, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const contentPullback = interpolate(frame, [42, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const definitionReveal = interpolate(frame, [56, 104], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const wrapperOpacity = animation.baseOpacity;
  const wrapperBlur = animation.blur * 0.08;
  const wrapperTranslateY = animation.baseTranslateY * 0.08;
  const paperClipPath = getCreatedaleyPaperClipPath(paperReveal);
  const paperBounds = getCreatedaleyPaperBounds(paperReveal);
  const edgeStripWidth = isVertical ? "6.2%" : "4.5%";
  const edgeShadowOpacity = interpolate(paperReveal, [0, 0.12, 1], [0, 0.24, 0.48], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const edgeDetailOpacity = interpolate(paperReveal, [0, 0.18, 1], [0, 0.28, 0.72], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const contentScale = interpolate(contentPullback, [0, 1], [isVertical ? 1.3 : 2, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const contentShiftY = interpolate(contentPullback, [0, 1], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wordmarkScaleFactor =
    wordmark.length > 14 ? Math.max(0.72, 14 / wordmark.length) : 1;
  const layout = isVertical
    ? {
        contentTop: "15.5%",
        containerWidth: "82%",
        textColumnWidth: "90%",
        wordmarkSize: overlay.fontSize * 1.02 * wordmarkScaleFactor,
        pronunciationSize: overlay.fontSize * 0.4,
        partOfSpeechSize: overlay.fontSize * 0.34,
        definitionSize: overlay.fontSize * 0.34,
        wordmarkLineHeight: 0.95,
        definitionLineHeight: 1.17,
      }
    : {
        contentTop: "17.5%",
        containerWidth: "60%",
        textColumnWidth: "72%",
        wordmarkSize: overlay.fontSize * 1.46 * wordmarkScaleFactor,
        pronunciationSize: overlay.fontSize * 0.53,
        partOfSpeechSize: overlay.fontSize * 0.4,
        definitionSize: overlay.fontSize * 0.43,
        wordmarkLineHeight: 0.92,
        definitionLineHeight: 1.18,
      };
  const wordmarkBaseTransform = `translateY(${interpolate(wordSettle, [0, 1], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })}px) scale(${interpolate(wordSettle, [0, 1], [1.18, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })})`;
  const wordmarkStyle = {
    fontFamily: EDITORIAL_SERIF_STACK,
    fontWeight: Math.min(Math.max(500, overlay.fontWeight), 600),
    fontStyle: "normal" as const,
    fontSize: `${layout.wordmarkSize}px`,
    lineHeight: layout.wordmarkLineHeight,
    letterSpacing: "-0.03em",
    whiteSpace: "nowrap" as const,
    transform: wordmarkBaseTransform,
    transformOrigin: "center center",
    opacity: interpolate(wordSettle, [0, 1], [0.18, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  };
  const pronunciationStyle = {
    color: "rgba(32, 33, 36, 0.96)",
    fontFamily: EDITORIAL_SERIF_STACK,
    fontWeight: 400,
    fontStyle: "normal" as const,
    fontSize: `${layout.pronunciationSize}px`,
    lineHeight: 1.08,
    whiteSpace: "nowrap" as const,
  };
  const definitionStyle = {
    color: "rgba(45, 46, 51, 0.9)",
    fontFamily: EDITORIAL_SERIF_STACK,
    fontWeight: 400,
    fontStyle: "normal" as const,
    fontSize: `${layout.definitionSize}px`,
    lineHeight: layout.definitionLineHeight,
    letterSpacing: "-0.012em",
    textAlign: "left" as const,
  };
  const wordRevealGlow = clamp01(wordReveal + 0.15);
  const pronunciationRevealGlow = clamp01(pronunciationReveal + 0.12);
  const definitionRevealGlow = clamp01(definitionReveal + 0.1);
  const wordSweepOpacity = interpolate(wordReveal, [0, 0.08, 0.84, 1], [0, 0.88, 0.24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pronunciationSweepOpacity = interpolate(
    pronunciationReveal,
    [0, 0.08, 0.84, 1],
    [0, 0.62, 0.16, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const bodySweepOpacity = interpolate(definitionReveal, [0, 0.08, 0.88, 1], [0, 0.76, 0.2, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const createdaleyTexture = overlay.createdaleyTexture ?? "plain";
  const paperFillBackground =
    createdaleyTexture === "warm-editorial"
      ? "linear-gradient(160deg, rgba(247, 242, 232, 0.985) 0%, rgba(232, 222, 203, 0.985) 100%)"
      : createdaleyTexture === "newsprint-grain"
        ? "#f4f0e5"
        : "#f6f4ee";
  const showDotTexture =
    createdaleyTexture === "dots" ||
    createdaleyTexture === "grid-dots" ||
    createdaleyTexture === "warm-editorial";
  const showGridTexture = createdaleyTexture === "grid-dots";
  const showNewsprintTexture = createdaleyTexture === "newsprint-grain";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: wrapperOpacity,
        filter: `blur(${wrapperBlur}px)`,
        transform: `translateY(${wrapperTranslateY}px)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 18% 18%, rgba(104, 65, 118, 0.22), rgba(104, 65, 118, 0) 30%)," +
            "radial-gradient(circle at 82% 20%, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 24%)," +
            "linear-gradient(180deg, rgba(10, 11, 15, 0.92), rgba(18, 12, 24, 0.9))",
          opacity: hasMediaClips ? 0.56 : 1,
          mixBlendMode: hasMediaClips ? "multiply" : "normal",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0) 40%, rgba(0, 0, 0, 0.42) 100%)",
          opacity: hasMediaClips ? 0.64 : 0.44,
          pointerEvents: "none",
        }}
      />

      {CREATEDALEY_EDGE_SIDES.map((side) => {
        const isLeft = side === "left";
        const anchor = isLeft ? paperBounds.left : paperBounds.right;

        return (
          <div
            key={`createdaley-edge-shadow-${side}`}
            style={{
              position: "absolute",
              top: "-1.5%",
              bottom: "-1.5%",
              left: `${anchor}%`,
              width: edgeStripWidth,
              transform: `translateX(${isLeft ? "-74%" : "-26%"})`,
              clipPath: getCreatedaleyEdgeBandClipPath(side),
              background: isLeft
                ? "linear-gradient(90deg, rgba(0, 0, 0, 0.26) 0%, rgba(0, 0, 0, 0.1) 38%, rgba(0, 0, 0, 0) 100%)"
                : "linear-gradient(270deg, rgba(0, 0, 0, 0.26) 0%, rgba(0, 0, 0, 0.1) 38%, rgba(0, 0, 0, 0) 100%)",
              filter: "blur(12px)",
              opacity: edgeShadowOpacity,
              pointerEvents: "none",
            }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: paperClipPath,
          filter:
            "drop-shadow(0 16px 38px rgba(0, 0, 0, 0.18)) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.1))",
          background: paperFillBackground,
          overflow: "hidden",
        }}
      >
        {showNewsprintTexture ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${NEWS_CRUMPLE_TEXTURE_SRC})`,
              backgroundSize: "100% 100%",
              backgroundPosition: "center",
              opacity: 0.09,
              mixBlendMode: "multiply",
            }}
          />
        ) : null}
        {showDotTexture ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "radial-gradient(circle at 1.2px 1.2px, rgba(48, 42, 36, 0.14) 0 0.95px, transparent 1.15px)," +
                "radial-gradient(circle at 6px 6px, rgba(48, 42, 36, 0.045) 0 0.7px, transparent 0.9px)",
              backgroundSize: isVertical ? "9px 9px, 18px 18px" : "10px 10px, 20px 20px",
              backgroundPosition: isVertical ? "0 0, 0 0" : "1px 1px, 2px 2px",
              opacity: createdaleyTexture === "warm-editorial" ? 0.13 : 0.2,
              mixBlendMode: "multiply",
            }}
          />
        ) : null}
        {showGridTexture ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(80, 71, 58, 0.07) 0 1px, transparent 1px 84px)," +
                "repeating-linear-gradient(90deg, rgba(80, 71, 58, 0.07) 0 1px, transparent 1px 84px)",
              opacity: 0.32,
              mixBlendMode: "multiply",
            }}
          />
        ) : null}
        {createdaleyTexture === "warm-editorial" ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 32% 20%, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0) 28%)," +
                "radial-gradient(circle at 76% 70%, rgba(154, 120, 74, 0.12), rgba(154, 120, 74, 0) 26%)",
              opacity: 0.24,
              mixBlendMode: "screen",
            }}
          />
        ) : null}
        {CREATEDALEY_EDGE_SIDES.map((side) => {
          const isLeft = side === "left";

          return (
            <div
              key={`createdaley-edge-detail-${side}`}
              style={{
                position: "absolute",
                top: "-1%",
                bottom: "-1%",
                [isLeft ? "left" : "right"]: "-0.6%",
                width: isVertical ? "8.5%" : "6.2%",
                clipPath: getCreatedaleyEdgeBandClipPath(side),
                opacity: edgeDetailOpacity,
                backgroundImage: isLeft
                  ? "linear-gradient(90deg, rgba(38, 33, 28, 0.16) 0%, rgba(255, 255, 255, 0.34) 42%, rgba(255, 255, 255, 0) 100%), radial-gradient(circle at 22% 14%, rgba(255, 255, 255, 0.72) 0 1.2px, transparent 1.3px), radial-gradient(circle at 30% 58%, rgba(67, 58, 49, 0.22) 0 0.8px, transparent 0.9px), radial-gradient(circle at 52% 78%, rgba(255, 255, 255, 0.6) 0 1px, transparent 1.2px)"
                  : "linear-gradient(270deg, rgba(38, 33, 28, 0.16) 0%, rgba(255, 255, 255, 0.34) 42%, rgba(255, 255, 255, 0) 100%), radial-gradient(circle at 78% 14%, rgba(255, 255, 255, 0.72) 0 1.2px, transparent 1.3px), radial-gradient(circle at 70% 58%, rgba(67, 58, 49, 0.22) 0 0.8px, transparent 0.9px), radial-gradient(circle at 48% 78%, rgba(255, 255, 255, 0.6) 0 1px, transparent 1.2px)",
                backgroundSize: "100% 100%, 8px 14px, 7px 11px, 10px 16px",
                backgroundPosition: isLeft
                  ? `0 0, ${Math.sin(frame / 17) * 2}px ${Math.cos(frame / 14) * 2}px, ${Math.cos(frame / 15) * 1.5}px ${Math.sin(frame / 18) * 1.8}px, ${Math.sin(frame / 12) * 1.2}px ${Math.cos(frame / 20) * 1.4}px`
                  : `0 0, ${Math.sin(frame / 16) * -2}px ${Math.cos(frame / 13) * 2}px, ${Math.cos(frame / 14) * -1.5}px ${Math.sin(frame / 18) * 1.8}px, ${Math.sin(frame / 11) * -1.2}px ${Math.cos(frame / 19) * 1.4}px`,
                mixBlendMode: "multiply",
                pointerEvents: "none",
              }}
            />
          );
        })}

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: layout.contentTop,
            width: layout.containerWidth,
            transform: `translateX(-50%) translateY(${contentShiftY}px) scale(${contentScale})`,
            transformOrigin: "center top",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            color: overlay.color,
          }}
        >
          <div
            style={{
              width: "100%",
              overflow: "hidden",
              position: "relative",
              textAlign: "center",
            }}
          >
            <div
              style={{
                ...wordmarkStyle,
                position: "absolute",
                inset: 0,
                clipPath: getRevealClipPath(wordRevealGlow),
                color: "rgba(255, 252, 244, 0.7)",
                filter: `blur(${isVertical ? 4 : 6}px)`,
                transform: `${wordmarkBaseTransform} translateX(${interpolate(wordReveal, [0, 1], [12, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })}px)`,
                mixBlendMode: "screen",
                opacity: interpolate(wordReveal, [0, 0.12, 1], [0, 0.55, 0.12], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              {wordmark}
            </div>
            <div
              style={{
                position: "absolute",
                top: "-12%",
                bottom: "-14%",
                left: getRevealSweepLeft(wordReveal, isVertical ? 22 : 16),
                width: isVertical ? "22%" : "16%",
                background:
                  "linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 252, 245, 0.9) 48%, rgba(255, 255, 255, 0.18) 72%, rgba(255, 255, 255, 0) 100%)",
                filter: "blur(10px)",
                transform: "skewX(-14deg)",
                opacity: wordSweepOpacity,
                mixBlendMode: "screen",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                ...wordmarkStyle,
                clipPath: getRevealClipPath(wordReveal),
              }}
            >
              {wordmark}
            </div>
          </div>

          <div
            style={{
              width: layout.textColumnWidth,
              marginTop: isVertical ? "1.25em" : "0.95em",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "flex-start",
                gap: "0.3em",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <span
                style={{
                  ...pronunciationStyle,
                  position: "absolute",
                  inset: 0,
                  clipPath: getRevealClipPath(pronunciationRevealGlow),
                  color: "rgba(255, 251, 242, 0.55)",
                  filter: "blur(3px)",
                  transform: `translateX(${interpolate(pronunciationReveal, [0, 1], [8, 0], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}px)`,
                  mixBlendMode: "screen",
                  opacity: interpolate(pronunciationReveal, [0, 0.12, 1], [0, 0.38, 0.08], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                  pointerEvents: "none",
                }}
              >
                [{pronunciation}]
              </span>
              <span
                style={{
                  position: "absolute",
                  top: "-18%",
                  bottom: "-18%",
                  left: getRevealSweepLeft(pronunciationReveal, isVertical ? 18 : 14),
                  width: isVertical ? "18%" : "14%",
                  background:
                    "linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 253, 246, 0.78) 48%, rgba(255, 255, 255, 0) 100%)",
                  filter: "blur(8px)",
                  transform: "skewX(-12deg)",
                  opacity: pronunciationSweepOpacity,
                  mixBlendMode: "screen",
                  pointerEvents: "none",
                }}
              />
              <span
                style={{
                  display: "inline-block",
                  position: "relative",
                  clipPath: getRevealClipPath(pronunciationReveal),
                  ...pronunciationStyle,
                }}
              >
                [{pronunciation}]
              </span>
              <span
                style={{
                  color: "rgba(32, 33, 36, 0.72)",
                  fontFamily: EDITORIAL_SERIF_STACK,
                  fontWeight: 400,
                  fontStyle: "italic",
                  fontSize: `${layout.partOfSpeechSize}px`,
                  lineHeight: 1,
                  opacity: clamp01(partOfSpeechReveal),
                  transform: `translateX(${interpolate(partOfSpeechReveal, [0, 1], [10, 0], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}px)`,
                }}
              >
                {partOfSpeech}
              </span>
            </div>

            <div
              style={{
                marginTop: isVertical ? "0.42em" : "0.36em",
                width: isVertical ? "88%" : "84%",
                height: isVertical ? "2.5px" : "3px",
                backgroundColor: "rgba(18, 18, 20, 0.95)",
                transform: `scaleX(${ruleReveal})`,
                transformOrigin: "left center",
              }}
            />

            <div
              style={{
                marginTop: isVertical ? "0.78em" : "0.68em",
                width: "100%",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  ...definitionStyle,
                  position: "absolute",
                  inset: 0,
                  clipPath: getRevealClipPath(definitionRevealGlow),
                  color: "rgba(255, 252, 244, 0.32)",
                  filter: "blur(4px)",
                  transform: `translateX(${interpolate(definitionReveal, [0, 1], [10, 0], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}px)`,
                  mixBlendMode: "screen",
                  opacity: interpolate(definitionReveal, [0, 0.12, 1], [0, 0.34, 0.08], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                  pointerEvents: "none",
                }}
              >
                {definition}
              </div>
              <div
                style={{
                  position: "absolute",
                  top: "-10%",
                  bottom: "-12%",
                  left: getRevealSweepLeft(definitionReveal, isVertical ? 18 : 14),
                  width: isVertical ? "18%" : "14%",
                  background:
                    "linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 252, 245, 0.66) 48%, rgba(255, 255, 255, 0.12) 72%, rgba(255, 255, 255, 0) 100%)",
                  filter: "blur(9px)",
                  transform: "skewX(-12deg)",
                  opacity: bodySweepOpacity,
                  mixBlendMode: "screen",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  ...definitionStyle,
                  clipPath: getRevealClipPath(definitionReveal),
                  opacity: interpolate(definitionReveal, [0, 1], [0.08, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                  transform: `translateY(${interpolate(definitionReveal, [0, 1], [8, 0], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}px)`,
                }}
              >
                {definition}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

