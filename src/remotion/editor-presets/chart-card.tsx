import {
  formatChartCardValue,
  parseChartCardText,
  splitHeadlineAroundHighlight,
} from "@/lib/editor/chart-card";
import { Easing, interpolate } from "remotion";
import type { PresetRendererProps } from "./types";
import {
  FONT_STACK_BY_FAMILY,
  describePieSlicePath,
  getAnimatedSliceAngles,
  getChartCardSlices,
} from "./shared";
export const renderChartCardPreset = ({
  overlay,
  frame,
  animation,
  aspect,
}: PresetRendererProps) => {
  const { headline, highlight, subhead, rows } = parseChartCardText(
    overlay.text,
  );
  const slices = getChartCardSlices(rows);
  const { before, highlighted, after } = splitHeadlineAroundHighlight(
    headline,
    highlight,
  );
  const isVertical = aspect === "reel_9_16";
  const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
  const headlineReveal = interpolate(
    frame,
    [0, 14, 24, 34, 42],
    [0, 0.05, 0.18, 0.72, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const subheadReveal = interpolate(
    frame,
    [4, 18, 30, 40],
    [0, 0.18, 0.68, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const subheadProgress = interpolate(frame, [4, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const chartProgress = interpolate(
    frame,
    [8, 18, 26, 34],
    [0, 0.08, 0.34, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const highlightProgress = highlighted
    ? interpolate(frame, [34, 50], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: easeOut,
      })
    : 0;
  const wrapperOpacity = animation.baseOpacity;
  const wrapperScale = interpolate(
    chartProgress,
    [0, 1],
    [0.98, animation.baseScale],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const wrapperTranslateY = animation.baseTranslateY * 0.12;
  const wrapperBlur = animation.blur * 0.18;
  const headlineSize = overlay.fontSize * (isVertical ? 0.8 : 0.9);
  const subheadSize = overlay.fontSize * (isVertical ? 0.33 : 0.31);
  const legendSize = overlay.fontSize * (isVertical ? 0.34 : 0.42);
  const chartScale = interpolate(chartProgress, [0, 1], [0.97, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chartOpacity = interpolate(chartProgress, [0, 1], [0.72, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const layout = isVertical
    ? {
        headerLeft: "11.5%",
        headerTop: "10.5%",
        headerWidth: "77%",
        chartLeft: "50%",
        chartTop: "47.5%",
        chartWidth: "47%",
        legendLeft: "23.5%",
        legendTop: "68%",
        legendWidth: "53%",
        legendTranslateY: "0%",
      }
    : {
        headerLeft: "12.6%",
        headerTop: "12.5%",
        headerWidth: "78%",
        chartLeft: "28.8%",
        chartTop: "56%",
        chartWidth: "29.5%",
        legendLeft: "52%",
        legendTop: "50%",
        legendWidth: "27%",
        legendTranslateY: "-50%",
      };
  const patternId = `${overlay.id}-chart-card-dots`;

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
          left: layout.headerLeft,
          top: layout.headerTop,
          width: layout.headerWidth,
          color: overlay.color,
        }}
      >
        <div
          style={{
            display: "block",
            clipPath: `inset(0 ${Math.round((1 - headlineReveal) * 100)}% 0 0)`,
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
              lineHeight: 0.94,
              letterSpacing: "-0.03em",
              textWrap: isVertical ? "balance" : "wrap",
              whiteSpace: isVertical ? "normal" : "nowrap",
            }}
          >
            {before}
            {highlighted ? (
              <span
                style={{
                  position: "relative",
                  display: "inline-block",
                  fontStyle: "italic",
                  padding: "0 0.09em 0.01em",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    inset: "0.2em 0.04em 0.06em 0.04em",
                    backgroundColor: "rgba(242, 235, 70, 0.96)",
                    transform: `scaleX(${highlightProgress})`,
                    transformOrigin: "left center",
                    opacity: highlightProgress > 0 ? 1 : 0,
                    zIndex: 0,
                  }}
                />
                <span
                  style={{
                    position: "relative",
                    zIndex: 1,
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
            marginTop: isVertical ? "0.68em" : "1em",
            maxWidth: isVertical ? "100%" : "93%",
            color: "rgba(86, 90, 96, 0.5)",
            fontFamily: FONT_STACK_BY_FAMILY.serif,
            fontWeight: 500,
            fontStyle: "italic",
            fontSize: `${subheadSize}px`,
            lineHeight: 1.22,
            opacity: subheadProgress,
            clipPath: `inset(0 ${Math.round((1 - subheadReveal) * 100)}% 0 0)`,
            transform: `translateY(${interpolate(
              subheadProgress,
              [0, 1],
              [10, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            )}px)`,
            whiteSpace: "normal",
            overflowWrap: "anywhere",
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
          aspectRatio: "1 / 1",
          opacity: chartOpacity,
          transform: `translate(-50%, -50%) scale(${chartScale})`,
          transformOrigin: "center center",
        }}
      >
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
          <defs>
            <pattern
              id={patternId}
              width="3.5"
              height="3.5"
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx="0.9"
                cy="0.9"
                r="0.55"
                fill="rgba(31, 41, 55, 0.16)"
              />
            </pattern>
          </defs>

          {slices.map((slice, index) => {
            const animatedAngles = getAnimatedSliceAngles(slice, chartProgress);
            if (animatedAngles === null) {
              return null;
            }

            const path = describePieSlicePath(
              50,
              50,
              46,
              animatedAngles.startAngle,
              animatedAngles.endAngle,
            );
            if (!path) {
              return null;
            }

            return (
              <g key={`${overlay.id}-chart-slice-${slice.label}-${index}`}>
                <path d={path} fill={slice.color} />
                <path d={path} fill={`url(#${patternId})`} opacity={0.38} />
              </g>
            );
          })}

          <circle
            cx="50"
            cy="50"
            r="46"
            fill="transparent"
            stroke="rgba(17, 24, 39, 0.04)"
            strokeWidth="0.3"
            opacity={interpolate(chartProgress, [0.18, 1], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}
          />
        </svg>
      </div>

      <div
        style={{
          position: "absolute",
          left: layout.legendLeft,
          top: layout.legendTop,
          width: layout.legendWidth,
          transform: `translateY(${layout.legendTranslateY})`,
          display: "flex",
          flexDirection: "column",
          gap: isVertical ? "0.8em" : "1.15em",
        }}
      >
        {rows.map((row, index) => {
          const labelStart = 26 + index * 6;
          const labelProgress = interpolate(
            frame,
            [labelStart, labelStart + 10],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: easeOut,
            },
          );
          const valueStart = 32 + index * 6;
          const valueProgress = interpolate(
            frame,
            [valueStart, valueStart + 8],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: easeOut,
            },
          );

          return (
            <div
              key={`${overlay.id}-chart-legend-${row.label}-${index}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.8em",
                opacity: labelProgress,
                transform: `translateX(${interpolate(
                  labelProgress,
                  [0, 1],
                  [10, 0],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                )}px)`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.7em",
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    width: `${legendSize * 0.28}px`,
                    height: `${legendSize * 0.28}px`,
                    borderRadius: "999px",
                    backgroundColor: row.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    color: "#121212",
                    fontFamily: FONT_STACK_BY_FAMILY.sans,
                    fontWeight: 500,
                    fontSize: `${legendSize}px`,
                    lineHeight: 1.1,
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: "0.18em",
                  }}
                >
                  <span>{row.label}</span>
                  <span aria-hidden="true">{"\u2014"}</span>
                  <span
                    style={{
                      opacity: valueProgress,
                    }}
                  >
                    {formatChartCardValue(row.value)}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

