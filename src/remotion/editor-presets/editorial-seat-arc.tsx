import {
  parseChartCardText,
  splitHeadlineAroundHighlight,
} from "@/lib/editor/chart-card";
import type { CreatedaleyOpenerTexture } from "@/lib/editor/types";
import { Easing, interpolate } from "remotion";
import type { PresetRendererProps } from "./types";
import {
  FONT_STACK_BY_FAMILY,
  NewsCrumpleTexture,
  clamp01,
  getRevealClipPath,
} from "./shared";

interface SeatArcSegment {
  label: string;
  value: number;
  color: string;
  startAngle: number;
  endAngle: number;
  midAngle: number;
}

const formatSeatArcValue = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(2));
  return new Intl.NumberFormat("en-US").format(rounded);
};

const withAlpha = (hexColor: string, alpha: number): string => {
  const normalized = hexColor.replace("#", "");
  if (normalized.length !== 6) {
    return hexColor;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
): { x: number; y: number } => {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeDonutSlicePath = (
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string => {
  const sweep = endAngle - startAngle;
  if (sweep <= 0.1) {
    return "";
  }

  const outerStart = polarToCartesian(centerX, centerY, outerRadius, startAngle);
  const outerEnd = polarToCartesian(centerX, centerY, outerRadius, endAngle);
  const innerEnd = polarToCartesian(centerX, centerY, innerRadius, endAngle);
  const innerStart = polarToCartesian(centerX, centerY, innerRadius, startAngle);
  const largeArcFlag = sweep > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
};

const getSeatArcSegments = (
  rows: { label: string; value: number; color: string }[],
): SeatArcSegment[] => {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  let cumulative = 0;

  return rows.map((row) => {
    const portion = total > 0 ? row.value / total : 0;
    const startProgress = cumulative;
    const endProgress = cumulative + portion;
    const startAngle = 180 + startProgress * 180;
    const endAngle = 180 + endProgress * 180;

    cumulative = endProgress;

    return {
      ...row,
      startAngle,
      endAngle,
      midAngle: startAngle + (endAngle - startAngle) / 2,
    };
  });
};

const getAnimatedSeatArcAngles = (
  segment: SeatArcSegment,
  progress: number,
): { startAngle: number; endAngle: number } | null => {
  if (progress <= 0) {
    return null;
  }

  const clampedProgress = clamp01(progress);
  const seamAngle = 180;
  const animatedStartAngle =
    seamAngle + (segment.startAngle - seamAngle) * clampedProgress;
  let animatedEndAngle =
    seamAngle + (segment.endAngle - seamAngle) * clampedProgress;
  const minimumSpan =
    clampedProgress < 0.28
      ? interpolate(clampedProgress, [0, 0.28], [2.8, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  if (animatedEndAngle - animatedStartAngle < minimumSpan) {
    animatedEndAngle = animatedStartAngle + minimumSpan;
  }

  return {
    startAngle: animatedStartAngle,
    endAngle: animatedEndAngle,
  };
};

const getLeaderLayout = (
  centerX: number,
  centerY: number,
  outerRadius: number,
  angle: number,
) => {
  const anchor = polarToCartesian(centerX, centerY, outerRadius - 1.5, angle);
  const elbow = polarToCartesian(centerX, centerY, outerRadius + 8, angle);
  const isTop = Math.abs(angle - 270) < 18;

  if (isTop) {
    const end = { x: elbow.x + 10, y: elbow.y };

    return {
      anchor,
      elbow,
      end,
      textX: end.x,
      textY: end.y - 1.2,
      textAnchor: "start" as const,
    };
  }

  const isLeft = angle < 270;
  const end = {
    x: elbow.x + (isLeft ? -20 : 20),
    y: elbow.y + (isLeft ? -1 : 1),
  };

  return {
    anchor,
    elbow,
    end,
    textX: end.x + (isLeft ? -0.8 : 0.8),
    textY: end.y - 1.2,
    textAnchor: isLeft ? ("end" as const) : ("start" as const),
  };
};

const getSeatArcPaperFill = (texture: CreatedaleyOpenerTexture): string => {
  switch (texture) {
    case "dots":
      return "linear-gradient(160deg, rgba(249, 246, 238, 0.99) 0%, rgba(242, 236, 223, 0.99) 100%)";
    case "grid-dots":
      return "linear-gradient(160deg, rgba(246, 242, 233, 0.99) 0%, rgba(236, 229, 214, 0.99) 100%)";
    case "newsprint-grain":
      return "linear-gradient(160deg, rgba(243, 239, 230, 0.995) 0%, rgba(233, 226, 209, 0.995) 100%)";
    case "warm-editorial":
      return "linear-gradient(160deg, rgba(248, 244, 234, 0.995) 0%, rgba(238, 227, 206, 0.995) 56%, rgba(226, 213, 191, 0.995) 100%)";
    case "plain":
    default:
      return "linear-gradient(160deg, rgba(248, 245, 236, 0.99) 0%, rgba(241, 235, 221, 0.99) 54%, rgba(233, 225, 210, 0.99) 100%)";
  }
};

const getSeatArcPaperShade = (texture: CreatedaleyOpenerTexture): string => {
  switch (texture) {
    case "dots":
      return (
        "radial-gradient(circle at 18% 16%, rgba(255,255,255,0.78), rgba(255,255,255,0) 24%)," +
        "radial-gradient(circle at 78% 72%, rgba(170, 140, 105, 0.1), rgba(170, 140, 105, 0) 24%)"
      );
    case "grid-dots":
      return (
        "radial-gradient(circle at 20% 18%, rgba(255,255,255,0.72), rgba(255,255,255,0) 26%)," +
        "radial-gradient(circle at 82% 68%, rgba(138, 118, 87, 0.1), rgba(138, 118, 87, 0) 24%)"
      );
    case "newsprint-grain":
      return (
        "radial-gradient(circle at 16% 14%, rgba(255,255,255,0.54), rgba(255,255,255,0) 24%)," +
        "radial-gradient(circle at 76% 70%, rgba(114, 95, 71, 0.08), rgba(114, 95, 71, 0) 24%)"
      );
    case "warm-editorial":
      return (
        "radial-gradient(circle at 18% 16%, rgba(255,255,255,0.76), rgba(255,255,255,0) 25%)," +
        "radial-gradient(circle at 75% 70%, rgba(177, 133, 76, 0.14), rgba(177, 133, 76, 0) 27%)," +
        "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(123, 95, 58, 0.04) 100%)"
      );
    case "plain":
    default:
      return (
        "radial-gradient(circle at 15% 14%, rgba(255,255,255,0.72), rgba(255,255,255,0) 24%)," +
        "radial-gradient(circle at 78% 62%, rgba(148, 131, 104, 0.08), rgba(148, 131, 104, 0) 26%)"
      );
  }
};

export const renderEditorialSeatArcPreset = ({
  overlay,
  frame,
  animation,
  aspect,
}: PresetRendererProps) => {
  const { headline, highlight, subhead, rows } = parseChartCardText(overlay.text, {
    useFallbackRows: false,
  });
  const safeRows = rows.length >= 2 ? rows : parseChartCardText(overlay.text).rows;
  const segments = getSeatArcSegments(safeRows);
  const { before, highlighted, after } = splitHeadlineAroundHighlight(
    headline,
    highlight,
  );
  const seatArcTexture = overlay.createdaleyTexture ?? "plain";
  const isVertical = aspect === "reel_9_16";
  const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
  const headlineReveal = interpolate(frame, [0, 12, 22, 34, 42], [0, 0.06, 0.2, 0.72, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subheadReveal = interpolate(frame, [8, 20, 34, 46], [0, 0.16, 0.7, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chartProgress = interpolate(frame, [10, 18, 28, 38], [0, 0.08, 0.42, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const highlightProgress = highlighted
    ? interpolate(frame, [26, 40], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: easeOut,
      })
    : 0;
  const paperReveal = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const wrapperOpacity = animation.baseOpacity;
  const wrapperScale = interpolate(chartProgress, [0, 1], [0.985, animation.baseScale], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wrapperTranslateY = animation.baseTranslateY * 0.1;
  const wrapperBlur = animation.blur * 0.15;
  const headlineSize = overlay.fontSize * (isVertical ? 0.92 : 1.02);
  const subheadSize = overlay.fontSize * (isVertical ? 0.26 : 0.22);
  const labelSize = isVertical ? 2.8 : 2.15;
  const showDotTexture =
    seatArcTexture === "dots" ||
    seatArcTexture === "grid-dots" ||
    seatArcTexture === "warm-editorial";
  const showGridTexture =
    seatArcTexture === "plain" || seatArcTexture === "grid-dots";
  const showNewsprintTexture =
    seatArcTexture === "newsprint-grain" || seatArcTexture === "warm-editorial";
  const dotOpacity =
    seatArcTexture === "warm-editorial"
      ? 0.13
      : seatArcTexture === "grid-dots"
        ? 0.16
        : 0.18;
  const gridOpacity = seatArcTexture === "grid-dots" ? 0.22 : 0.09;
  const newsprintOpacity = seatArcTexture === "warm-editorial" ? 0.05 : 0.11;
  const chartScale = interpolate(chartProgress, [0, 1], [0.95, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const layout = isVertical
    ? {
        headerLeft: "8%",
        headerTop: "12%",
        headerWidth: "84%",
        chartLeft: "50%",
        chartTop: "70%",
        chartWidth: "82%",
      }
    : {
        headerLeft: "16%",
        headerTop: "12%",
        headerWidth: "68%",
        chartLeft: "50%",
        chartTop: "69%",
        chartWidth: "56%",
      };

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
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: getSeatArcPaperFill(seatArcTexture),
          opacity: paperReveal,
        }}
      />

      {showNewsprintTexture ? (
        <NewsCrumpleTexture
          style={{
            opacity: newsprintOpacity * paperReveal,
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: paperReveal,
          background: getSeatArcPaperShade(seatArcTexture),
        }}
      />

      {showDotTexture ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle at 1.4px 1.4px, rgba(77, 63, 48, 0.18) 0 1px, transparent 1.18px)," +
              "radial-gradient(circle at 6px 6px, rgba(77, 63, 48, 0.07) 0 0.78px, transparent 0.92px)",
            backgroundSize: isVertical ? "10px 10px, 20px 20px" : "11px 11px, 22px 22px",
            backgroundPosition: "0 0, 2px 2px",
            opacity: dotOpacity * paperReveal,
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
              "repeating-linear-gradient(0deg, rgba(125, 116, 97, 0.08) 0 1px, transparent 1px 120px)," +
              "repeating-linear-gradient(90deg, rgba(125, 116, 97, 0.08) 0 1px, transparent 1px 120px)",
            mixBlendMode: "multiply",
            opacity: gridOpacity * paperReveal,
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
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-block",
            clipPath: getRevealClipPath(headlineReveal),
            opacity: interpolate(headlineReveal, [0, 1], [0.24, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              fontFamily: FONT_STACK_BY_FAMILY.serif,
              fontWeight: Math.min(800, Math.max(700, overlay.fontWeight)),
              fontStyle: "normal",
              fontSize: `${headlineSize}px`,
              lineHeight: 0.92,
              letterSpacing: "-0.04em",
              textWrap: "balance",
            }}
          >
            {before}
            {highlighted ? (
              <span
                style={{
                  position: "relative",
                  display: "inline-block",
                  fontStyle: "italic",
                  padding: "0 0.08em 0.01em",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    inset: "0.2em 0.03em 0.05em 0.03em",
                    backgroundColor: "rgba(242, 235, 70, 0.96)",
                    transform: `scaleX(${highlightProgress})`,
                    transformOrigin: "left center",
                    opacity: highlightProgress > 0 ? 1 : 0,
                    zIndex: 0,
                  }}
                />
                <span style={{ position: "relative", zIndex: 1 }}>{highlighted}</span>
              </span>
            ) : null}
            {after}
          </div>
        </div>

        <div
          style={{
            marginTop: isVertical ? "0.82em" : "0.9em",
            width: isVertical ? "100%" : "94%",
            marginInline: "auto",
            color: "rgba(86, 90, 96, 0.62)",
            fontFamily: FONT_STACK_BY_FAMILY.serif,
            fontWeight: 500,
            fontStyle: "italic",
            fontSize: `${subheadSize}px`,
            lineHeight: 1.24,
            opacity: subheadReveal,
            clipPath: getRevealClipPath(subheadReveal),
            transform: `translateY(${interpolate(subheadReveal, [0, 1], [10, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px)`,
            textWrap: "pretty",
          }}
        >
          {subhead}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: layout.chartLeft,
          top: layout.chartTop,
          width: layout.chartWidth,
          aspectRatio: "1 / 0.7",
          transform: `translate(-50%, -50%) scale(${chartScale})`,
          transformOrigin: "center center",
          opacity: interpolate(chartProgress, [0, 1], [0.62, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <svg
          viewBox="-14 0 128 72"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          <defs>
            {segments.map((segment, index) => (
              <pattern
                key={`${overlay.id}-seat-arc-pattern-${segment.label}-${index}`}
                id={`${overlay.id}-seat-arc-pattern-${index}`}
                width="2.8"
                height="2.8"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="0.9" cy="0.9" r="0.72" fill={segment.color} />
              </pattern>
            ))}
          </defs>

          {segments.map((segment, index) => {
            const animatedAngles = getAnimatedSeatArcAngles(segment, chartProgress);
            if (!animatedAngles) {
              return null;
            }

            const path = describeDonutSlicePath(
              50,
              62,
              31.5,
              15.6,
              animatedAngles.startAngle,
              animatedAngles.endAngle,
            );

            if (!path) {
              return null;
            }

            return (
              <g key={`${overlay.id}-seat-arc-segment-${segment.label}-${index}`}>
                <path d={path} fill={withAlpha(segment.color, 0.14)} />
                <path
                  d={path}
                  fill={`url(#${overlay.id}-seat-arc-pattern-${index})`}
                  opacity={0.92}
                />
              </g>
            );
          })}

          {segments.map((segment, index) => {
            const labelStart = 28 + index * 6;
            const labelProgress = interpolate(frame, [labelStart, labelStart + 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: easeOut,
            });
            const leader = getLeaderLayout(50, 62, 31.5, segment.midAngle);
            const elbowProgress = Math.min(1, labelProgress / 0.56);
            const endProgress = clamp01((labelProgress - 0.36) / 0.64);
            const currentElbow = {
              x: leader.anchor.x + (leader.elbow.x - leader.anchor.x) * elbowProgress,
              y: leader.anchor.y + (leader.elbow.y - leader.anchor.y) * elbowProgress,
            };
            const currentEnd = {
              x: currentElbow.x + (leader.end.x - leader.elbow.x) * endProgress,
              y: currentElbow.y + (leader.end.y - leader.elbow.y) * endProgress,
            };

            return (
              <g key={`${overlay.id}-seat-arc-label-${segment.label}-${index}`}>
                <path
                  d={`M ${leader.anchor.x} ${leader.anchor.y} L ${currentElbow.x} ${currentElbow.y} L ${currentEnd.x} ${currentEnd.y}`}
                  fill="none"
                  stroke="rgba(38, 49, 61, 0.88)"
                  strokeWidth="0.46"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={interpolate(labelProgress, [0, 1], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}
                />

                <text
                  x={leader.textX}
                  y={leader.textY}
                  textAnchor={leader.textAnchor}
                  fontFamily={FONT_STACK_BY_FAMILY.sans}
                  fontWeight={700}
                  fontSize={labelSize}
                  fill="rgba(17, 24, 39, 0.95)"
                  opacity={interpolate(labelProgress, [0, 1], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}
                >
                  {`${segment.label} — ${formatSeatArcValue(segment.value)}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
