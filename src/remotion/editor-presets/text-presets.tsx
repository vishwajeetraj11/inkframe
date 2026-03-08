import { interpolate, spring } from "remotion";
import type { PresetRendererProps } from "./types";
import {
  FONT_STACK_BY_FAMILY,
  normalizeGridKineticToken,
  splitGridKineticText,
  splitOverlayLines,
  splitOverlayWords,
} from "./shared";
export const renderClassicPreset = ({
  overlay,
  frame,
  safeDuration,
  animation,
}: PresetRendererProps) => {
  const lines = splitOverlayLines(overlay.text);
  const wordsByLine = lines.map((line) => splitOverlayWords(line));

  const lineWordOffsets: number[] = [];
  let runningWordOffset = 0;
  for (const words of wordsByLine) {
    lineWordOffsets.push(runningWordOffset);
    runningWordOffset += words.length;
  }

  const totalWords = Math.max(1, runningWordOffset);
  const revealFrames = Math.max(10, safeDuration - 18);
  const wordStepFrames = Math.max(1, Math.floor(revealFrames / totalWords));

  return (
    <div
      style={{
        position: "absolute",
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        transform: `translate(-50%, -50%) translateY(${animation.baseTranslateY}px) scale(${animation.baseScale}) rotate(${animation.baseRotate}deg)`,
        opacity: animation.baseOpacity,
        filter: `blur(${animation.blur}px)`,
        color: overlay.color,
        fontFamily: FONT_STACK_BY_FAMILY[overlay.fontFamily],
        fontWeight: overlay.fontWeight,
        fontStyle: overlay.fontStyle,
        fontSize: overlay.fontSize,
        lineHeight: 1.05,
        textShadow: "0 2px 10px rgba(0, 0, 0, 0.75)",
        maxWidth: "80%",
        textAlign: "center",
        whiteSpace: "normal",
      }}
    >
      {wordsByLine.map((words, lineIndex) => {
        const lineStartOffset = lineWordOffsets[lineIndex];

        return (
          <div key={`${overlay.id}-classic-line-${lineIndex}`}>
            {words.map((word, wordIndex) => {
              const startFrame = (lineStartOffset + wordIndex) * wordStepFrames;

              const wordEntry = spring({
                frame: frame - startFrame,
                fps: 30,
                config: {
                  damping: 140,
                  stiffness: 220,
                  mass: 0.85,
                },
              });

              const wordOpacity = interpolate(wordEntry, [0, 1], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const wordTranslateY = interpolate(wordEntry, [0, 1], [16, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const wordScale = interpolate(wordEntry, [0, 1], [0.9, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

              return (
                <span
                  key={`${overlay.id}-classic-word-${lineIndex}-${wordIndex}-${word}`}
                  style={{
                    display: "inline-block",
                    opacity: wordOpacity,
                    transform: `translateY(${wordTranslateY}px) scale(${wordScale})`,
                    marginRight: wordIndex === words.length - 1 ? 0 : "0.28em",
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export const renderImpactGridPreset = ({
  overlay,
  frame,
  safeDuration,
  animation,
}: PresetRendererProps) => {
  const words = splitOverlayWords(overlay.text).map((word) =>
    word.toUpperCase(),
  );
  const total = words.length;
  const columns = Math.min(3, Math.max(2, Math.round(Math.sqrt(total))));
  const rows = Math.max(1, Math.ceil(total / columns));
  const accentColor = "#ff2f79";
  const baseColor = overlay.color || "#f4f4f5";

  return (
    <div
      style={{
        position: "absolute",
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        transform: `translate(-50%, -50%) translateY(${animation.baseTranslateY * 0.8}px) scale(${animation.baseScale})`,
        opacity: animation.baseOpacity,
        filter: `blur(${animation.blur * 0.7}px)`,
        maxWidth: "84%",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, max-content))`,
          gap: "0.14em 0.3em",
          alignItems: "end",
          justifyContent: "center",
        }}
      >
        {words.map((word, index) => {
          const rowIndex = Math.floor(index / columns);
          const wordStart = Math.round(
            (safeDuration * 0.55 * index) / Math.max(1, total),
          );
          const wordEntry = spring({
            frame: frame - wordStart,
            fps: 30,
            config: {
              damping: 160,
              stiffness: 280,
              mass: 0.9,
            },
          });
          const pop = interpolate(wordEntry, [0, 1], [0.6, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const rowScale = 1.22 - rowIndex * (0.12 / Math.max(1, rows - 1));
          const rotation =
            (index % 2 === 0 ? -1 : 1) *
            interpolate(wordEntry, [0, 1], [8, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
          const wordOpacity = interpolate(wordEntry, [0, 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <span
              key={`${overlay.id}-impact-${word}-${index}`}
              style={{
                display: "inline-block",
                color: index % 4 === 1 ? accentColor : baseColor,
                fontFamily: FONT_STACK_BY_FAMILY[overlay.fontFamily],
                fontWeight: Math.max(700, overlay.fontWeight),
                fontStyle: overlay.fontStyle,
                fontSize: `${overlay.fontSize * rowScale}px`,
                lineHeight: 0.94,
                letterSpacing: "0.01em",
                transform: `translateY(${(1 - pop) * 26}px) scale(${pop}) rotate(${rotation}deg)`,
                opacity: wordOpacity,
                textShadow: "0 3px 14px rgba(0, 0, 0, 0.35)",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export const renderGridKineticPreset = ({
  overlay,
  frame,
  animation,
  aspect,
}: PresetRendererProps) => {
  const isVertical = aspect === "reel_9_16";
  const { stackLines, accentLine } = splitGridKineticText(overlay.text);
  const accentColor = "#2ef79b";
  const accentLength = Math.max(
    1,
    normalizeGridKineticToken(accentLine).length || accentLine.length,
  );
  const accentFontSize = Math.max(
    isVertical ? 150 : 112,
    Math.min(
      isVertical ? 324 : 240,
      overlay.fontSize * (isVertical ? 2.08 : 1.74) -
        accentLength * (isVertical ? 7 : 4.4),
    ),
  );
  const stackBaseSize = overlay.fontSize * (isVertical ? 0.45 : 0.37);
  const accentEntry = spring({
    frame,
    fps: 30,
    config: {
      damping: 146,
      stiffness: 220,
      mass: 0.9,
    },
  });
  const accentTranslateX = interpolate(
    accentEntry,
    [0, 1],
    [isVertical ? 280 : 220, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const accentScale = interpolate(accentEntry, [0, 1], [1.14, animation.baseScale], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const accentBlur = animation.blur + interpolate(accentEntry, [0, 1], [26, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const accentRotate = interpolate(accentEntry, [0, 1], [-4.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ghostTrailBase = interpolate(accentEntry, [0, 1], [180, 42], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {stackLines.length > 0 ? (
        <div
          style={{
            position: "absolute",
            left: `${isVertical ? 8 : 8.5}%`,
            top: `${isVertical ? 27 : 26}%`,
            width: isVertical ? "24%" : "21%",
            transform: `translateY(${animation.baseTranslateY * 0.28}px) scale(${animation.baseScale})`,
            opacity: animation.baseOpacity,
            filter: `blur(${animation.blur * 0.5}px)`,
          }}
        >
          {stackLines.map((line, index) => {
            const lineEntry = spring({
              frame: frame - index * 3,
              fps: 30,
              config: {
                damping: 180,
                stiffness: 250,
                mass: 0.9,
              },
            });
            const lineOpacity = interpolate(lineEntry, [0, 1], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const lineTranslateX = interpolate(lineEntry, [0, 1], [-52, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const lineBlur = interpolate(lineEntry, [0, 1], [8, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <div
                key={`${overlay.id}-grid-kinetic-line-${index}`}
                style={{
                  color: overlay.color,
                  fontFamily: FONT_STACK_BY_FAMILY.sans,
                  fontWeight: Math.max(760, overlay.fontWeight - 100),
                  fontSize: `${stackBaseSize * (1 - index * 0.06)}px`,
                  lineHeight: 0.9,
                  letterSpacing: "-0.04em",
                  textTransform: "lowercase",
                  opacity: lineOpacity,
                  filter: `blur(${lineBlur}px)`,
                  transform: `translateX(${lineTranslateX}px)`,
                  textShadow: "0 8px 28px rgba(0, 0, 0, 0.45)",
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
      ) : null}

      {[2, 1].map((ghostIndex) => (
        <div
          key={`${overlay.id}-grid-kinetic-ghost-${ghostIndex}`}
          style={{
            position: "absolute",
            left: `${isVertical ? 35 : 31}%`,
            top: `${isVertical ? 40 : 34}%`,
            color: `rgba(46, 247, 155, ${ghostIndex === 2 ? 0.12 : 0.18})`,
            fontFamily: FONT_STACK_BY_FAMILY.sans,
            fontWeight: Math.max(860, overlay.fontWeight),
            fontSize: `${accentFontSize}px`,
            lineHeight: 0.84,
            letterSpacing: "-0.06em",
            textTransform: "lowercase",
            whiteSpace: "nowrap",
            filter: `blur(${accentBlur + ghostIndex * 6}px)`,
            opacity: animation.baseOpacity,
            transform: `translateX(${accentTranslateX + ghostTrailBase * ghostIndex}px) translateY(${animation.baseTranslateY * 0.15}px) scale(${accentScale}) rotate(${accentRotate}deg)`,
          }}
        >
          {accentLine}
        </div>
      ))}

      <div
        style={{
          position: "absolute",
          left: `${isVertical ? 35 : 31}%`,
          top: `${isVertical ? 40 : 34}%`,
          color: accentColor,
          fontFamily: FONT_STACK_BY_FAMILY.sans,
          fontWeight: Math.max(860, overlay.fontWeight),
          fontSize: `${accentFontSize}px`,
          lineHeight: 0.84,
          letterSpacing: "-0.06em",
          textTransform: "lowercase",
          whiteSpace: "nowrap",
          opacity: animation.baseOpacity,
          filter: `blur(${accentBlur}px) drop-shadow(0 12px 36px rgba(46, 247, 155, 0.18))`,
          transform: `translateX(${accentTranslateX}px) translateY(${animation.baseTranslateY * 0.15}px) scale(${accentScale}) rotate(${accentRotate}deg)`,
        }}
      >
        {accentLine}
      </div>
    </div>
  );
};

export const renderHeroSlamPreset = ({
  overlay,
  frame,
  animation,
}: PresetRendererProps) => {
  const words = splitOverlayWords(overlay.text).map((word) =>
    word.toUpperCase(),
  );
  const heroIndex = words.reduce((bestIndex, word, index) => {
    const bestWord = words[bestIndex] ?? "";
    return word.length > bestWord.length ? index : bestIndex;
  }, 0);
  const heroWord = words[heroIndex] ?? words[0] ?? "";
  const before = words.slice(0, heroIndex).join(" ");
  const after = words.slice(heroIndex + 1).join(" ");
  const heroEntry = spring({
    frame,
    fps: 30,
    config: {
      damping: 120,
      stiffness: 250,
      mass: 0.92,
    },
  });
  const heroScale = interpolate(heroEntry, [0, 1], [1.45, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const heroRotate = interpolate(heroEntry, [0, 1], [-5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sideOpacity = interpolate(heroEntry, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const heroColor = "#e11d2e";

  return (
    <div
      style={{
        position: "absolute",
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        transform: `translate(-50%, -50%) translateY(${animation.baseTranslateY * 0.55}px) scale(${animation.baseScale})`,
        opacity: animation.baseOpacity,
        filter: `blur(${animation.blur * 0.6}px)`,
        maxWidth: "88%",
        textAlign: "center",
      }}
    >
      {before ? (
        <div
          style={{
            color: overlay.color,
            fontFamily: FONT_STACK_BY_FAMILY[overlay.fontFamily],
            fontWeight: Math.max(700, overlay.fontWeight - 100),
            fontSize: `${overlay.fontSize * 0.7}px`,
            letterSpacing: "0.02em",
            marginBottom: "0.05em",
            opacity: sideOpacity,
            transform: `translateY(${interpolate(heroEntry, [0, 1], [20, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          {before}
        </div>
      ) : null}

      <div
        style={{
          color: heroColor,
          fontFamily: FONT_STACK_BY_FAMILY[overlay.fontFamily],
          fontWeight: 900,
          fontStyle: overlay.fontStyle,
          fontSize: `${overlay.fontSize * 2.15}px`,
          letterSpacing: "0.01em",
          lineHeight: 0.86,
          textShadow: "0 5px 20px rgba(0, 0, 0, 0.42)",
          transform: `scale(${heroScale}) rotate(${heroRotate}deg)`,
        }}
      >
        {heroWord}
      </div>

      {after ? (
        <div
          style={{
            color: overlay.color,
            fontFamily: FONT_STACK_BY_FAMILY[overlay.fontFamily],
            fontWeight: Math.max(700, overlay.fontWeight - 100),
            fontSize: `${overlay.fontSize * 0.7}px`,
            letterSpacing: "0.02em",
            marginTop: "0.07em",
            opacity: sideOpacity,
            transform: `translateY(${interpolate(heroEntry, [0, 1], [24, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          {after}
        </div>
      ) : null}
    </div>
  );
};

export const renderStickerCutoutPreset = ({
  overlay,
  frame,
  safeDuration,
  animation,
}: PresetRendererProps) => {
  const words = splitOverlayWords(overlay.text).map((word) =>
    word.toUpperCase(),
  );
  const total = words.length;
  const revealFrames = Math.max(8, safeDuration - 12);
  const wordStep = Math.max(1, Math.floor(revealFrames / Math.max(1, total)));

  return (
    <div
      style={{
        position: "absolute",
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        transform: `translate(-50%, -50%) translateY(${animation.baseTranslateY * 0.45}px) scale(${animation.baseScale})`,
        opacity: animation.baseOpacity,
        filter: `blur(${animation.blur * 0.55}px)`,
        maxWidth: "82%",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: "0.22em 0.2em",
      }}
    >
      {words.map((word, index) => {
        const wordFrame = frame - index * wordStep;
        const entry = spring({
          frame: wordFrame,
          fps: 30,
          config: {
            damping: 150,
            stiffness: 260,
            mass: 0.86,
          },
        });
        const opacity = interpolate(entry, [0, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const rise = interpolate(entry, [0, 1], [34, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const rotateSeed = ((index * 37 + word.length * 11) % 13) - 6;
        const rotate = rotateSeed * 1.5;
        const scale = interpolate(entry, [0, 1], [0.85, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const shade = 255 - ((index * 17) % 24);

        return (
          <span
            key={`${overlay.id}-sticker-${word}-${index}`}
            style={{
              display: "inline-block",
              backgroundColor: `rgb(${shade}, ${shade}, ${shade})`,
              color: "#121212",
              borderRadius: "2px",
              padding: "0.08em 0.18em",
              fontFamily: FONT_STACK_BY_FAMILY[overlay.fontFamily],
              fontWeight: 900,
              fontStyle: "normal",
              fontSize: `${overlay.fontSize * 0.78}px`,
              letterSpacing: "0.01em",
              transform: `translateY(${rise}px) rotate(${rotate}deg) scale(${scale})`,
              opacity,
              boxShadow: "0 3px 8px rgba(0, 0, 0, 0.32)",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

export const renderEditorialMonoPreset = ({
  overlay,
  frame,
  safeDuration,
  animation,
}: PresetRendererProps) => {
  const words = splitOverlayWords(overlay.text).map((word) =>
    word.toUpperCase(),
  );
  const focusWordIndex = words.reduce((bestIndex, word, index) => {
    const bestWord = words[bestIndex] ?? "";
    return word.length > bestWord.length ? index : bestIndex;
  }, 0);
  const wordsPerRow = 3;

  return (
    <div
      style={{
        position: "absolute",
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        transform: `translate(-50%, -50%) translateY(${animation.baseTranslateY * 0.35}px) scale(${animation.baseScale})`,
        opacity: animation.baseOpacity,
        filter: `blur(${animation.blur * 0.5}px)`,
        width: "84%",
        maxWidth: "84%",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(245, 245, 242, 0.88)",
          border: "2px solid rgba(20, 20, 20, 0.6)",
          padding: "0.38em 0.46em 0.34em",
          boxShadow: "0 10px 28px rgba(0, 0, 0, 0.26)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${wordsPerRow}, minmax(0, 1fr))`,
            gap: "0.08em 0.18em",
            alignItems: "end",
          }}
        >
          {words.map((word, index) => {
            const entry = spring({
              frame:
                frame -
                Math.round(
                  (safeDuration * 0.45 * index) / Math.max(1, words.length),
                ),
              fps: 30,
              config: {
                damping: 170,
                stiffness: 240,
                mass: 0.9,
              },
            });
            const opacity = interpolate(entry, [0, 1], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const push = interpolate(entry, [0, 1], [28, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const isFocus = index === focusWordIndex;
            const rotate = isFocus ? 0 : ((index % 3) - 1) * 1.6;

            return (
              <span
                key={`${overlay.id}-editorial-${word}-${index}`}
                style={{
                  display: "inline-block",
                  color: "#0c0c0c",
                  fontFamily: FONT_STACK_BY_FAMILY[overlay.fontFamily],
                  fontWeight: isFocus ? 900 : Math.max(700, overlay.fontWeight),
                  fontStyle: overlay.fontStyle,
                  fontSize: `${overlay.fontSize * (isFocus ? 1.45 : 0.84)}px`,
                  lineHeight: isFocus ? 0.88 : 0.95,
                  letterSpacing: isFocus ? "0.01em" : "0.005em",
                  transform: `translateY(${push}px) rotate(${rotate}deg)`,
                  opacity,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

