import { FPS } from "@/lib/editor/constants";
import { Easing, interpolate, spring } from "remotion";
import { REMOTION_FONT_STACKS } from "../fonts";
import type { PresetRendererProps } from "./types";
import { FONT_STACK_BY_FAMILY, clamp01, splitOverlayLines } from "./shared";

const MARKER_RED = "#ff3b30";

interface MarkerSegment {
  text: string;
  circled: boolean;
}

interface MarkerLine {
  segments: MarkerSegment[];
}

export const parseHarrisMarkerText = (
  text: string,
): { kicker: string; lines: MarkerLine[]; hasCircledWord: boolean } => {
  const rawLines = splitOverlayLines(text);
  let kicker = "";
  let bodyLines = rawLines.length > 0 ? rawLines : ["ADD A HEADLINE"];

  const firstLine = bodyLines[0]?.trim() ?? "";
  if (bodyLines.length >= 2 && firstLine.length <= 26 && !firstLine.includes("[[")) {
    kicker = firstLine;
    bodyLines = bodyLines.slice(1);
  }

  let hasCircledWord = false;
  const lines: MarkerLine[] = bodyLines.map((line) => {
    const segments: MarkerSegment[] = [];
    const regex = /\[\[(.+?)\]\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: line.slice(lastIndex, match.index), circled: false });
      }
      segments.push({ text: match[1], circled: true });
      hasCircledWord = true;
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      segments.push({ text: line.slice(lastIndex), circled: false });
    }

    return {
      segments: segments.length > 0 ? segments : [{ text: line, circled: false }],
    };
  });

  return { kicker, lines, hasCircledWord };
};

const MarkerUnderline = ({ progress }: { progress: number }) => (
  <svg
    aria-hidden
    viewBox="0 0 600 22"
    preserveAspectRatio="none"
    style={{
      position: "absolute",
      left: "-1.5%",
      right: "-1.5%",
      bottom: "-0.18em",
      width: "103%",
      height: "0.24em",
      transform: "rotate(-0.4deg)",
      overflow: "visible",
    }}
  >
    <path
      d="M4,13 C 90,6 200,16 310,9 S 480,7 596,12"
      fill="none"
      stroke={MARKER_RED}
      strokeWidth={9}
      strokeLinecap="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - progress}
    />
  </svg>
);

const MarkerCircle = ({ progress }: { progress: number }) => (
  <svg
    aria-hidden
    viewBox="0 0 600 220"
    preserveAspectRatio="none"
    style={{
      position: "absolute",
      left: "-14%",
      top: "-22%",
      width: "128%",
      height: "144%",
      overflow: "visible",
    }}
  >
    <path
      d="M300,18 C 470,4 588,52 580,112 C 572,182 420,212 280,206 C 120,200 18,160 24,104 C 30,42 170,10 330,14 C 430,17 530,40 545,76"
      fill="none"
      stroke={MARKER_RED}
      strokeWidth={11}
      strokeLinecap="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - progress}
      opacity={progress > 0 ? 1 : 0}
    />
  </svg>
);

export const renderHarrisMarkerPreset = ({
  overlay,
  frame,
  safeDuration,
}: PresetRendererProps) => {
  const { kicker, lines } = parseHarrisMarkerText(overlay.text);

  const lineStep = 7;
  const linesEndFrame = 4 + lines.length * lineStep;
  const lastLineHasCircle = lines[lines.length - 1]?.segments.some(
    (segment) => segment.circled,
  );
  const shouldUnderlineLastLine = !lastLineHasCircle;

  const underlineStartFrame = linesEndFrame + 4;
  const underlineProgress = interpolate(
    frame,
    [underlineStartFrame, underlineStartFrame + 14],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.3, 0.6, 0.35, 1),
    },
  );

  const circleStartFrame = shouldUnderlineLastLine
    ? underlineStartFrame + 14
    : underlineStartFrame;
  const circleProgress = interpolate(
    frame,
    [circleStartFrame, circleStartFrame + 18],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.3, 0.55, 0.4, 1),
    },
  );

  const pushIn = interpolate(frame, [0, Math.max(1, safeDuration)], [1, 1.045]);

  const kickerOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        transform: `translate(-50%, -50%) scale(${pushIn})`,
        width: "90%",
        maxWidth: "90%",
        textAlign: "center",
        fontSize: `${overlay.fontSize}px`,
      }}
    >
      {kicker ? (
        <div
          style={{
            marginBottom: "0.3em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5em",
            opacity: kickerOpacity,
          }}
        >
          <span
            style={{
              display: "block",
              width: "1.3em",
              height: "0.045em",
              backgroundColor: MARKER_RED,
            }}
          />
          <span
            style={{
              color: "rgba(255, 255, 255, 0.85)",
              fontFamily: FONT_STACK_BY_FAMILY.mono,
              fontWeight: 600,
              fontSize: "0.16em",
              letterSpacing: "0.34em",
              textTransform: "uppercase",
              textShadow: "0 0.08em 0.6em rgba(0, 0, 0, 0.6)",
            }}
          >
            {kicker}
          </span>
          <span
            style={{
              display: "block",
              width: "1.3em",
              height: "0.045em",
              backgroundColor: MARKER_RED,
            }}
          />
        </div>
      ) : null}

      {lines.map((line, lineIndex) => {
        const lineStart = 4 + lineIndex * lineStep;
        const lineEntry = spring({
          frame: frame - lineStart,
          fps: FPS,
          config: { damping: 20, stiffness: 260, mass: 0.7 },
        });
        const lineOpacity = clamp01(
          interpolate(frame, [lineStart, lineStart + 3], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        );
        const lineScale = interpolate(lineEntry, [0, 1], [1.1, 1]);
        const isLastLine = lineIndex === lines.length - 1;

        return (
          <div
            key={`${overlay.id}-marker-line-${lineIndex}`}
            style={{
              position: "relative",
              display: "block",
              opacity: lineOpacity,
              transform: `scale(${lineScale})`,
              color: overlay.color,
              fontFamily: REMOTION_FONT_STACKS.condensed,
              fontWeight: Math.max(700, overlay.fontWeight),
              fontSize: "0.62em",
              lineHeight: 1.04,
              letterSpacing: "0.01em",
              textTransform: "uppercase",
              whiteSpace: "normal",
              overflowWrap: "anywhere",
              textShadow:
                "0.03em 0.04em 0 rgba(0, 0, 0, 0.9), 0 0 0.55em rgba(0, 0, 0, 0.4)",
            }}
          >
            {line.segments.map((segment, segmentIndex) =>
              segment.circled ? (
                <span
                  key={`${overlay.id}-marker-seg-${lineIndex}-${segmentIndex}`}
                  style={{
                    position: "relative",
                    display: "inline-block",
                    padding: "0 0.06em",
                  }}
                >
                  <span style={{ position: "relative", zIndex: 1 }}>
                    {segment.text}
                  </span>
                  <MarkerCircle progress={circleProgress} />
                </span>
              ) : (
                <span key={`${overlay.id}-marker-seg-${lineIndex}-${segmentIndex}`}>
                  {segment.text}
                </span>
              ),
            )}

            {isLastLine && shouldUnderlineLastLine ? (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  top: 0,
                  pointerEvents: "none",
                }}
              >
                <MarkerUnderline progress={underlineProgress} />
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
