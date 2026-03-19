import { Easing, interpolate, spring } from "remotion";
import { REMOTION_FONT_STACKS } from "../fonts";
import type { PresetRendererProps } from "./types";
import {
  EDITORIAL_SERIF_STACK,
  FONT_STACK_BY_FAMILY,
  splitOverlayLines,
} from "./shared";

type HeroFontTreatment = {
  fontFamily: string;
  fontStyle: "normal" | "italic";
  fontWeight: number;
  letterSpacing: string;
};

const VOX_TYPOGRAPHY_HERO_SEQUENCE: HeroFontTreatment[] = [
  {
    fontFamily: REMOTION_FONT_STACKS.statRingHeadline,
    fontStyle: "italic",
    fontWeight: 700,
    letterSpacing: "-0.06em",
  },
  {
    fontFamily: REMOTION_FONT_STACKS.editorialSerif,
    fontStyle: "italic",
    fontWeight: 700,
    letterSpacing: "-0.085em",
  },
  {
    fontFamily: REMOTION_FONT_STACKS.display,
    fontStyle: "normal",
    fontWeight: 700,
    letterSpacing: "-0.05em",
  },
  {
    fontFamily: REMOTION_FONT_STACKS.condensed,
    fontStyle: "normal",
    fontWeight: 700,
    letterSpacing: "-0.03em",
  },
  {
    fontFamily: EDITORIAL_SERIF_STACK,
    fontStyle: "italic",
    fontWeight: 700,
    letterSpacing: "-0.07em",
  },
];

const normalizeVoxTypographyHeadline = (value: string): string => {
  if (value.trim().toLowerCase() === "phytypography") {
    return "typography";
  }

  return value;
};

const parseVoxTypographyText = (
  text: string,
): {
  badge: string;
  headline: string;
  subline: string;
  typedLine: string;
  eyebrow: string;
  ghostLetters: string;
} => {
  const lines = splitOverlayLines(text);

  return {
    badge: lines[0] || "Vox",
    headline: normalizeVoxTypographyHeadline(lines[1] || "typography"),
    subline: lines[2] || "animations",
    typedLine: lines[3] || "feel so",
    eyebrow: lines[4] || "Vox typography",
    ghostLetters: lines[5] || "Aa",
  };
};

const getTypedText = (text: string, progress: number): string => {
  const visibleChars = Math.round(
    interpolate(progress, [0, 1], [0, text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  return text.slice(0, Math.max(0, visibleChars));
};

const TypographyScreen = ({
  frame,
  isVertical,
  eyebrow,
  badge,
  headline,
  subline,
  ghostLetters,
  opacity,
  exitProgress,
}: {
  frame: number;
  isVertical: boolean;
  eyebrow: string;
  badge: string;
  headline: string;
  subline: string;
  ghostLetters: string;
  opacity: number;
  exitProgress: number;
}) => {
  const entry = spring({
    frame,
    fps: 30,
    config: {
      damping: 180,
      stiffness: 220,
      mass: 0.9,
    },
  });
  const headlineLength = Math.max(1, headline.length);
  const heroFontSize = interpolate(
    headlineLength,
    [4, 10, 18],
    [isVertical ? 172 : 144, isVertical ? 142 : 118, isVertical ? 116 : 96],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const ghostFontSize = isVertical ? 242 : 208;
  const headlineEnter = interpolate(entry, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ghostDraw = spring({
    frame: Math.max(0, frame - 8),
    fps: 30,
    config: {
      damping: 200,
      stiffness: 160,
      mass: 0.95,
    },
  });
  const ghostStrokeLength = isVertical ? 1800 : 1500;
  const ghostStrokeOffset = interpolate(ghostDraw, [0, 1], [ghostStrokeLength, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ghostFillOpacity = interpolate(ghostDraw, [0.68, 1], [0, 0.08], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chromaShift = Math.sin(frame / 11) * 0.75;
  const heroFontFrame = Math.max(0, frame - 2);
  const heroFontTreatment =
    VOX_TYPOGRAPHY_HERO_SEQUENCE[
      Math.min(
        VOX_TYPOGRAPHY_HERO_SEQUENCE.length - 1,
        Math.floor(heroFontFrame / 4),
      )
    ];
  const screenLift = interpolate(exitProgress, [0, 1], [0, -22], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const screenScale = interpolate(exitProgress, [0, 1], [1, 0.985], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        transform: `translateY(${screenLift}px) scale(${screenScale})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: isVertical ? "8%" : "10%",
          transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.8)",
          fontFamily: FONT_STACK_BY_FAMILY.sans,
          fontWeight: 500,
          fontSize: isVertical ? 26 : 18,
          letterSpacing: "-0.03em",
          opacity: headlineEnter,
          textAlign: "center",
        }}
      >
        {eyebrow}
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: isVertical ? "18%" : "19%",
          padding: isVertical ? "0.18em 0.22em 0.12em" : "0.14em 0.22em 0.1em",
          background: "#f4e72e",
          color: "#111111",
          fontFamily: EDITORIAL_SERIF_STACK,
          fontWeight: 700,
          fontStyle: "italic",
          fontSize: isVertical ? 64 : 44,
          lineHeight: 0.86,
          letterSpacing: "-0.05em",
          boxShadow: "0 14px 24px rgba(0,0,0,0.24)",
          opacity: interpolate(headlineEnter, [0, 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          transform: `translateX(-50%) translateY(${interpolate(headlineEnter, [0, 1], [18, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px) rotate(${interpolate(headlineEnter, [0, 1], [-3, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}deg)`,
        }}
      >
        {badge}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: isVertical ? "33%" : "31%",
          color: "#f4ece6",
          fontFamily: heroFontTreatment.fontFamily,
          fontWeight: heroFontTreatment.fontWeight,
          fontStyle: heroFontTreatment.fontStyle,
          fontSize: heroFontSize,
          lineHeight: 0.86,
          letterSpacing: heroFontTreatment.letterSpacing,
          textShadow: `${chromaShift}px 0 0 rgba(184, 92, 255, 0.15), 0 12px 28px rgba(0,0,0,0.22)`,
          opacity: headlineEnter,
          display: "flex",
          justifyContent: "center",
          textAlign: "center",
          transform: `translateX(${interpolate(headlineEnter, [0, 1], [18, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px)`,
        }}
      >
        <span
          style={{
            position: "relative",
            display: "inline-block",
            whiteSpace: "nowrap",
          }}
        >
          {headline}
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: isVertical ? "47%" : "46%",
          color: "#f0c83e",
          fontFamily: FONT_STACK_BY_FAMILY.mono,
          fontWeight: 700,
          fontSize: isVertical ? 24 : 18,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          opacity: interpolate(headlineEnter, [0.2, 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          transform: `translateY(${interpolate(headlineEnter, [0, 1], [12, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px)`,
          textAlign: "center",
        }}
      >
        {subline}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: isVertical ? "10%" : "7%",
          opacity: interpolate(headlineEnter, [0.15, 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <svg
          viewBox="0 0 1000 340"
          style={{
            width: isVertical ? "74%" : "54%",
            height: isVertical ? 240 : 196,
            overflow: "visible",
          }}
          aria-hidden="true"
        >
          <text
            x="50%"
            y="72%"
            textAnchor="middle"
            fontFamily={EDITORIAL_SERIF_STACK}
            fontWeight={700}
            fontStyle="italic"
            fontSize={ghostFontSize}
            letterSpacing="-0.08em"
            fill={`rgba(222, 206, 160, ${ghostFillOpacity})`}
            stroke="rgba(222, 206, 160, 0.22)"
            strokeWidth={isVertical ? 1.8 : 2}
            strokeLinejoin="round"
            paintOrder="stroke"
            style={{
              filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.08))",
              strokeDasharray: `${ghostStrokeLength}`,
              strokeDashoffset: ghostStrokeOffset,
            }}
          >
            {ghostLetters}
          </text>
        </svg>
      </div>
    </div>
  );
};

const TypewriterScreen = ({
  frame,
  opacity,
  typedLine,
  eyebrow,
  isVertical,
  enterProgress,
  typeProgress,
}: {
  frame: number;
  opacity: number;
  typedLine: string;
  eyebrow: string;
  isVertical: boolean;
  enterProgress: number;
  typeProgress: number;
}) => {
  const typedText = getTypedText(typedLine, typeProgress);
  const paperLift = interpolate(enterProgress, [0, 1], [160, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const machineRise = interpolate(enterProgress, [0, 1], [70, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const machineScale = interpolate(enterProgress, [0, 1], [0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const carriageX = interpolate(typeProgress, [0, 1], [-36, 40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const keyGlow = 0.18 + Math.sin(frame / 7) * 0.08;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(5,7,9,0.92) 0%, rgba(5,7,9,0.74) 28%, rgba(5,7,9,0.18) 42%, rgba(5,7,9,0) 52%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: isVertical ? "9%" : "8%",
          top: isVertical ? "8%" : "9%",
          color: "rgba(255,255,255,0.82)",
          fontFamily: FONT_STACK_BY_FAMILY.sans,
          fontWeight: 500,
          fontSize: isVertical ? 26 : 18,
          letterSpacing: "-0.03em",
          opacity: interpolate(enterProgress, [0, 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {eyebrow} animations feel so
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: isVertical ? "16%" : "10%",
          width: isVertical ? "76%" : "40%",
          height: isVertical ? "28%" : "32%",
          transform: `translateX(-50%) translateY(${paperLift}px)`,
          opacity: interpolate(enterProgress, [0, 1], [0.4, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(244,241,236,0.98) 100%)",
            borderRadius: "10px 10px 0 0",
            boxShadow: "0 18px 36px rgba(0,0,0,0.2)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(185,166,140,0.08), rgba(255,255,255,0))",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "10%",
              right: "10%",
              top: "38%",
              color: "#1d1d1d",
              fontFamily: EDITORIAL_SERIF_STACK,
              fontWeight: 500,
              fontSize: isVertical ? 34 : 28,
              lineHeight: 1,
              letterSpacing: "-0.04em",
            }}
          >
            {typedText}
            <span style={{ opacity: typeProgress < 1 ? 1 : 0.35 }}>|</span>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 0,
          width: isVertical ? "100%" : "100%",
          height: isVertical ? "62%" : "70%",
          transform: `translateX(-50%) translateY(${machineRise}px) scale(${machineScale})`,
          transformOrigin: "center bottom",
          borderRadius: isVertical ? "42px 42px 0 0" : "32px 32px 0 0",
          background: "linear-gradient(180deg, #d4f1ef 0%, #9fcfcb 45%, #5f8483 100%)",
          boxShadow: "0 30px 60px rgba(0,0,0,0.34)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 20% 18%, rgba(255,255,255,0.42), rgba(255,255,255,0) 22%)," +
              "radial-gradient(circle at 78% 16%, rgba(255,255,255,0.22), rgba(255,255,255,0) 18%)," +
              "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(0,0,0,0.08) 72%, rgba(0,0,0,0.22) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: isVertical ? "18%" : "22%",
            right: isVertical ? "18%" : "22%",
            top: isVertical ? "12%" : "11%",
            height: isVertical ? "6%" : "5%",
            borderRadius: 999,
            background: "linear-gradient(180deg, #1d2326 0%, #3a474c 100%)",
            boxShadow: "inset 0 2px 5px rgba(255,255,255,0.1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: isVertical ? "28%" : "33%",
            right: isVertical ? "28%" : "33%",
            top: isVertical ? "8%" : "8%",
            height: isVertical ? "3%" : "3%",
            borderRadius: 999,
            background: "linear-gradient(180deg, #c7d1d5 0%, #8c989e 100%)",
            transform: `translateX(${carriageX}px)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: isVertical ? "10%" : "14%",
            right: isVertical ? "10%" : "14%",
            bottom: isVertical ? "14%" : "11%",
            height: isVertical ? "24%" : "20%",
            display: "grid",
            gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
            gap: isVertical ? "8px" : "6px",
          }}
        >
          {Array.from({ length: 30 }, (_, index) => (
            <div
              key={`typewriter-key-${index}`}
              style={{
                height: isVertical ? 18 : 14,
                borderRadius: 999,
                background:
                  index === 29
                    ? "linear-gradient(180deg, #ff6b6b 0%, #cc4e4e 100%)"
                    : "linear-gradient(180deg, #24282b 0%, #5a6469 100%)",
                boxShadow: `0 1px 0 rgba(255,255,255,${keyGlow}), inset 0 1px 2px rgba(255,255,255,0.08)`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export const renderVoxTypographyPreset = ({
  overlay,
  frame,
  safeDuration,
  animation,
  aspect,
  hasMediaClips,
}: PresetRendererProps) => {
  const { badge, headline, subline, typedLine, eyebrow, ghostLetters } =
    parseVoxTypographyText(overlay.text);
  const isVertical = aspect === "reel_9_16";
  const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
  const transitionStart = Math.max(18, Math.round(safeDuration * 0.44));
  const transitionDuration = Math.max(8, Math.min(14, Math.round(safeDuration * 0.14)));
  const transitionEnd = transitionStart + transitionDuration;
  const firstScreenExit = interpolate(frame, [transitionStart, transitionEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const secondScreenEnter = interpolate(frame, [transitionStart + 2, transitionEnd + 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const typeProgress = interpolate(frame, [transitionEnd + 4, transitionEnd + 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const wrapperOpacity = animation.baseOpacity;
  const wrapperScale = animation.baseScale;
  const wrapperBlur = animation.blur * 0.14;
  const firstScreenOpacity = interpolate(firstScreenExit, [0, 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const secondScreenOpacity = interpolate(secondScreenEnter, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: wrapperOpacity,
        filter: `blur(${wrapperBlur}px)`,
        transform: `translateY(${animation.baseTranslateY * 0.12}px) scale(${wrapperScale})`,
      }}
    >
      {!hasMediaClips ? (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 48px)," +
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 48px)",
              opacity: 0.42,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 28% 30%, rgba(255,255,255,0.06), rgba(255,255,255,0) 26%)," +
                "radial-gradient(circle at 74% 18%, rgba(169, 213, 214, 0.12), rgba(169, 213, 214, 0) 22%)," +
                "radial-gradient(circle at 52% 76%, rgba(0,0,0,0), rgba(0,0,0,0.44) 100%)",
            }}
          />
        </>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(6,8,10,0.12), rgba(6,8,10,0.34))",
          }}
        />
      )}

      <TypographyScreen
        frame={frame}
        isVertical={isVertical}
        eyebrow={eyebrow}
        badge={badge}
        headline={headline}
        subline={subline}
        ghostLetters={ghostLetters}
        opacity={firstScreenOpacity}
        exitProgress={firstScreenExit}
      />

      <TypewriterScreen
        frame={frame}
        opacity={secondScreenOpacity}
        typedLine={typedLine}
        eyebrow={eyebrow}
        isVertical={isVertical}
        enterProgress={secondScreenEnter}
        typeProgress={typeProgress}
      />
    </div>
  );
};
