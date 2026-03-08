import { interpolate, spring } from "remotion";
import type { PresetRendererProps } from "./types";
import {
  FONT_STACK_BY_FAMILY,
  chunkWords,
  parseVoxExplainerPresetText,
  splitOverlayWords,
} from "./shared";
export const renderVoxExplainerPreset = ({
  overlay,
  frame,
  safeDuration,
  animation,
}: PresetRendererProps) => {
  const { kicker, headline, deck, stat } = parseVoxExplainerPresetText(
    overlay.text,
  );
  const headlineChunks = chunkWords(
    splitOverlayWords(headline).filter((word) => word.length > 0),
    2,
  );
  const safeHeadlineChunks =
    headlineChunks.length > 0 ? headlineChunks : [["Why", "this"]];
  const highlightChunkIndex = safeHeadlineChunks.reduce(
    (bestIndex, chunk, index) => {
      const bestLength = safeHeadlineChunks[bestIndex]?.join(" ").length ?? 0;
      const chunkLength = chunk.join(" ").length;
      return chunkLength > bestLength ? index : bestIndex;
    },
    0,
  );

  const cardEntry = spring({
    frame,
    fps: 30,
    config: {
      damping: 170,
      stiffness: 220,
      mass: 0.96,
    },
  });
  const cardOpacity = interpolate(cardEntry, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardTranslateX = interpolate(cardEntry, [0, 1], [-36, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const kickerProgress = interpolate(
    frame,
    [0, Math.max(2, Math.round(safeDuration * 0.1))],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const deckEntry = spring({
    frame: frame - Math.round(safeDuration * 0.28),
    fps: 30,
    config: {
      damping: 180,
      stiffness: 220,
      mass: 0.95,
    },
  });
  const deckOpacity = interpolate(deckEntry, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const deckRise = interpolate(deckEntry, [0, 1], [22, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const statEntry = spring({
    frame: frame - Math.round(safeDuration * 0.4),
    fps: 30,
    config: {
      damping: 150,
      stiffness: 250,
      mass: 0.88,
    },
  });
  const statOpacity = interpolate(statEntry, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const statScale = interpolate(statEntry, [0, 1], [0.82, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const outroStart = Math.max(0, safeDuration - 12);
  const outroProgress = interpolate(frame, [outroStart, safeDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const focusScale = interpolate(outroProgress, [0, 1], [1, 1.03], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const focusBlur = interpolate(outroProgress, [0, 1], [0, 6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        transform: `translate(-50%, -50%) translateX(${cardTranslateX}px) translateY(${animation.baseTranslateY * 0.18}px) scale(${animation.baseScale * focusScale})`,
        opacity: animation.baseOpacity * cardOpacity,
        filter: `blur(${animation.blur * 0.18 + focusBlur}px)`,
        width: "78%",
        maxWidth: "78%",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "stretch",
          overflow: "hidden",
          backgroundColor: "rgba(248, 243, 232, 0.94)",
          border: "1px solid rgba(34, 24, 10, 0.18)",
          boxShadow: "0 18px 40px rgba(0, 0, 0, 0.28)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 14% 18%, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0) 30%)," +
              "radial-gradient(circle at 86% 20%, rgba(214, 161, 23, 0.12), rgba(214, 161, 23, 0) 28%)," +
              "radial-gradient(circle at 76% 74%, rgba(87, 64, 26, 0.1), rgba(87, 64, 26, 0) 24%)," +
              "repeating-linear-gradient(0deg, rgba(76, 58, 24, 0.06) 0 1px, transparent 1px 58px)," +
              "repeating-linear-gradient(90deg, rgba(76, 58, 24, 0.045) 0 1px, transparent 1px 72px)",
            opacity: 0.95,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(35, 24, 7, 0.07) 1px, transparent 1.1px)",
            backgroundSize: "9px 9px",
            opacity: 0.18,
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: 14,
            flexShrink: 0,
            backgroundColor: "#d6a117",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "0.42em",
            padding: "1.04em 1.18em 0.98em 1.04em",
          }}
        >
          <div
            style={{
              width: "fit-content",
              color: "rgba(31, 41, 55, 0.82)",
              fontFamily: FONT_STACK_BY_FAMILY.mono,
              fontWeight: 700,
              fontSize: `${overlay.fontSize * 0.2}px`,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              opacity: kickerProgress,
              clipPath: `inset(0 ${Math.round((1 - kickerProgress) * 100)}% 0 0)`,
              transform: `translateY(${interpolate(
                kickerProgress,
                [0, 1],
                [8, 0],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                },
              )}px)`,
            }}
          >
            {kicker}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.14em 0.22em",
              alignItems: "flex-end",
            }}
          >
            {safeHeadlineChunks.map((chunk, index) => {
              const chunkEntry = spring({
                frame:
                  frame -
                  Math.round(
                    (safeDuration * 0.45 * index) /
                      Math.max(1, safeHeadlineChunks.length),
                  ),
                fps: 30,
                config: {
                  damping: 165,
                  stiffness: 235,
                  mass: 0.92,
                },
              });
              const chunkOpacity = interpolate(chunkEntry, [0, 1], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const chunkRise = interpolate(chunkEntry, [0, 1], [20, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const chunkScale = interpolate(chunkEntry, [0, 1], [0.96, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const isHighlight = index === highlightChunkIndex;

              return (
                <span
                  key={`${overlay.id}-vox-headline-${index}`}
                  style={{
                    display: "inline-block",
                    color: overlay.color,
                    fontFamily: FONT_STACK_BY_FAMILY.sans,
                    fontWeight: 900,
                    fontSize: `${overlay.fontSize}px`,
                    lineHeight: 0.92,
                    letterSpacing: "-0.03em",
                    whiteSpace: "nowrap",
                    opacity: chunkOpacity,
                    transform: `translateY(${chunkRise}px) scale(${chunkScale})`,
                    boxShadow: isHighlight
                      ? "inset 0 -0.18em 0 rgba(214, 161, 23, 0.45)"
                      : undefined,
                  }}
                >
                  {chunk.join(" ")}
                </span>
              );
            })}
          </div>

          {deck ? (
            <div
              style={{
                maxWidth: "92%",
                color: "rgba(31, 41, 55, 0.86)",
                fontFamily: FONT_STACK_BY_FAMILY.sans,
                fontWeight: 500,
                fontSize: `${overlay.fontSize * 0.34}px`,
                lineHeight: 1.15,
                opacity: deckOpacity,
                transform: `translateY(${deckRise}px)`,
              }}
            >
              {deck}
            </div>
          ) : null}

          {stat ? (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                opacity: statOpacity,
                transform: `scale(${statScale})`,
                transformOrigin: "right center",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.26em 0.6em",
                  borderRadius: "999px",
                  backgroundColor: "rgba(232, 198, 90, 0.42)",
                  color: "#1f2937",
                  fontFamily: FONT_STACK_BY_FAMILY.sans,
                  fontWeight: 700,
                  fontSize: `${overlay.fontSize * 0.24}px`,
                  letterSpacing: "-0.01em",
                }}
              >
                {stat}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

