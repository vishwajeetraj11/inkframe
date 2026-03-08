import { findProjectedWorldCountry } from "@/lib/maps/world";
import { Easing, interpolate } from "remotion";
import type { PresetRendererProps } from "./types";
import {
  EDITORIAL_SERIF_STACK,
  FONT_STACK_BY_FAMILY,
  WORLD_MAP_FOCUS_DEFAULT_COUNTRY,
  WORLD_MAP_TALL,
  WORLD_MAP_WIDE,
  clampRange,
  parseWorldMapFocusPresetText,
} from "./shared";
export const renderWorldMapFocusPreset = ({
  overlay,
  frame,
  animation,
  aspect,
}: PresetRendererProps) => {
  const { headline, subhead, country } = parseWorldMapFocusPresetText(
    overlay.text,
  );
  const isVertical = aspect === "reel_9_16";
  const projectedMap = isVertical ? WORLD_MAP_TALL : WORLD_MAP_WIDE;
  const focusedCountry =
    findProjectedWorldCountry(projectedMap, country) ??
    findProjectedWorldCountry(projectedMap, WORLD_MAP_FOCUS_DEFAULT_COUNTRY) ??
    projectedMap.countries[0];
  const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
  const panelProgress = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const headerProgress = interpolate(frame, [6, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const mapReveal = interpolate(frame, [12, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const focusProgress = interpolate(frame, [26, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const labelProgress = interpolate(frame, [32, 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const wrapperOpacity = animation.baseOpacity;
  const wrapperBlur = animation.blur * 0.08;
  const wrapperTranslateY = animation.baseTranslateY * 0.1;
  const wrapperScale = interpolate(panelProgress, [0, 1], [0.985, animation.baseScale], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const layout = isVertical
    ? {
        panelWidth: "92%",
        panelHeight: "82%",
        headerLeft: "7.5%",
        headerTop: "8%",
        headerWidth: "78%",
        mapLeft: "6%",
        mapTop: "28%",
        mapWidth: "88%",
        mapHeight: "56%",
        titleSize: overlay.fontSize * 0.62,
        subheadSize: overlay.fontSize * 0.22,
        chipSize: overlay.fontSize * 0.15,
      }
    : {
        panelWidth: "88%",
        panelHeight: "80%",
        headerLeft: "6%",
        headerTop: "8%",
        headerWidth: "42%",
        mapLeft: "36%",
        mapTop: "12%",
        mapWidth: "58%",
        mapHeight: "76%",
        titleSize: overlay.fontSize * 0.58,
        subheadSize: overlay.fontSize * 0.21,
        chipSize: overlay.fontSize * 0.13,
      };
  const pulseScale = 1 + Math.sin(frame / 8) * 0.08 * focusProgress;
  const labelLeft = clampRange(
    (focusedCountry.centroid[0] / projectedMap.width) * 100 + (isVertical ? -2 : 2),
    12,
    72,
  );
  const labelTop = clampRange(
    (focusedCountry.centroid[1] / projectedMap.height) * 100 + (isVertical ? -18 : -10),
    10,
    74,
  );

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
          left: "50%",
          top: "50%",
          width: layout.panelWidth,
          height: layout.panelHeight,
          transform: "translate(-50%, -50%)",
          borderRadius: "2.2rem",
          overflow: "hidden",
          border: "1px solid rgba(141, 166, 194, 0.18)",
          background:
            "linear-gradient(165deg, rgba(9, 17, 27, 0.96) 0%, rgba(11, 21, 34, 0.97) 52%, rgba(8, 15, 24, 0.98) 100%)",
          boxShadow: "0 24px 70px rgba(0, 0, 0, 0.36)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 18% 16%, rgba(77, 190, 255, 0.16), rgba(77, 190, 255, 0) 24%)," +
              "radial-gradient(circle at 82% 72%, rgba(17, 110, 170, 0.16), rgba(17, 110, 170, 0) 26%)," +
              "repeating-linear-gradient(0deg, rgba(103, 129, 154, 0.06) 0 1px, transparent 1px 74px)," +
              "repeating-linear-gradient(90deg, rgba(103, 129, 154, 0.05) 0 1px, transparent 1px 92px)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: layout.headerLeft,
            top: layout.headerTop,
            width: layout.headerWidth,
            zIndex: 2,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.7em",
              padding: "0.35em 0.7em",
              borderRadius: "999px",
              backgroundColor: "rgba(78, 197, 255, 0.14)",
              color: "#9edfff",
              fontFamily: FONT_STACK_BY_FAMILY.mono,
              fontWeight: 700,
              fontSize: `${layout.chipSize}px`,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              opacity: headerProgress,
              transform: `translateY(${interpolate(headerProgress, [0, 1], [8, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px)`,
            }}
          >
            World Map
          </div>

          <div
            style={{
              marginTop: "0.5em",
              color: "#f4f7fb",
              fontFamily: EDITORIAL_SERIF_STACK,
              fontWeight: 700,
              fontSize: `${layout.titleSize}px`,
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              opacity: headerProgress,
              transform: `translateY(${interpolate(headerProgress, [0, 1], [20, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px)`,
            }}
          >
            {headline}
          </div>

          <div
            style={{
              marginTop: "0.42em",
              color: "rgba(207, 221, 235, 0.74)",
              fontFamily: EDITORIAL_SERIF_STACK,
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: `${layout.subheadSize}px`,
              lineHeight: 1.15,
              opacity: headerProgress,
              transform: `translateY(${interpolate(headerProgress, [0, 1], [12, 0], {
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
            left: layout.mapLeft,
            top: layout.mapTop,
            width: layout.mapWidth,
            height: layout.mapHeight,
            zIndex: 1,
            clipPath: `inset(0 ${Math.round((1 - mapReveal) * 100)}% 0 0 round 1.8rem)`,
            opacity: interpolate(mapReveal, [0, 1], [0.15, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${interpolate(mapReveal, [0, 1], [18, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          <svg
            viewBox={`0 0 ${projectedMap.width} ${projectedMap.height}`}
            style={{ width: "100%", height: "100%" }}
          >
            <path
              d={projectedMap.landPath}
              fill="rgba(138, 158, 177, 0.2)"
              stroke="rgba(116, 138, 159, 0.12)"
              strokeWidth={1}
            />
            <path
              d={projectedMap.bordersPath}
              fill="none"
              stroke="rgba(163, 183, 205, 0.18)"
              strokeWidth={0.85}
              strokeLinejoin="round"
            />
            <path
              d={focusedCountry.path}
              fill="rgba(78, 197, 255, 0.86)"
              stroke="rgba(207, 247, 255, 0.9)"
              strokeWidth={2.2}
              opacity={focusProgress}
            />
            <circle
              cx={focusedCountry.centroid[0]}
              cy={focusedCountry.centroid[1]}
              r={10}
              fill="rgba(78, 197, 255, 0.18)"
              opacity={focusProgress}
              transform={`scale(${pulseScale})`}
              style={{
                transformOrigin: `${focusedCountry.centroid[0]}px ${focusedCountry.centroid[1]}px`,
              }}
            />
            <circle
              cx={focusedCountry.centroid[0]}
              cy={focusedCountry.centroid[1]}
              r={5.2}
              fill="#f4f7fb"
              opacity={focusProgress}
            />
            <circle
              cx={focusedCountry.centroid[0]}
              cy={focusedCountry.centroid[1]}
              r={18}
              fill="none"
              stroke="rgba(78, 197, 255, 0.5)"
              strokeWidth={2}
              opacity={focusProgress}
              transform={`scale(${1 + Math.sin((frame + 6) / 7) * 0.12 * focusProgress})`}
              style={{
                transformOrigin: `${focusedCountry.centroid[0]}px ${focusedCountry.centroid[1]}px`,
              }}
            />
          </svg>

          <div
            style={{
              position: "absolute",
              left: `${labelLeft}%`,
              top: `${labelTop}%`,
              padding: "0.7em 0.88em",
              borderRadius: "1rem",
              border: "1px solid rgba(121, 151, 179, 0.24)",
              backgroundColor: "rgba(11, 21, 34, 0.92)",
              boxShadow: "0 16px 36px rgba(0, 0, 0, 0.24)",
              opacity: labelProgress,
              transform: `translateY(${interpolate(labelProgress, [0, 1], [12, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px)`,
            }}
          >
            <div
              style={{
                color: "#9edfff",
                fontFamily: FONT_STACK_BY_FAMILY.mono,
                fontWeight: 700,
                fontSize: `${layout.chipSize * 0.88}px`,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Country In Focus
            </div>
            <div
              style={{
                marginTop: "0.28em",
                color: "#f4f7fb",
                fontFamily: FONT_STACK_BY_FAMILY.sans,
                fontWeight: 700,
                fontSize: `${layout.subheadSize * 0.92}px`,
                lineHeight: 1.05,
              }}
            >
              {focusedCountry.name}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

