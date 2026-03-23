import {
  findProjectedWorldCountry,
  projectRegionalWorldMap,
} from "@/lib/maps/world";
import { parseRegionalMapFocusText } from "@/lib/editor/regional-map-focus";
import { Easing, interpolate } from "remotion";
import type { PresetRendererProps } from "./types";
import {
  EDITORIAL_SERIF_STACK,
  FONT_STACK_BY_FAMILY,
  WORLD_MAP_TALL,
  WORLD_MAP_WIDE,
  clampRange,
} from "./shared";

export const renderRegionalMapFocusPreset = ({
  overlay,
  frame,
  animation,
  aspect,
  safeDuration,
}: PresetRendererProps) => {
  const {
    headline,
    subhead,
    primaryCountry,
    secondaryCountry,
    label,
    year,
    focusMode,
  } = parseRegionalMapFocusText(overlay.text);
  const isVertical = aspect === "reel_9_16";
  const globalMap = isVertical ? WORLD_MAP_TALL : WORLD_MAP_WIDE;
  const projectedMap = projectRegionalWorldMap({
    width: isVertical ? 920 : 1380,
    height: isVertical ? 1180 : 860,
    padding: isVertical ? { x: 92, y: 164 } : { x: 176, y: 144 },
    primaryCountryName: primaryCountry,
    secondaryCountryName: secondaryCountry || undefined,
  });
  const globalPrimaryCountry =
    findProjectedWorldCountry(globalMap, primaryCountry) ?? globalMap.countries[0] ?? null;
  const globalSecondaryCountry = secondaryCountry
    ? findProjectedWorldCountry(globalMap, secondaryCountry)
    : null;
  const resolvedFocusMode =
    focusMode === "border" && projectedMap.sharedBorderPath ? "border" : "country";
  const focusAnchor =
    (resolvedFocusMode === "border"
      ? projectedMap.sharedBorderCentroid
      : projectedMap.primaryCountry?.centroid) ??
    projectedMap.secondaryCountry?.centroid ?? [
      projectedMap.width / 2,
      projectedMap.height / 2,
    ];
  const globalFocusAnchor =
    globalPrimaryCountry && globalSecondaryCountry
      ? ([
          (globalPrimaryCountry.centroid[0] + globalSecondaryCountry.centroid[0]) / 2,
          (globalPrimaryCountry.centroid[1] + globalSecondaryCountry.centroid[1]) / 2,
        ] as [number, number])
      : globalPrimaryCountry?.centroid ??
        globalSecondaryCountry?.centroid ?? [
          globalMap.width / 2,
          globalMap.height / 2,
        ];
  const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
  const panelProgress = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const worldMapProgress = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const globalExitProgress = interpolate(frame, [18, 44], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const regionalEnterProgress = interpolate(frame, [18, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const headerProgress = interpolate(frame, [46, 64], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const mapReveal = interpolate(frame, [18, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const zoomProgress = interpolate(frame, [16, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const focusProgress = interpolate(frame, [42, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const borderProgress = interpolate(frame, [48, 68], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const labelProgress = interpolate(frame, [50, 68], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const wrapperOpacity = animation.baseOpacity;
  const wrapperBlur = animation.blur * 0.08;
  const wrapperTranslateY = animation.baseTranslateY * 0.08;
  const wrapperScale = interpolate(panelProgress, [0, 1], [0.99, animation.baseScale], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const mapScale = interpolate(zoomProgress, [0, 1], [1.58, 1.12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const regionalHoldScale = interpolate(
    frame,
    [44, Math.max(72, safeDuration - 12)],
    [1, 1.12],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: easeOut,
    },
  );
  const globalMapScale = interpolate(zoomProgress, [0, 1], [1, 1.32], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const spotlightPulse = 1 + Math.sin(frame / 10) * 0.05 * focusProgress;
  const layout = isVertical
    ? {
        headerLeft: 8,
        headerTop: 7,
        headerWidth: 76,
        mapLeft: 4,
        mapTop: 8,
        mapWidth: 92,
        mapHeight: 84,
        titleSize: overlay.fontSize * 0.48,
        subheadSize: overlay.fontSize * 0.19,
        chipSize: overlay.fontSize * 0.14,
      }
    : {
        headerLeft: 5,
        headerTop: 8,
        headerWidth: 34,
        mapLeft: 0,
        mapTop: 0,
        mapWidth: 100,
        mapHeight: 100,
        titleSize: overlay.fontSize * 0.42,
        subheadSize: overlay.fontSize * 0.155,
        chipSize: overlay.fontSize * 0.12,
      };
  const anchorLeftPercent =
    layout.mapLeft + (focusAnchor[0] / Math.max(1, projectedMap.width)) * layout.mapWidth;
  const anchorTopPercent =
    layout.mapTop + (focusAnchor[1] / Math.max(1, projectedMap.height)) * layout.mapHeight;
  const placeLabelLeft = anchorLeftPercent > (isVertical ? 54 : 56);
  const placeLabelAbove = anchorTopPercent > (isVertical ? 60 : 58);
  const labelLeft = clampRange(
    anchorLeftPercent + (placeLabelLeft ? (isVertical ? -16 : -12) : 2),
    isVertical ? 9 : 8,
    isVertical ? 72 : 84,
  );
  const labelTop = clampRange(
    anchorTopPercent + (placeLabelAbove ? (isVertical ? -16 : -12) : 5),
    isVertical ? 16 : 10,
    isVertical ? 78 : 76,
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
          inset: 0,
          background:
            "radial-gradient(circle at 18% 14%, rgba(255,255,255,0.45), rgba(255,255,255,0) 20%)," +
            "radial-gradient(circle at 82% 72%, rgba(164, 127, 78, 0.12), rgba(164, 127, 78, 0) 24%)," +
            "linear-gradient(160deg, #f2ebdd 0%, #e4dcc8 44%, #cfd5c4 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: `${layout.headerLeft}%`,
          top: `${layout.headerTop}%`,
          width: `${layout.headerWidth}%`,
          padding: isVertical ? "0.88em 1em 0.94em" : "0.82em 0.98em 0.9em",
          borderRadius: isVertical ? "1.15rem" : "1rem",
          border: "1px solid rgba(116, 100, 70, 0.18)",
          backgroundColor: "rgba(248, 243, 232, 0.94)",
          boxShadow: "0 18px 38px rgba(65, 52, 28, 0.16)",
          zIndex: 2,
          opacity: headerProgress,
          transform: `translateY(${interpolate(headerProgress, [0, 1], [16, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px)`,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0.34em 0.72em",
            borderRadius: "999px",
            backgroundColor:
              resolvedFocusMode === "border"
                ? "rgba(212, 126, 74, 0.16)"
                : "rgba(89, 108, 86, 0.12)",
            color: resolvedFocusMode === "border" ? "#8e3f1f" : "#465244",
            fontFamily: FONT_STACK_BY_FAMILY.mono,
            fontWeight: 700,
            fontSize: `${layout.chipSize}px`,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {resolvedFocusMode === "border" ? "Border Focus" : "Regional Atlas"}
        </div>

        <div
          style={{
            marginTop: "0.5em",
            color: "#1f2b21",
            fontFamily: EDITORIAL_SERIF_STACK,
            fontWeight: 700,
            fontSize: `${layout.titleSize}px`,
            lineHeight: 0.98,
            letterSpacing: "-0.035em",
            textWrap: "balance",
          }}
        >
          {headline}
        </div>

        <div
          style={{
            marginTop: "0.42em",
            color: "rgba(47, 57, 46, 0.76)",
            fontFamily: EDITORIAL_SERIF_STACK,
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: `${layout.subheadSize}px`,
            lineHeight: 1.14,
          }}
        >
          {subhead}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: `${layout.mapLeft}%`,
          top: `${layout.mapTop}%`,
          width: `${layout.mapWidth}%`,
          height: `${layout.mapHeight}%`,
          overflow: "hidden",
          zIndex: 1,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: worldMapProgress * globalExitProgress,
            transform: `translateY(${interpolate(worldMapProgress, [0, 1], [18, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px) scale(${globalMapScale})`,
            transformOrigin: `${globalFocusAnchor[0]}px ${globalFocusAnchor[1]}px`,
          }}
        >
          <svg
            viewBox={`0 0 ${globalMap.width} ${globalMap.height}`}
            style={{ width: "100%", height: "100%" }}
          >
            <path
              d={globalMap.landPath}
              fill="#bcc3b1"
              stroke="rgba(96, 104, 84, 0.14)"
              strokeWidth={1}
            />
            <path
              d={globalMap.bordersPath}
              fill="none"
              stroke="rgba(76, 88, 69, 0.18)"
              strokeWidth={0.9}
              strokeLinejoin="round"
            />
            {globalSecondaryCountry ? (
              <path
                d={globalSecondaryCountry.path}
                fill="rgba(192, 207, 163, 0.76)"
                stroke="rgba(91, 104, 79, 0.24)"
                strokeWidth={1.5}
                opacity={worldMapProgress}
              />
            ) : null}
            {globalPrimaryCountry ? (
              <path
                d={globalPrimaryCountry.path}
                fill="rgba(229, 198, 118, 0.86)"
                stroke="rgba(143, 111, 52, 0.42)"
                strokeWidth={1.8}
                opacity={worldMapProgress}
              />
            ) : null}
            <circle
              cx={globalFocusAnchor[0]}
              cy={globalFocusAnchor[1]}
              r={isVertical ? 40 : 28}
              fill="rgba(245, 238, 211, 0.08)"
              stroke="rgba(245, 238, 211, 0.46)"
              strokeWidth={2}
              opacity={worldMapProgress}
            />
            <circle
              cx={globalFocusAnchor[0]}
              cy={globalFocusAnchor[1]}
              r={4.6}
              fill={resolvedFocusMode === "border" ? "#f36b44" : "#5d7158"}
              opacity={worldMapProgress}
            />
          </svg>
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: interpolate(regionalEnterProgress, [0, 1], [0.14, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            clipPath: `inset(0 ${Math.round((1 - mapReveal) * 100)}% 0 0 round ${isVertical ? "2rem" : "0rem"})`,
            transform: `translateY(${interpolate(mapReveal, [0, 1], [18, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px) scale(${mapScale * regionalHoldScale})`,
            transformOrigin: `${focusAnchor[0]}px ${focusAnchor[1]}px`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(240, 233, 215, 0.16), rgba(109, 130, 113, 0.04) 100%)",
            }}
          />
          <svg
            viewBox={`0 0 ${projectedMap.width} ${projectedMap.height}`}
            style={{ width: "100%", height: "100%" }}
          >
            <path
              d={projectedMap.landPath}
              fill="#b8bea9"
              stroke="rgba(104, 112, 91, 0.18)"
              strokeWidth={1}
            />
            <path
              d={projectedMap.bordersPath}
              fill="none"
              stroke="rgba(73, 87, 71, 0.24)"
              strokeWidth={0.95}
              strokeLinejoin="round"
            />
            {projectedMap.secondaryCountry ? (
              <path
                d={projectedMap.secondaryCountry.path}
                fill="rgba(189, 205, 155, 0.8)"
                stroke="rgba(84, 98, 74, 0.3)"
                strokeWidth={1.8}
                opacity={focusProgress}
              />
            ) : null}
            {projectedMap.primaryCountry ? (
              <path
                d={projectedMap.primaryCountry.path}
                fill="rgba(228, 197, 116, 0.88)"
                stroke="rgba(146, 111, 52, 0.52)"
                strokeWidth={2.1}
                opacity={focusProgress}
              />
            ) : null}
            {resolvedFocusMode === "border" && projectedMap.sharedBorderPath ? (
              <>
                <path
                  d={projectedMap.sharedBorderPath}
                  fill="none"
                  stroke="rgba(243, 107, 68, 0.26)"
                  strokeWidth={6.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  strokeDasharray="0.03 0.02"
                  opacity={borderProgress}
                />
                <path
                  d={projectedMap.sharedBorderPath}
                  fill="none"
                  stroke="#f36b44"
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  strokeDasharray="1"
                  strokeDashoffset={1 - borderProgress}
                  opacity={borderProgress}
                />
              </>
            ) : null}
            <circle
              cx={focusAnchor[0]}
              cy={focusAnchor[1]}
              r={isVertical ? 108 : 88}
              fill="none"
              stroke="rgba(248, 240, 210, 0.58)"
              strokeWidth={2.4}
              opacity={focusProgress}
              transform={`scale(${spotlightPulse})`}
              style={{
                transformOrigin: `${focusAnchor[0]}px ${focusAnchor[1]}px`,
              }}
            />
            <circle
              cx={focusAnchor[0]}
              cy={focusAnchor[1]}
              r={isVertical ? 64 : 54}
              fill="rgba(248, 242, 223, 0.1)"
              opacity={focusProgress}
              transform={`scale(${1 + Math.sin((frame + 6) / 9) * 0.06 * focusProgress})`}
              style={{
                transformOrigin: `${focusAnchor[0]}px ${focusAnchor[1]}px`,
              }}
            />
            <circle
              cx={focusAnchor[0]}
              cy={focusAnchor[1]}
              r={5.6}
              fill={resolvedFocusMode === "border" ? "#f36b44" : "#5d7158"}
              opacity={focusProgress}
            />
          </svg>
        </div>

        <div
          style={{
            position: "absolute",
            left: `${labelLeft}%`,
            top: `${labelTop}%`,
            padding: year ? "0.7em 0.92em" : "0.66em 0.88em",
            borderRadius: "1rem",
            border: "1px solid rgba(116, 100, 70, 0.18)",
            backgroundColor: "rgba(248, 243, 232, 0.94)",
            boxShadow: "0 18px 36px rgba(65, 52, 28, 0.16)",
            opacity: labelProgress,
            transform: `translateY(${interpolate(labelProgress, [0, 1], [12, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          <div
            style={{
              color: "#5a684e",
              fontFamily: FONT_STACK_BY_FAMILY.mono,
              fontWeight: 700,
              fontSize: `${layout.chipSize * 0.82}px`,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {resolvedFocusMode === "border" ? "Shared Border" : "Regional Focus"}
          </div>
          <div
            style={{
              marginTop: "0.22em",
              color: "#182116",
              fontFamily: FONT_STACK_BY_FAMILY.sans,
              fontWeight: 800,
              fontSize: `${layout.subheadSize * 0.98}px`,
              lineHeight: 1.04,
            }}
          >
            {label}
          </div>
          {year ? (
            <div
              style={{
                marginTop: "0.18em",
                color: "rgba(45, 55, 41, 0.72)",
                fontFamily: FONT_STACK_BY_FAMILY.mono,
                fontWeight: 700,
                fontSize: `${layout.chipSize * 0.84}px`,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {year}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
