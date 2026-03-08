import { Easing, interpolate } from "remotion";
import type { PresetRendererProps } from "./types";
import {
  EDITORIAL_SERIF_STACK,
  FONT_STACK_BY_FAMILY,
  parseEditorialBarChartPresetText,
} from "./shared";
export const renderEditorialBarChartPreset = ({
  overlay,
  frame,
  animation,
  aspect,
}: PresetRendererProps) => {
  const { headline, subhead, rows } = parseEditorialBarChartPresetText(
    overlay.text,
  );
  const isVertical = aspect === "reel_9_16";
  const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
  const panelProgress = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const subheadProgress = interpolate(frame, [2, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const axisProgress = interpolate(frame, [6, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const barsAndTitleStart = 24;
  const barsMaxDuration = 24;
  const titleProgress = interpolate(
    frame,
    [barsAndTitleStart, barsAndTitleStart + barsMaxDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: easeOut,
    },
  );
  const titleRise = interpolate(titleProgress, [0, 1], [26, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wrapperOpacity = animation.baseOpacity;
  const wrapperScale = interpolate(panelProgress, [0, 1], [0.985, animation.baseScale], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wrapperBlur = animation.blur * 0.08;
  const wrapperTranslateY = animation.baseTranslateY * 0.1;
  const titleSize = overlay.fontSize * (isVertical ? 0.58 : 0.64);
  const subheadSize = overlay.fontSize * (isVertical ? 0.23 : 0.24);
  // SVG text uses viewBox units (not px), so keep these compact for readable axes.
  const axisLabelSize = isVertical ? 3.2 : 2.6;
  const monthLabelSize = isVertical ? 2 : 1.58;
  const headerLeft = isVertical ? "8%" : "14%";
  const headerTop = isVertical ? "12.5%" : "14.6%";
  const headerWidth = isVertical ? "84%" : "72%";
  const chartLeft = isVertical ? "8%" : "14%";
  const chartTop = isVertical ? "31%" : "31.8%";
  const chartWidth = isVertical ? "84%" : "72%";
  const chartHeight = isVertical ? "56%" : "54%";
  const plotLeft = 13;
  const plotTop = 6;
  const plotRight = 98;
  const plotBottom = 84;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;
  const barCount = Math.max(1, rows.length);
  const slotWidth = plotWidth / barCount;
  const barWidth = Math.max(2.2, Math.min(5.2, slotWidth * 0.26));
  const yTicks = [100, 80, 60, 40, 20];

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
          left: headerLeft,
          top: headerTop,
          width: headerWidth,
          color: "#0f1115",
        }}
      >
        <div
          style={{
            fontFamily: EDITORIAL_SERIF_STACK,
            fontWeight: 700,
            fontSize: `${titleSize}px`,
            lineHeight: 0.95,
            letterSpacing: "-0.028em",
            opacity: titleOpacity,
            transform: `translateY(${titleRise}px)`,
          }}
        >
          {headline}
        </div>
        <div
          style={{
            marginTop: "0.28em",
            maxWidth: isVertical ? "100%" : "84%",
            color: "rgba(52, 56, 63, 0.6)",
            fontFamily: EDITORIAL_SERIF_STACK,
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: `${subheadSize}px`,
            lineHeight: 1.1,
            opacity: subheadProgress,
            transform: `translateY(${interpolate(subheadProgress, [0, 1], [8, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          {subhead}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: chartLeft,
          top: chartTop,
          width: chartWidth,
          height: chartHeight,
        }}
      >
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
          <g opacity={axisProgress}>
            {yTicks.map((tick) => {
              const y = plotBottom - (tick / 100) * plotHeight;
              const tickIndex = yTicks.indexOf(tick);
              const revealOrder = yTicks.length - 1 - tickIndex;
              const tickReveal = interpolate(
                frame,
                [barsAndTitleStart + revealOrder * 2, barsAndTitleStart + revealOrder * 2 + 10],
                [0, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: easeOut,
                },
              );
              const tickRise = interpolate(tickReveal, [0, 1], [6, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

              return (
                <g key={`editorial-bar-tick-${tick}`}>
                  <line
                    x1={plotLeft}
                    y1={y}
                    x2={plotRight}
                    y2={y}
                    stroke="rgba(85, 91, 98, 0.11)"
                    strokeWidth={0.32}
                  />
                  <text
                    x={1}
                    y={y + 0.95 + tickRise}
                    fill="rgba(40, 44, 48, 0.72)"
                    fontFamily={FONT_STACK_BY_FAMILY.sans}
                    fontSize={axisLabelSize}
                    fontWeight={500}
                    opacity={tickReveal}
                  >
                    {tick}%
                  </text>
                </g>
              );
            })}
          </g>

          {rows.map((row, index) => {
            const barDuration = Math.max(
              6,
              Math.round((row.value / 100) * barsMaxDuration),
            );
            const barProgress = interpolate(
              frame,
              [barsAndTitleStart, barsAndTitleStart + barDuration],
              [0, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );
            const barFade = interpolate(barProgress, [0, 1], [0.5, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const maxBarHeight = (row.value / 100) * plotHeight;
            const currentBarHeight = maxBarHeight * barProgress;
            const x = plotLeft + index * slotWidth + (slotWidth - barWidth) / 2;
            const y = plotBottom - currentBarHeight;
            const jitter = Math.sin((frame + index * 3.5) / 11) * 0.12;
            const monthLabel = row.label.toUpperCase().replace(/\s+/g, "").slice(0, 4);

            return (
              <g key={`editorial-bar-${row.label}-${index}`}>
                <rect
                  x={x}
                  y={y + jitter}
                  width={barWidth}
                  height={currentBarHeight}
                  rx={0.3}
                  fill={row.color}
                  opacity={barFade}
                />
                <rect
                  x={x + barWidth * 0.34}
                  y={y + jitter}
                  width={barWidth * 0.26}
                  height={currentBarHeight}
                  fill="rgba(255, 255, 255, 0.22)"
                  opacity={0.45 * barProgress}
                />
                <text
                  x={x + barWidth / 2}
                  y={plotBottom + 4.6}
                  fill="rgba(24, 28, 33, 0.9)"
                  fontFamily={FONT_STACK_BY_FAMILY.sans}
                  fontSize={monthLabelSize}
                  fontWeight={600}
                  textAnchor="middle"
                  opacity={axisProgress}
                >
                  {monthLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

