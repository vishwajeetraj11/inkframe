import { parseVoxTimelineText } from "@/lib/editor/vox-timeline";
import { Easing, interpolate, spring } from "remotion";
import type { PresetRendererProps } from "./types";
import {
  EDITORIAL_SERIF_STACK,
  FONT_STACK_BY_FAMILY,
  NewsCrumpleTexture,
  clamp01,
  getRevealClipPath,
} from "./shared";

export const renderVoxTimelineRibbonPreset = ({
  overlay,
  frame,
  safeDuration,
  animation,
  aspect,
  hasMediaClips,
  activeMediaClipIndex,
  activeMediaClipStartFrame,
}: PresetRendererProps) => {
  const { kicker, headline, events } = parseVoxTimelineText(overlay.text);
  const isVertical = aspect === "reel_9_16";
  const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
  const introFrames = Math.min(42, Math.max(24, Math.round(safeDuration * 0.18)));
  const outroFrames = Math.min(18, Math.max(10, Math.round(safeDuration * 0.1)));
  const eventWindow = Math.max(1, safeDuration - introFrames - outroFrames);
  const segmentFrames = eventWindow / Math.max(1, events.length);
  const timedActiveIndex = Math.min(
    events.length - 1,
    Math.max(0, Math.floor(Math.max(0, frame - introFrames) / Math.max(1, segmentFrames))),
  );
  const activeIndex =
    hasMediaClips && activeMediaClipIndex !== undefined
      ? Math.min(events.length - 1, Math.max(0, activeMediaClipIndex))
      : timedActiveIndex;
  const activeEvent = events[activeIndex] ?? events[0];
  const activeProgress =
    events.length <= 1 ? 0.5 : activeIndex / Math.max(1, events.length - 1);
  const activeCardStart =
    hasMediaClips && activeMediaClipStartFrame !== undefined
      ? Math.max(introFrames, activeMediaClipStartFrame)
      : introFrames + segmentFrames * activeIndex;
  const entry = spring({
    frame,
    fps: 30,
    config: {
      damping: 170,
      stiffness: 215,
      mass: 0.92,
    },
  });
  const activeCardEntry = spring({
    frame: frame - activeCardStart,
    fps: 30,
    config: {
      damping: 190,
      stiffness: 245,
      mass: 0.92,
    },
  });
  const lineReveal = interpolate(frame, [8, introFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const headerReveal = interpolate(frame, [4, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const wrapperOpacity = animation.baseOpacity;
  const wrapperScale = animation.baseScale;
  const wrapperTranslateY = animation.baseTranslateY * 0.06;
  const wrapperBlur = animation.blur * 0.16;
  const headerWidth = isVertical ? "80%" : "44%";
  const headerLeft = isVertical ? "9%" : "4.4%";
  const activeCardLayout = isVertical
    ? {
        left: "8%",
        right: "8%",
        top: "24%",
        width: "84%",
      }
    : {
        left: "57%",
        right: "4.4%",
        top: "12%",
        width: "38.6%",
      };
  const ribbonLayout = isVertical
    ? {
        left: "4.5%",
        right: "4.5%",
        bottom: "5.4%",
        height: "21%",
      }
    : {
        left: "4.4%",
        right: "4.4%",
        bottom: "5.2%",
        height: "18%",
      };
  const timelineInsetX = isVertical ? 9 : 8;
  const timelineWidth = isVertical ? 82 : 84;
  const headlineSize = overlay.fontSize * (isVertical ? 0.58 : 0.54);
  const cardTitleSize = overlay.fontSize * (isVertical ? 0.48 : 0.44);
  const cardCaptionSize = overlay.fontSize * 0.22;
  const dateSize = overlay.fontSize * 0.18;

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
      {hasMediaClips ? (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(7, 8, 10, 0.58) 0%, rgba(7, 8, 10, 0.14) 30%, rgba(7, 8, 10, 0.08) 54%, rgba(7, 8, 10, 0.58) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 50% 50%, rgba(15, 11, 8, 0) 44%, rgba(15, 11, 8, 0.3) 100%)",
            }}
          />
        </>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: headerLeft,
          top: isVertical ? "7%" : "7.4%",
          width: headerWidth,
          padding: isVertical ? "1.1em 1.12em 1em" : "1.02em 1.16em 1.04em",
          border: "1px solid rgba(45, 33, 17, 0.14)",
          background: "rgba(248, 243, 232, 0.94)",
          boxShadow: "0 20px 44px rgba(0, 0, 0, 0.24)",
          overflow: "hidden",
          clipPath: getRevealClipPath(headerReveal),
          transform: `scale(${interpolate(entry, [0, 1], [0.985, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })})`,
          transformOrigin: "left top",
        }}
      >
        <NewsCrumpleTexture
          style={{
            opacity: 0.05,
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "inline-block",
              color: "rgba(36, 46, 58, 0.82)",
              fontFamily: FONT_STACK_BY_FAMILY.mono,
              fontSize: `${overlay.fontSize * 0.18}px`,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            {kicker}
          </div>

          <div
            style={{
              marginTop: "0.38em",
              color: overlay.color,
              fontFamily: EDITORIAL_SERIF_STACK,
              fontSize: `${headlineSize}px`,
              fontWeight: 700,
              lineHeight: 0.94,
              letterSpacing: "-0.04em",
              textWrap: "balance",
            }}
          >
            {headline}
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: activeCardLayout.left,
          right: activeCardLayout.right,
          top: activeCardLayout.top,
          width: activeCardLayout.width,
          border: activeEvent.emphasis
            ? "1px solid rgba(214, 161, 23, 0.4)"
            : "1px solid rgba(45, 33, 17, 0.14)",
          background: "rgba(248, 243, 232, 0.95)",
          boxShadow: "0 24px 56px rgba(0, 0, 0, 0.28)",
          overflow: "hidden",
          opacity: interpolate(activeCardEntry, [0, 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          transform: `translateY(${interpolate(activeCardEntry, [0, 1], [22, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px) scale(${interpolate(activeCardEntry, [0, 1], [0.98, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })})`,
          clipPath: getRevealClipPath(activeCardEntry),
        }}
      >
        <NewsCrumpleTexture
          style={{
            opacity: 0.05,
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            padding: isVertical ? "1.04em 1.05em 1.08em" : "1em 1.08em 1.02em",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.26em 0.62em",
              borderRadius: 999,
              backgroundColor: activeEvent.emphasis
                ? "rgba(214, 161, 23, 0.3)"
                : "rgba(38, 49, 61, 0.08)",
              color: "#26313d",
              fontFamily: FONT_STACK_BY_FAMILY.mono,
              fontSize: `${dateSize}px`,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {activeEvent.date}
          </div>

          <div
            style={{
              marginTop: "0.38em",
              color: overlay.color,
              fontFamily: FONT_STACK_BY_FAMILY.sans,
              fontSize: `${cardTitleSize}px`,
              fontWeight: 900,
              lineHeight: 0.94,
              letterSpacing: "-0.04em",
              textWrap: "balance",
            }}
          >
            {activeEvent.title}
          </div>

          <div
            style={{
              marginTop: "0.62em",
              color: "rgba(31, 41, 55, 0.84)",
              fontFamily: FONT_STACK_BY_FAMILY.sans,
              fontSize: `${cardCaptionSize}px`,
              fontWeight: 500,
              lineHeight: 1.24,
              textWrap: "pretty",
            }}
          >
            {activeEvent.caption}
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: ribbonLayout.left,
          right: ribbonLayout.right,
          bottom: ribbonLayout.bottom,
          height: ribbonLayout.height,
          border: "1px solid rgba(45, 33, 17, 0.14)",
          background: "rgba(247, 241, 231, 0.92)",
          boxShadow: "0 24px 48px rgba(0, 0, 0, 0.22)",
          overflow: "hidden",
        }}
      >
        <NewsCrumpleTexture
          style={{
            opacity: 0.06,
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: `${timelineInsetX}%`,
            width: `${timelineWidth}%`,
            top: isVertical ? "38%" : "34%",
            height: 4,
            borderRadius: 999,
            backgroundColor: "rgba(38, 49, 61, 0.12)",
            boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.06)",
            transformOrigin: "left center",
            transform: `scaleX(${lineReveal})`,
          }}
        />

        <div
          style={{
            position: "absolute",
            left: `${timelineInsetX}%`,
            width: `${timelineWidth * clamp01(activeProgress)}%`,
            top: isVertical ? "38%" : "34%",
            height: 4,
            borderRadius: 999,
            background:
              "linear-gradient(90deg, rgba(214, 161, 23, 0.52), rgba(214, 161, 23, 0.96))",
            boxShadow: "0 0 20px rgba(214, 161, 23, 0.2)",
            transformOrigin: "left center",
            transform: `scaleX(${lineReveal})`,
          }}
        />

        {events.map((event, index) => {
          const progress = events.length <= 1 ? 0.5 : index / Math.max(1, events.length - 1);
          const eventStart = introFrames + segmentFrames * index;
          const nodeEntry = spring({
            frame: frame - eventStart,
            fps: 30,
            config: {
              damping: 170,
              stiffness: 250,
              mass: 0.88,
            },
          });
          const isActive = index === activeIndex;
          const isPast = index < activeIndex;
          const leftPercent = timelineInsetX + progress * timelineWidth;
          const nodeScale = interpolate(nodeEntry, [0, 1], [0.4, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const labelOpacity = clamp01(
            isPast || isActive
              ? 1
              : interpolate(nodeEntry, [0, 1], [0, 0.78], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
          );

          return (
            <div
              key={`${overlay.id}-vox-timeline-ribbon-${index}`}
              style={{
                position: "absolute",
                left: `${leftPercent}%`,
                top: isVertical ? "38%" : "34%",
                transform: "translate(-50%, -50%)",
              }}
            >
              <div
                style={{
                  width: isActive ? 26 : 20,
                  height: isActive ? 26 : 20,
                  borderRadius: "50%",
                  backgroundColor: isActive || event.emphasis ? "#d6a117" : "#f8f3e8",
                  border: isActive
                    ? "3px solid rgba(248, 243, 232, 0.94)"
                    : "2px solid rgba(38, 49, 61, 0.26)",
                  boxShadow: isActive
                    ? "0 0 0 7px rgba(214, 161, 23, 0.16)"
                    : "0 6px 16px rgba(0, 0, 0, 0.1)",
                  transform: `scale(${nodeScale})`,
                  opacity: clamp01(interpolate(nodeEntry, [0, 1], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })),
                }}
              />

              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: isVertical ? 28 : 22,
                  transform: "translateX(-50%)",
                  whiteSpace: "nowrap",
                  padding: "0.26em 0.58em",
                  borderRadius: 999,
                  backgroundColor: isActive ? "rgba(248, 243, 232, 0.98)" : "rgba(248, 243, 232, 0.9)",
                  border: "1px solid rgba(45, 33, 17, 0.08)",
                  color: "#26313d",
                  fontFamily: FONT_STACK_BY_FAMILY.mono,
                  fontSize: `${dateSize}px`,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  opacity: labelOpacity,
                }}
              >
                {event.date}
              </div>

              {(isActive || event.emphasis) && (
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: isVertical ? 24 : 22,
                    transform: "translateX(-50%)",
                    whiteSpace: "nowrap",
                    color: "rgba(36, 46, 58, 0.84)",
                    fontFamily: FONT_STACK_BY_FAMILY.sans,
                    fontSize: `${overlay.fontSize * 0.16}px`,
                    fontWeight: isActive ? 700 : 600,
                    letterSpacing: "-0.02em",
                    opacity: labelOpacity,
                  }}
                >
                  {event.title}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!hasMediaClips ? (
        <div
          style={{
            position: "absolute",
            left: isVertical ? "8%" : "4.4%",
            bottom: isVertical ? "29%" : "27.5%",
            width: isVertical ? "70%" : "32%",
            padding: isVertical ? "0.95em 1em" : "0.92em 0.98em",
            border: "1px dashed rgba(45, 33, 17, 0.24)",
            backgroundColor: "rgba(248, 243, 232, 0.78)",
            color: "#374151",
            boxShadow: "0 18px 38px rgba(0, 0, 0, 0.12)",
          }}
        >
          <div
            style={{
              fontFamily: FONT_STACK_BY_FAMILY.mono,
              fontSize: `${overlay.fontSize * 0.14}px`,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(36, 46, 58, 0.72)",
            }}
          >
            Add Historical Images
          </div>
          <div
            style={{
              marginTop: "0.44em",
              fontFamily: FONT_STACK_BY_FAMILY.sans,
              fontSize: `${overlay.fontSize * 0.2}px`,
              fontWeight: 600,
              lineHeight: 1.22,
            }}
          >
            Upload one image clip per event to turn the ribbon into a documentary chronology.
          </div>
        </div>
      ) : null}
    </div>
  );
};
