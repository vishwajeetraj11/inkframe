import { FPS } from "@/lib/editor/constants";
import { interpolate, spring } from "remotion";
import { REMOTION_FONT_STACKS } from "../fonts";
import type { PresetRendererProps } from "./types";
import { FONT_STACK_BY_FAMILY, splitOverlayLines } from "./shared";

const STAMP_RED = "#ff3b30";
const TYPE_FRAMES_PER_CHAR = 2;

export const parseHarrisLocationText = (
  text: string,
): { title: string; detail: string; stamp: string } => {
  const lines = splitOverlayLines(text);

  return {
    title: lines[0] ?? "LOCATION",
    detail: lines[1] ?? "",
    stamp: lines[2] ?? "",
  };
};

export const renderHarrisLocationPreset = ({
  overlay,
  frame,
  safeDuration,
}: PresetRendererProps) => {
  const { title, detail, stamp } = parseHarrisLocationText(overlay.text);

  const typingStartFrame = 6;
  const typedChars = Math.max(
    0,
    Math.min(
      title.length,
      Math.floor((frame - typingStartFrame) / TYPE_FRAMES_PER_CHAR),
    ),
  );
  const typedTitle = title.slice(0, typedChars);
  const typingEndFrame = typingStartFrame + title.length * TYPE_FRAMES_PER_CHAR;
  const isTyping = frame >= typingStartFrame && frame < typingEndFrame + 12;
  const cursorVisible = isTyping && Math.floor(frame / 8) % 2 === 0;

  const ruleProgress = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const detailOpacity = interpolate(
    frame,
    [typingEndFrame, typingEndFrame + 10],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const stampEntry = spring({
    frame: frame - typingEndFrame - 8,
    fps: FPS,
    config: { damping: 16, stiffness: 280, mass: 0.6 },
  });
  const stampOpacity = frame > typingEndFrame + 8 ? 1 : 0;
  const stampScale = interpolate(stampEntry, [0, 1], [1.5, 1]);

  const squarePulse = Math.floor(frame / 12) % 2 === 0 ? 1 : 0.35;

  const exitFadeStart = Math.max(1, safeDuration - 8);
  const blockOpacity = interpolate(frame, [exitFadeStart, safeDuration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        transform: "translate(-50%, -50%)",
        fontSize: `${overlay.fontSize}px`,
        opacity: blockOpacity,
        textShadow: "0 0.05em 0.5em rgba(0, 0, 0, 0.55)",
      }}
    >
      <div
        style={{
          display: "block",
          height: "0.05em",
          width: "100%",
          marginBottom: "0.18em",
          backgroundColor: "rgba(255, 255, 255, 0.85)",
          transform: `scaleX(${ruleProgress})`,
          transformOrigin: "left center",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.22em",
        }}
      >
        <span
          style={{
            display: "block",
            width: "0.3em",
            height: "0.3em",
            backgroundColor: STAMP_RED,
            opacity: squarePulse,
          }}
        />
        <span
          style={{
            color: overlay.color,
            fontFamily: REMOTION_FONT_STACKS.condensed,
            fontWeight: Math.max(600, overlay.fontWeight),
            fontSize: "0.56em",
            lineHeight: 1,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {typedTitle}
          {cursorVisible ? (
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: "0.42em",
                height: "0.82em",
                marginLeft: "0.06em",
                verticalAlign: "-0.08em",
                backgroundColor: STAMP_RED,
              }}
            />
          ) : null}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4em",
          marginTop: "0.16em",
        }}
      >
        {detail ? (
          <span
            style={{
              color: "rgba(255, 255, 255, 0.74)",
              fontFamily: FONT_STACK_BY_FAMILY.mono,
              fontWeight: 500,
              fontSize: "0.19em",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              opacity: detailOpacity,
            }}
          >
            {detail}
          </span>
        ) : null}

        {stamp ? (
          <span
            style={{
              display: "inline-block",
              padding: "0.05em 0.32em 0.08em",
              border: `0.13em solid ${STAMP_RED}`,
              color: STAMP_RED,
              fontFamily: FONT_STACK_BY_FAMILY.mono,
              fontWeight: 600,
              fontSize: "0.17em",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              transform: `rotate(-2.5deg) scale(${stampScale})`,
              opacity: stampOpacity,
            }}
          >
            {stamp}
          </span>
        ) : null}
      </div>
    </div>
  );
};
