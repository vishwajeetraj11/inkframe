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

const getTimelineBounds = (isVertical: boolean) =>
  isVertical
    ? {
        startX: 14,
        endX: 14,
        startY: 33,
        endY: 84,
      }
    : {
        startX: 12,
        endX: 88,
        startY: 80,
        endY: 80,
      };

const getNodePosition = (
  index: number,
  total: number,
  isVertical: boolean,
): { x: number; y: number } => {
  const bounds = getTimelineBounds(isVertical);
  const progress = total <= 1 ? 0.5 : index / Math.max(1, total - 1);

  return {
    x: interpolate(progress, [0, 1], [bounds.startX, bounds.endX], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    y: interpolate(progress, [0, 1], [bounds.startY, bounds.endY], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  };
};

export const renderVoxTimelinePreset = ({
  overlay,
  frame,
  safeDuration,
  animation,
  aspect,
  hasMediaClips,
}: PresetRendererProps) => {
  const { kicker, headline, events } = parseVoxTimelineText(overlay.text);
  const isVertical = aspect === "reel_9_16";
  const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
  const entry = spring({
    frame,
    fps: 30,
    config: {
      damping: 165,
      stiffness: 210,
      mass: 0.92,
    },
  });
  const introFrames = Math.min(42, Math.max(24, Math.round(safeDuration * 0.18)));
  const outroFrames = Math.min(18, Math.max(10, Math.round(safeDuration * 0.1)));
  const eventWindow = Math.max(1, safeDuration - introFrames - outroFrames);
  const segmentFrames = eventWindow / Math.max(1, events.length);
  const activeIndex = Math.min(
    events.length - 1,
    Math.max(0, Math.floor(Math.max(0, frame - introFrames) / Math.max(1, segmentFrames))),
  );
  const activeEvent = events[activeIndex] ?? events[0];
  const activeCardStart = introFrames + segmentFrames * activeIndex;
  const activeCardEntry = spring({
    frame: frame - activeCardStart,
    fps: 30,
    config: {
      damping: 180,
      stiffness: 240,
      mass: 0.94,
    },
  });
  const lineReveal = interpolate(frame, [10, introFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const headlineReveal = interpolate(frame, [8, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const headerScale = interpolate(entry, [0, 1], [0.985, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wrapperOpacity = animation.baseOpacity;
  const wrapperScale = animation.baseScale;
  const wrapperTranslateY = animation.baseTranslateY * 0.08;
  const wrapperBlur = animation.blur * 0.18;
  const headerWidth = isVertical ? "77%" : "39%";
  const headerLeft = isVertical ? "13%" : "4.2%";
  const headerTop = isVertical ? "5.4%" : "6.5%";
  const activeCardLayout = isVertical
    ? {
        left: "10%",
        right: "10%",
        bottom: "8.8%",
        width: "80%",
      }
    : {
        left: "58%",
        right: "4.4%",
        bottom: "6.2%",
        width: "37.6%",
      };
  const placeholderLayout = isVertical
    ? {
        left: "12%",
        top: "36%",
        width: "76%",
      }
    : {
        left: "57%",
        top: "28%",
        width: "38%",
      };
  const headlineSize = overlay.fontSize * (isVertical ? 0.62 : 0.58);
  const activeTitleSize = overlay.fontSize * (isVertical ? 0.46 : 0.42);
  const activeCaptionSize = overlay.fontSize * 0.21;
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
                "linear-gradient(180deg, rgba(8, 9, 10, 0.56) 0%, rgba(8, 9, 10, 0.12) 24%, rgba(8, 9, 10, 0.06) 42%, rgba(8, 9, 10, 0.14) 58%, rgba(8, 9, 10, 0.64) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 50% 50%, rgba(15, 11, 8, 0) 46%, rgba(15, 11, 8, 0.32) 100%)",
            }}
          />
        </>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: headerLeft,
          top: headerTop,
          width: headerWidth,
          border: "1px solid rgba(45, 33, 17, 0.16)",
          background: "rgba(248, 243, 232, 0.94)",
          boxShadow: "0 20px 46px rgba(0, 0, 0, 0.26)",
          overflow: "hidden",
          transform: `scale(${headerScale})`,
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
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 16% 18%, rgba(255,255,255,0.7), rgba(255,255,255,0) 30%)," +
              "radial-gradient(circle at 88% 22%, rgba(214, 161, 23, 0.16), rgba(214, 161, 23, 0) 26%)," +
              "repeating-linear-gradient(0deg, rgba(76, 58, 24, 0.04) 0 1px, transparent 1px 74px)," +
              "repeating-linear-gradient(90deg, rgba(76, 58, 24, 0.04) 0 1px, transparent 1px 94px)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "grid",
            gridTemplateColumns: "14px 1fr",
          }}
        >
          <div style={{ backgroundColor: "#d6a117" }} />

          <div style={{ padding: isVertical ? "1.05em 1.05em 1.08em" : "1em 1.12em 1.04em" }}>
            <div
              style={{
                display: "inline-block",
                clipPath: getRevealClipPath(headlineReveal),
                color: "rgba(36, 46, 58, 0.8)",
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
                clipPath: getRevealClipPath(headlineReveal, 0.08),
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
      </div>

      <div
        style={{
          position: "absolute",
          left: isVertical ? "13.2%" : "12%",
          right: isVertical ? "auto" : "12%",
          top: isVertical ? "33%" : "auto",
          bottom: isVertical ? "16.5%" : "18%",
          width: isVertical ? 4 : "76%",
          height: isVertical ? "51%" : 4,
          borderRadius: 999,
          backgroundColor: "rgba(247, 241, 231, 0.26)",
          transformOrigin: isVertical ? "center top" : "left center",
          transform: isVertical
            ? `scaleY(${lineReveal})`
            : `scaleX(${lineReveal})`,
          boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.08)",
        }}
      />

      {events.map((event, index) => {
        const position = getNodePosition(index, events.length, isVertical);
        const eventStart = introFrames + segmentFrames * index;
        const nodeEntry = spring({
          frame: frame - eventStart,
          fps: 30,
          config: {
            damping: 170,
            stiffness: 260,
            mass: 0.9,
          },
        });
        const nodeScale = interpolate(nodeEntry, [0, 1], [0.4, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const nodeOpacity = interpolate(nodeEntry, [0, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const isActive = index === activeIndex;
        const isPast = index < activeIndex;
        const labelReveal = clamp01(
          isPast || isActive
            ? 1
            : interpolate(nodeEntry, [0, 1], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
        );
        const labelOpacity = clamp01(
          interpolate(labelReveal, [0, 1], [0, isActive ? 1 : isPast ? 0.84 : 0.72], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        );
        const labelTranslateY = interpolate(labelReveal, [0, 1], [8, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={`${overlay.id}-vox-timeline-node-${index}`}
            style={{
              position: "absolute",
              left: `${position.x}%`,
              top: `${position.y}%`,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: isActive ? 30 : 22,
                height: isActive ? 30 : 22,
                borderRadius: "50%",
                backgroundColor: isActive || event.emphasis ? "#d6a117" : "rgba(248, 243, 232, 0.94)",
                border: isActive
                  ? "3px solid rgba(248, 243, 232, 0.92)"
                  : "2px solid rgba(248, 243, 232, 0.78)",
                boxShadow: isActive
                  ? "0 0 0 7px rgba(214, 161, 23, 0.16)"
                  : "0 4px 10px rgba(0, 0, 0, 0.14)",
                opacity: nodeOpacity,
                transform: `scale(${nodeScale})`,
              }}
            />

            <div
              style={{
                position: "absolute",
                left: isVertical ? 22 : "50%",
                top: isVertical ? "50%" : 26,
                minWidth: isVertical ? 0 : 84,
                padding: "0.38em 0.6em",
                borderRadius: 999,
                backgroundColor: isActive
                  ? "rgba(248, 243, 232, 0.98)"
                  : "rgba(248, 243, 232, 0.92)",
                border: "1px solid rgba(45, 33, 17, 0.08)",
                color: "#26313d",
                fontFamily: FONT_STACK_BY_FAMILY.mono,
                fontSize: `${dateSize}px`,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textAlign: "center",
                whiteSpace: "nowrap",
                boxShadow: "0 1px 0 rgba(45, 33, 17, 0.05)",
                opacity: labelOpacity,
                transform: `${isVertical ? "translateY(-50%)" : "translateX(-50%)"} translateY(${labelTranslateY}px)`,
              }}
            >
              {event.date}
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: activeCardLayout.left,
          right: activeCardLayout.right,
          bottom: activeCardLayout.bottom,
          width: activeCardLayout.width,
          border: activeEvent.emphasis
            ? "1px solid rgba(214, 161, 23, 0.34)"
            : "1px solid rgba(45, 33, 17, 0.14)",
          backgroundColor: "rgba(248, 243, 232, 0.95)",
          boxShadow: "0 22px 56px rgba(0, 0, 0, 0.28)",
          overflow: "hidden",
          opacity: interpolate(activeCardEntry, [0, 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          transform: `translateY(${interpolate(activeCardEntry, [0, 1], [18, 0], {
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
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 12% 18%, rgba(255,255,255,0.72), rgba(255,255,255,0) 26%)," +
              "radial-gradient(circle at 88% 22%, rgba(214, 161, 23, 0.12), rgba(214, 161, 23, 0) 24%)," +
              "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.02))",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "grid",
            gridTemplateColumns: "14px 1fr",
          }}
        >
          <div style={{ backgroundColor: activeEvent.emphasis ? "#d6a117" : "#d1c5ae" }} />

          <div style={{ padding: isVertical ? "1em 1em 1.06em" : "0.96em 1em 1.04em" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.26em 0.6em",
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
                marginTop: "0.34em",
                color: overlay.color,
                fontFamily: FONT_STACK_BY_FAMILY.sans,
                fontSize: `${activeTitleSize}px`,
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
                marginTop: "0.66em",
                color: "rgba(31, 41, 55, 0.84)",
                fontFamily: FONT_STACK_BY_FAMILY.sans,
                fontSize: `${activeCaptionSize}px`,
                fontWeight: 500,
                lineHeight: 1.22,
                maxWidth: "96%",
                textWrap: "pretty",
              }}
            >
              {activeEvent.caption}
            </div>
          </div>
        </div>
      </div>

      {!hasMediaClips ? (
        <div
          style={{
            position: "absolute",
            left: placeholderLayout.left,
            top: placeholderLayout.top,
            width: placeholderLayout.width,
            padding: isVertical ? "1.05em" : "1em 1.08em",
            border: "1px dashed rgba(45, 33, 17, 0.28)",
            backgroundColor: "rgba(248, 243, 232, 0.78)",
            color: "#374151",
            boxShadow: "0 20px 42px rgba(0, 0, 0, 0.12)",
          }}
        >
          <div
            style={{
              fontFamily: FONT_STACK_BY_FAMILY.mono,
              fontSize: `${overlay.fontSize * 0.15}px`,
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
              fontSize: `${overlay.fontSize * 0.22}px`,
              fontWeight: 600,
              lineHeight: 1.22,
            }}
          >
            Upload one image clip per event in chronological order to turn this into an archival timeline.
          </div>
        </div>
      ) : null}
    </div>
  );
};
