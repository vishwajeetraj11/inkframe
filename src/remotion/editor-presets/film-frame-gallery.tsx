import { parseFilmFrameGalleryText } from "@/lib/editor/film-frame-gallery";
import { Easing, interpolate, spring } from "remotion";
import type { PresetRendererProps } from "./types";
import {
  EDITORIAL_SERIF_STACK,
  FONT_STACK_BY_FAMILY,
  NewsCrumpleTexture,
  clamp01,
} from "./shared";

export const renderFilmFrameGalleryPreset = ({
  overlay,
  frame,
  safeDuration,
  animation,
  aspect,
  hasMediaClips,
  activeMediaClipIndex,
  activeMediaClipStartFrame,
  activeMediaClipDurationInFrames,
  mediaClipCount,
}: PresetRendererProps) => {
  const { headline, subhead, location, year } = parseFilmFrameGalleryText(overlay.text);
  const isVertical = aspect === "reel_9_16";
  const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
  const entry = spring({
    frame,
    fps: 30,
    config: {
      damping: 180,
      stiffness: 220,
      mass: 0.92,
    },
  });
  const matteReveal = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const textReveal = interpolate(frame, [8, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const safeClipDuration = Math.max(1, activeMediaClipDurationInFrames ?? safeDuration);
  const clipLocalFrame =
    activeMediaClipStartFrame !== undefined ? Math.max(0, frame - activeMediaClipStartFrame) : frame;
  const clipProgress = clamp01(clipLocalFrame / Math.max(1, safeClipDuration - 1));
  const activeIndex = Math.max(0, activeMediaClipIndex ?? 0);
  const clipEntry = spring({
    frame: clipLocalFrame,
    fps: 30,
    config: {
      damping: 190,
      stiffness: 240,
      mass: 0.9,
    },
  });
  const wrapperOpacity = animation.baseOpacity;
  const wrapperTranslateY = animation.baseTranslateY * 0.04;
  const wrapperScale = interpolate(entry, [0, 1], [0.985, animation.baseScale], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wrapperBlur = animation.blur * 0.1;
  const frameScale = interpolate(clipProgress, [0, 1], [1.012, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const grainShiftX = Math.sin(frame / 11) * 4;
  const grainShiftY = Math.cos(frame / 14) * 3;
  const apertureWidth = isVertical ? "88%" : "92%";
  const apertureHeight = isVertical ? "52%" : "88%";
  const apertureRadius = isVertical ? "1.8rem" : "1.4rem";
  const captionWidth = isVertical ? "74%" : "34%";
  const captionLeft = isVertical ? "7%" : "5%";
  const captionTop = isVertical ? "66%" : "79%";
  const chipSize = overlay.fontSize * (isVertical ? 0.12 : 0.11);
  const headlineSize = overlay.fontSize * (isVertical ? 0.46 : 0.42);
  const subheadSize = overlay.fontSize * (isVertical ? 0.185 : 0.17);
  const metaSize = overlay.fontSize * 0.145;
  const frameCounter = hasMediaClips && mediaClipCount
    ? `${String(activeIndex + 1).padStart(2, "0")} / ${String(mediaClipCount).padStart(2, "0")}`
    : "Still";
  const metaLine = [location.trim(), year.trim()].filter((part) => part.length > 0).join(" • ");

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(circle at 50% 50%, rgba(28, 23, 18, 0.16), rgba(3, 3, 5, 0.76) 76%)," +
          "linear-gradient(180deg, rgba(3,3,4,0.18), rgba(0,0,0,0.48))",
        opacity: wrapperOpacity,
        filter: `blur(${wrapperBlur}px)`,
        transform: `translateY(${wrapperTranslateY}px) scale(${wrapperScale})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: `${overlay.x}%`,
          top: `${overlay.y}%`,
          width: apertureWidth,
          height: apertureHeight,
          transform: `translate(-50%, -50%) scale(${interpolate(matteReveal, [0, 1], [0.97, frameScale], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })})`,
          transformOrigin: "center center",
        }}
      >
        {!hasMediaClips ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: apertureRadius,
              background:
                "radial-gradient(circle at 50% 42%, rgba(66, 55, 44, 0.3), rgba(18, 16, 16, 0.92) 72%)," +
                "linear-gradient(180deg, rgba(23, 21, 19, 0.82), rgba(7, 7, 9, 0.94))",
            }}
          />
        ) : null}

        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: apertureRadius,
            boxShadow:
              "0 0 0 9999px rgba(0, 0, 0, 0.9)," +
              "inset 0 0 0 1px rgba(255, 247, 224, 0.18)," +
              "inset 0 0 90px rgba(0, 0, 0, 0.48)," +
              "0 28px 80px rgba(0, 0, 0, 0.42)",
            opacity: matteReveal,
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: apertureRadius,
            overflow: "hidden",
            opacity: matteReveal,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 50% 48%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.28) 100%)," +
                "linear-gradient(180deg, rgba(7, 7, 8, 0.18), rgba(7, 7, 8, 0.08) 28%, rgba(7, 7, 8, 0.26) 100%)",
              pointerEvents: "none",
            }}
          />
          <NewsCrumpleTexture
            style={{
              opacity: 0.085 + clipEntry * 0.03,
              mixBlendMode: "soft-light",
              pointerEvents: "none",
              transform: `translate(${grainShiftX}px, ${grainShiftY}px) scale(1.03)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 1.1px)",
              backgroundSize: "8px 8px",
              backgroundPosition: `${grainShiftX}px ${grainShiftY}px`,
              opacity: 0.15,
              mixBlendMode: "soft-light",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: captionLeft,
          top: captionTop,
          width: captionWidth,
          padding: isVertical ? "0.9em 1em" : "0.8em 0.94em",
          borderRadius: "1rem",
          border: "1px solid rgba(255, 243, 220, 0.12)",
          background:
            "linear-gradient(180deg, rgba(18, 16, 15, 0.84), rgba(10, 10, 12, 0.78))",
          boxShadow: "0 16px 46px rgba(0, 0, 0, 0.34)",
          opacity: textReveal,
          transform: `translateY(${interpolate(textReveal, [0, 1], [14, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1em",
            color: "rgba(236, 223, 198, 0.88)",
            fontFamily: FONT_STACK_BY_FAMILY.mono,
            fontSize: `${chipSize}px`,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          <span>Film Frame</span>
          <span>{frameCounter}</span>
        </div>

        <div
          style={{
            marginTop: "0.42em",
            color: overlay.color,
            fontFamily: EDITORIAL_SERIF_STACK,
            fontSize: `${headlineSize}px`,
            fontWeight: 700,
            lineHeight: 0.96,
            letterSpacing: "-0.035em",
            textWrap: "balance",
          }}
        >
          {headline}
        </div>

        {subhead.trim() ? (
          <div
            style={{
              marginTop: "0.42em",
              color: "rgba(235, 226, 212, 0.74)",
              fontFamily: EDITORIAL_SERIF_STACK,
              fontStyle: "italic",
              fontSize: `${subheadSize}px`,
              lineHeight: 1.18,
            }}
          >
            {subhead}
          </div>
        ) : null}

        {metaLine ? (
          <div
            style={{
              marginTop: "0.72em",
              color: "rgba(236, 223, 198, 0.88)",
              fontFamily: FONT_STACK_BY_FAMILY.mono,
              fontSize: `${metaSize}px`,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {metaLine}
          </div>
        ) : null}
      </div>
    </div>
  );
};
