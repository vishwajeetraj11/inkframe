import { FPS } from "@/lib/editor/constants";
import { Easing, interpolate, spring } from "remotion";
import type { PresetRendererProps } from "./types";
import {
  FONT_STACK_BY_FAMILY,
  clamp01,
  getNewsHighlightRange,
  parseNewsPresetText,
  splitOverlayWords,
} from "./shared";
export const renderNewsClippingPreset = ({
  overlay,
  frame,
  safeDuration,
}: PresetRendererProps) => {
  const { badge, headline, deck } = parseNewsPresetText(overlay.text);
  const headlineWords = splitOverlayWords(headline);
  const highlightRange = getNewsHighlightRange(headlineWords);
  const highlightWordCount = highlightRange
    ? Math.max(1, highlightRange.end - highlightRange.start)
    : 0;
  const readHoldFrames = FPS * 3;
  const targetAnimationFrames = FPS * 5;
  const animationFrames = Math.max(
    1,
    Math.min(targetAnimationFrames, Math.max(1, safeDuration - readHoldFrames)),
  );
  const animationProgress = clamp01(frame / animationFrames);
  const highlightStartFrame = animationFrames;
  const highlightDrawFrames = Math.max(
    1,
    Math.min(FPS * 2, Math.max(1, readHoldFrames - FPS)),
  );
  const highlightProgress = clamp01(
    (frame - highlightStartFrame) / highlightDrawFrames,
  );
  const revealFrames = Math.max(12, Math.round(animationFrames * 0.62));
  const wordStep = Math.max(
    1,
    Math.floor(revealFrames / Math.max(1, headlineWords.length)),
  );

  const containerEntry = spring({
    frame,
    fps: 30,
    config: {
      damping: 185,
      stiffness: 210,
      mass: 0.95,
    },
  });

  const containerOpacity = interpolate(containerEntry, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const containerRise = interpolate(containerEntry, [0, 1], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const badgeEntryFrames = Math.max(10, Math.round(animationFrames * 0.24));
  const badgeEase = Easing.bezier(0.22, 1, 0.36, 1);

  const badgeOpacity = interpolate(frame, [0, badgeEntryFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: badgeEase,
  });

  const badgeTranslateX = interpolate(frame, [0, badgeEntryFrames], [-220, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: badgeEase,
  });

  const deckEntry = spring({
    frame: frame - Math.round(animationFrames * 0.32),
    fps: 30,
    config: {
      damping: 170,
      stiffness: 220,
      mass: 0.95,
    },
  });

  const deckOpacity = interpolate(deckEntry, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const mastheadEntry = spring({
    frame: frame - Math.round(animationFrames * 0.46),
    fps: 30,
    config: {
      damping: 180,
      stiffness: 220,
      mass: 1,
    },
  });

  const mastheadOpacity = interpolate(mastheadEntry, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const zoomScale = interpolate(
    animationProgress,
    [0, 0.64, 0.82, 1],
    [0.8, 0.84, 1, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const zoomBlur = interpolate(
    animationProgress,
    [0, 0.64, 0.82, 1],
    [0, 0, 15, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <div
      style={{
        position: "absolute",
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        transform: `translate(-50%, -50%) translateY(${containerRise}px) scale(${zoomScale})`,
        opacity: containerOpacity,
        filter: `blur(${zoomBlur}px)`,
        width: "88%",
        maxWidth: "88%",
      }}
    >
      <div
        style={{
          position: "relative",
          padding: "0.32em 0.22em 0.24em",
          overflow: "visible",
        }}
      >
        <div
          style={{
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "inline-block",
              marginBottom: "0.22em",
              padding: "0.16em 0.42em",
              borderRadius: "0",
              backgroundColor: "#c94d4f",
              color: "#ffffff",
              fontFamily: "Roboto Mono, Inter, sans-serif",
              fontWeight: 700,
              fontSize: `${overlay.fontSize * 0.18}px`,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              opacity: badgeOpacity,
              transform: `translateX(${badgeTranslateX}px)`,
            }}
          >
            {badge}
          </div>

          <div
            style={{
              color: overlay.color,
              fontFamily: FONT_STACK_BY_FAMILY["serif"],
              fontWeight: Math.max(700, overlay.fontWeight),
              fontStyle: "normal",
              fontSize: `${overlay.fontSize * 0.72}px`,
              lineHeight: 1.04,
              letterSpacing: "-0.012em",
              whiteSpace: "normal",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              maxWidth: "90%",
            }}
          >
            {headlineWords.map((word, index) => {
              const entry = spring({
                frame: frame - index * wordStep,
                fps: 30,
                config: {
                  damping: 150,
                  stiffness: 240,
                  mass: 0.9,
                },
              });
              const opacity = interpolate(entry, [0, 1], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const rise = interpolate(entry, [0, 1], [16, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

              const isHighlighted =
                highlightRange !== null &&
                index >= highlightRange.start &&
                index < highlightRange.end;
              const highlightWordIndex =
                isHighlighted && highlightRange
                  ? index - highlightRange.start
                  : -1;
              const highlightSegment =
                highlightWordCount > 0 ? 1 / highlightWordCount : 1;
              const wordHighlightProgress =
                highlightWordIndex >= 0
                  ? clamp01(
                      (highlightProgress -
                        highlightWordIndex * highlightSegment) /
                        highlightSegment,
                    )
                  : 0;
              const wordHighlightShadowProgress = clamp01(
                (wordHighlightProgress - 0.2) / 0.8,
              );

              return (
                <span
                  key={`${overlay.id}-news-word-${word}-${index}`}
                  style={{
                    display: "inline-block",
                    position: isHighlighted ? "relative" : "static",
                    opacity,
                    transform: `translateY(${rise}px)`,
                    marginRight:
                      index === headlineWords.length - 1 ? 0 : "0.23em",
                    padding: isHighlighted ? "0.02em 0.08em 0.05em" : 0,
                  }}
                >
                  {isHighlighted ? (
                    <>
                      <span
                        style={{
                          position: "absolute",
                          left: "0.04em",
                          right: "0.04em",
                          bottom: "0.05em",
                          height: "0.62em",
                          backgroundColor: "rgba(238, 224, 98, 0.96)",
                          borderRadius: "0.08em 0.13em 0.1em 0.08em",
                          transform: `scaleX(${wordHighlightProgress})`,
                          transformOrigin: "left center",
                          opacity: wordHighlightProgress > 0 ? 1 : 0,
                          filter: "blur(0.2px)",
                          zIndex: 0,
                        }}
                      />

                      <span
                        style={{
                          position: "absolute",
                          left: "0.02em",
                          right: "0.07em",
                          bottom: "0.04em",
                          height: "0.34em",
                          backgroundColor: "rgba(205, 190, 62, 0.6)",
                          borderRadius: "0.08em",
                          transform: `scaleX(${wordHighlightShadowProgress})`,
                          transformOrigin: "left center",
                          opacity: wordHighlightShadowProgress > 0 ? 1 : 0,
                          zIndex: 0,
                        }}
                      />
                    </>
                  ) : null}

                  <span
                    style={{
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    {word}
                  </span>
                </span>
              );
            })}
          </div>

          {deck ? (
            <div
              style={{
                marginTop: "0.26em",
                color: "rgba(18, 18, 18, 0.72)",
                fontFamily: FONT_STACK_BY_FAMILY["serif"],
                fontWeight: 500,
                fontSize: `${overlay.fontSize * 0.29}px`,
                lineHeight: 1.25,
                opacity: deckOpacity,
                whiteSpace: "normal",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                maxWidth: "88%",
              }}
            >
              {deck}
            </div>
          ) : null}

          <div
            style={{
              marginTop: "0.36em",
              display: "flex",
              alignItems: "center",
              gap: "0.45em",
              opacity: mastheadOpacity,
            }}
          >
            <span
              style={{
                display: "block",
                height: "1px",
                flex: 1,
                backgroundColor: "rgba(18, 18, 18, 0.72)",
              }}
            />
            <span
              style={{
                color: "rgba(18, 18, 18, 0.88)",
                fontFamily: FONT_STACK_BY_FAMILY["serif"],
                fontWeight: 900,
                fontSize: `${overlay.fontSize * 0.24}px`,
                letterSpacing: "-0.01em",
              }}
            >
              The New York Times
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
