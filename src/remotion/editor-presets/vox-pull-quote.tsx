import { FPS } from "@/lib/editor/constants";
import { interpolate, spring } from "remotion";
import type { PresetRendererProps } from "./types";
import {
  EDITORIAL_SERIF_STACK,
  FONT_STACK_BY_FAMILY,
  clamp01,
  getNewsHighlightRange,
  splitOverlayLines,
  splitOverlayWords,
} from "./shared";

const VOX_YELLOW = "#ffe000";

interface QuoteWord {
  word: string;
  highlighted: boolean;
}

const parseHighlightWords = (quote: string): QuoteWord[] => {
  const words: QuoteWord[] = [];
  const regex = /\[\[(.+?)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let sawExplicitHighlight = false;

  while ((match = regex.exec(quote)) !== null) {
    if (match.index > lastIndex) {
      for (const word of splitOverlayWords(quote.slice(lastIndex, match.index))) {
        words.push({ word, highlighted: false });
      }
    }
    sawExplicitHighlight = true;
    for (const word of splitOverlayWords(match[1])) {
      words.push({ word, highlighted: true });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < quote.length) {
    for (const word of splitOverlayWords(quote.slice(lastIndex))) {
      words.push({ word, highlighted: false });
    }
  }

  // Merge standalone punctuation tokens (e.g. a "." left outside a [[...]]
  // marker) into the preceding word so they don't float on their own.
  for (let index = words.length - 1; index > 0; index -= 1) {
    if (/^[^\p{L}\p{N}]+$/u.test(words[index].word)) {
      words[index - 1] = {
        ...words[index - 1],
        word: `${words[index - 1].word}${words[index].word}`,
      };
      words.splice(index, 1);
    }
  }

  if (!sawExplicitHighlight && words.length > 1) {
    const range = getNewsHighlightRange(words.map((entry) => entry.word));
    if (range) {
      for (let index = range.start; index < range.end; index += 1) {
        words[index] = { ...words[index], highlighted: true };
      }
    }
  }

  return words.length > 0 ? words : [{ word: quote.trim(), highlighted: false }];
};

export const parseVoxPullQuoteText = (
  text: string,
): { kicker: string; quote: string; attribution: string } => {
  const lines = splitOverlayLines(text);
  let kicker = "";
  let attribution = "";
  let quoteLines = lines.length > 0 ? lines : ["Add a pull quote"];

  const lastLine = quoteLines[quoteLines.length - 1]?.trim() ?? "";
  if (quoteLines.length >= 2 && /^[—–-]\s*/.test(lastLine)) {
    attribution = lastLine.replace(/^[—–-]+\s*/, "");
    quoteLines = quoteLines.slice(0, -1);
  }

  const firstLine = quoteLines[0]?.trim() ?? "";
  if (
    quoteLines.length >= 2 &&
    firstLine.length <= 30 &&
    !firstLine.includes("[[")
  ) {
    kicker = firstLine;
    quoteLines = quoteLines.slice(1);
  }

  return { kicker, quote: quoteLines.join(" "), attribution };
};

export const renderVoxPullQuotePreset = ({
  overlay,
  frame,
  safeDuration,
}: PresetRendererProps) => {
  const { kicker, quote, attribution } = parseVoxPullQuoteText(overlay.text);
  const words = parseHighlightWords(quote);
  const highlightedTotal = words.filter((entry) => entry.highlighted).length;

  const wordStep = Math.max(1, Math.floor((FPS * 1.2) / Math.max(1, words.length)));
  const revealEndFrame = 8 + words.length * wordStep;
  const highlightStartFrame = Math.min(revealEndFrame + 8, Math.max(1, safeDuration - FPS));
  const highlightDrawFrames = Math.min(FPS, Math.max(10, safeDuration - highlightStartFrame - 6));
  const highlightProgress = clamp01((frame - highlightStartFrame) / highlightDrawFrames);

  const containerEntry = spring({
    frame,
    fps: FPS,
    config: { damping: 200 },
  });
  const containerOpacity = interpolate(containerEntry, [0, 1], [0, 1]);
  const containerRise = interpolate(containerEntry, [0, 1], [26, 0]);

  const quoteMarkEntry = spring({
    frame: frame - 2,
    fps: FPS,
    config: { damping: 14, stiffness: 160 },
  });

  const attributionEntry = spring({
    frame: frame - highlightStartFrame - 6,
    fps: FPS,
    config: { damping: 200 },
  });
  const attributionOpacity = interpolate(attributionEntry, [0, 1], [0, 1]);

  let highlightCursor = -1;

  return (
    <div
      style={{
        position: "absolute",
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        transform: `translate(-50%, -50%) translateY(${containerRise}px)`,
        opacity: containerOpacity,
        width: "84%",
        maxWidth: "84%",
      }}
    >
      <div
        style={{
          position: "relative",
          backgroundColor: "rgba(13, 13, 13, 0.92)",
          borderLeft: `0.14em solid ${VOX_YELLOW}`,
          padding: "0.62em 0.7em 0.56em 0.66em",
          fontSize: `${overlay.fontSize}px`,
        }}
      >
        {kicker ? (
          <div
            style={{
              marginBottom: "0.34em",
              color: VOX_YELLOW,
              fontFamily: FONT_STACK_BY_FAMILY.mono,
              fontWeight: 600,
              fontSize: "0.17em",
              letterSpacing: "0.32em",
              textTransform: "uppercase",
            }}
          >
            {kicker}
          </div>
        ) : null}

        <div
          style={{
            position: "relative",
            color: overlay.color,
            fontFamily: EDITORIAL_SERIF_STACK,
            fontWeight: Math.max(600, overlay.fontWeight),
            fontSize: "0.52em",
            lineHeight: 1.18,
            letterSpacing: "-0.012em",
            overflowWrap: "anywhere",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: "-0.07em",
              top: "-0.42em",
              color: VOX_YELLOW,
              fontSize: "1.9em",
              fontWeight: 700,
              lineHeight: 1,
              transform: `scale(${Math.max(0, quoteMarkEntry)})`,
              transformOrigin: "left bottom",
            }}
          >
            “
          </span>

          <span style={{ display: "inline-block", width: "0.85em" }} />

          {words.map((entry, index) => {
            if (entry.highlighted) {
              highlightCursor += 1;
            }

            const wordEntry = spring({
              frame: frame - 8 - index * wordStep,
              fps: FPS,
              config: { damping: 170, stiffness: 240, mass: 0.9 },
            });
            const wordOpacity = interpolate(wordEntry, [0, 1], [0, 1]);
            const wordRise = interpolate(wordEntry, [0, 1], [14, 0]);

            const highlightSegment =
              highlightedTotal > 0 ? 1 / highlightedTotal : 1;
            const wordHighlightProgress = entry.highlighted
              ? clamp01(
                  (highlightProgress - highlightCursor * highlightSegment) /
                    highlightSegment,
                )
              : 0;

            return (
              <span
                key={`${overlay.id}-quote-word-${index}`}
                style={{
                  display: "inline-block",
                  position: "relative",
                  opacity: wordOpacity,
                  transform: `translateY(${wordRise}px)`,
                  marginRight: index === words.length - 1 ? 0 : "0.24em",
                  padding: entry.highlighted ? "0.01em 0.05em 0.03em" : 0,
                }}
              >
                {entry.highlighted ? (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: "0.04em",
                      height: "0.58em",
                      backgroundColor: VOX_YELLOW,
                      opacity: wordHighlightProgress > 0 ? 0.92 : 0,
                      transform: `scaleX(${wordHighlightProgress})`,
                      transformOrigin: "left center",
                      borderRadius: "0.06em 0.12em 0.08em 0.05em",
                      zIndex: 0,
                    }}
                  />
                ) : null}
                <span
                  style={{
                    position: "relative",
                    zIndex: 1,
                    display: "inline-block",
                  }}
                >
                  {entry.word}
                  {entry.highlighted ? (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: 0,
                        color: "#101010",
                        clipPath: `inset(-15% ${100 - wordHighlightProgress * 100}% -15% -5%)`,
                        zIndex: 2,
                      }}
                    >
                      {entry.word}
                    </span>
                  ) : null}
                </span>
              </span>
            );
          })}
        </div>

        {attribution ? (
          <div
            style={{
              marginTop: "0.42em",
              display: "flex",
              alignItems: "center",
              gap: "0.3em",
              opacity: attributionOpacity,
            }}
          >
            <span
              style={{
                display: "block",
                width: "0.9em",
                height: "0.06em",
                backgroundColor: VOX_YELLOW,
                transform: `scaleX(${Math.max(0, attributionEntry)})`,
                transformOrigin: "left center",
              }}
            />
            <span
              style={{
                color: "rgba(248, 246, 241, 0.78)",
                fontFamily: FONT_STACK_BY_FAMILY.sans,
                fontWeight: 600,
                fontSize: "0.165em",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              {attribution}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
