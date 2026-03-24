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

export const renderVoxTimelineLedgerPreset = ({
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
  const activeCardStart =
    hasMediaClips && activeMediaClipStartFrame !== undefined
      ? Math.max(introFrames, activeMediaClipStartFrame)
      : introFrames + segmentFrames * activeIndex;
  const entry = spring({
    frame,
    fps: 30,
    config: {
      damping: 172,
      stiffness: 220,
      mass: 0.94,
    },
  });
  const headerReveal = interpolate(frame, [5, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const headerTextReveal = interpolate(frame, [10, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const summaryReveal = interpolate(frame, [12, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const ledgerReveal = interpolate(frame, [14, introFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const activeCardEntry = spring({
    frame: frame - activeCardStart,
    fps: 30,
    config: {
      damping: 186,
      stiffness: 238,
      mass: 0.92,
    },
  });
  const activeCardReveal = clamp01(
    interpolate(activeCardEntry, [0, 1], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const activeSpinePercent = Math.max(
    8,
    (((activeIndex + activeCardReveal) / Math.max(1, events.length)) * 94),
  );
  const wrapperOpacity = animation.baseOpacity;
  const wrapperScale = animation.baseScale;
  const wrapperTranslateY = animation.baseTranslateY * 0.08;
  const wrapperBlur = animation.blur * 0.16;
  const paperLayout = isVertical
    ? {
        left: "7.5%",
        right: "7.5%",
        top: "7%",
        bottom: "6.2%",
        width: "85%",
      }
    : {
        left: "4.4%",
        right: "4.4%",
        top: "7.2%",
        bottom: "7.2%",
        width: "91.2%",
      };
  const summaryWidth = isVertical ? "100%" : "35%";
  const ledgerWidth = isVertical ? "100%" : "61%";
  const headlineSize = overlay.fontSize * (isVertical ? 0.55 : 0.48);
  const activeDateSize = overlay.fontSize * (isVertical ? 0.8 : 0.9);
  const activeTitleSize = overlay.fontSize * (isVertical ? 0.4 : 0.38);
  const activeCaptionSize = overlay.fontSize * 0.2;
  const rowTitleSize = overlay.fontSize * (isVertical ? 0.19 : 0.18);
  const rowCaptionSize = overlay.fontSize * 0.15;
  const rowDateSize = overlay.fontSize * 0.14;
  const firstEventDate = events[0]?.date ?? activeEvent.date;
  const lastEventDate = events[events.length - 1]?.date ?? activeEvent.date;
  const timelineRangeLabel =
    firstEventDate === lastEventDate
      ? firstEventDate
      : `${firstEventDate} - ${lastEventDate}`;
  const activeEventProgressLabel = `${String(activeIndex + 1).padStart(2, "0")} / ${String(
    events.length,
  ).padStart(2, "0")}`;
  const summaryMetrics = [
    { label: "Span", value: timelineRangeLabel },
    { label: "Events", value: String(events.length) },
    { label: "Active", value: activeEventProgressLabel },
  ];

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
                "linear-gradient(180deg, rgba(9, 10, 12, 0.62) 0%, rgba(9, 10, 12, 0.18) 28%, rgba(9, 10, 12, 0.1) 52%, rgba(9, 10, 12, 0.58) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 18% 16%, rgba(255,255,255,0.14), rgba(255,255,255,0) 24%), radial-gradient(circle at 82% 78%, rgba(214,161,23,0.12), rgba(214,161,23,0) 30%)",
            }}
          />
        </>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: paperLayout.left,
          right: paperLayout.right,
          top: paperLayout.top,
          bottom: paperLayout.bottom,
          width: paperLayout.width,
          border: "1px solid rgba(45, 33, 17, 0.14)",
          background: "rgba(248, 243, 232, 0.95)",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.3)",
          overflow: "hidden",
          clipPath: getRevealClipPath(headerReveal),
          transform: `scale(${interpolate(entry, [0, 1], [0.986, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })})`,
          transformOrigin: "center center",
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
            inset: 0,
            background:
              "radial-gradient(circle at 14% 12%, rgba(255,255,255,0.76), rgba(255,255,255,0) 24%)," +
              "repeating-linear-gradient(0deg, rgba(76, 58, 24, 0.04) 0 1px, transparent 1px 72px)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "grid",
            gridTemplateColumns: isVertical ? "1fr" : `${summaryWidth} ${ledgerWidth}`,
            gap: isVertical ? "1.08em" : "1.18em",
            padding: isVertical ? "1.05em 1em" : "1.12em 1.12em 1.08em",
            height: "100%",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: isVertical ? "flex-start" : "space-between",
              gap: isVertical ? "0.78em" : "0.96em",
              minWidth: 0,
              opacity: interpolate(summaryReveal, [0, 1], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${interpolate(summaryReveal, [0, 1], [18, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px)`,
            }}
          >
            <div>
              <div
                style={{
                  clipPath: getRevealClipPath(headerTextReveal),
                  color: "rgba(36, 46, 58, 0.82)",
                  fontFamily: FONT_STACK_BY_FAMILY.mono,
                  fontSize: `${overlay.fontSize * 0.17}px`,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  opacity: interpolate(headerTextReveal, [0, 1], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                {kicker}
              </div>

              <div
                style={{
                  marginTop: "0.42em",
                  clipPath: getRevealClipPath(headerTextReveal, 0.08),
                  color: overlay.color,
                  fontFamily: EDITORIAL_SERIF_STACK,
                  fontSize: `${headlineSize}px`,
                  fontWeight: 700,
                  lineHeight: 0.94,
                  letterSpacing: "-0.04em",
                  textWrap: "balance",
                  transform: `translateY(${interpolate(headerTextReveal, [0, 1], [16, 0], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}px)`,
                }}
              >
                {headline}
              </div>
            </div>

            <div
              style={{
                padding: isVertical ? "0.72em 0.8em 0.78em" : "0.76em 0.86em 0.82em",
                border: "1px solid rgba(45, 33, 17, 0.1)",
                background: "rgba(255, 255, 255, 0.46)",
                opacity: interpolate(summaryReveal, [0, 1], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                clipPath: getRevealClipPath(summaryReveal, 0.04),
                transform: `translateY(${interpolate(summaryReveal, [0, 1], [14, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })}px)`,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "0.66em",
                }}
              >
                {summaryMetrics.map((metric) => (
                  <div key={`${overlay.id}-${metric.label}`}>
                    <div
                      style={{
                        color: "rgba(36, 46, 58, 0.62)",
                        fontFamily: FONT_STACK_BY_FAMILY.mono,
                        fontSize: `${overlay.fontSize * 0.12}px`,
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                      }}
                    >
                      {metric.label}
                    </div>
                    <div
                      style={{
                        marginTop: "0.26em",
                        color: overlay.color,
                        fontFamily: metric.label === "Span" ? EDITORIAL_SERIF_STACK : FONT_STACK_BY_FAMILY.sans,
                        fontSize: `${overlay.fontSize * (metric.label === "Span" ? 0.2 : 0.22)}px`,
                        fontWeight: metric.label === "Span" ? 700 : 800,
                        lineHeight: 1,
                        letterSpacing: metric.label === "Span" ? "-0.03em" : "-0.02em",
                      }}
                    >
                      {metric.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                position: "relative",
                padding: isVertical ? "0.94em 0.94em 0.98em" : "0.98em 1em 1.02em",
                border: activeEvent.emphasis
                  ? "1px solid rgba(214, 161, 23, 0.36)"
                  : "1px solid rgba(45, 33, 17, 0.12)",
                background: activeEvent.emphasis
                  ? "linear-gradient(180deg, rgba(255, 248, 225, 0.96), rgba(248, 243, 232, 0.96))"
                  : "rgba(252, 249, 242, 0.9)",
                boxShadow: "0 16px 36px rgba(0, 0, 0, 0.14)",
                overflow: "hidden",
                opacity: interpolate(activeCardReveal, [0, 1], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                clipPath: getRevealClipPath(activeCardReveal),
                transform: `translateY(${interpolate(activeCardReveal, [0, 1], [22, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })}px) scale(${interpolate(activeCardReveal, [0, 1], [0.97, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })})`,
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
                    ? "rgba(214, 161, 23, 0.26)"
                    : "rgba(38, 49, 61, 0.08)",
                  color: "#26313d",
                  fontFamily: FONT_STACK_BY_FAMILY.mono,
                  fontSize: `${overlay.fontSize * 0.16}px`,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  opacity: interpolate(activeCardReveal, [0, 1], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                Active Event
              </div>

              <div
                style={{
                  marginTop: "0.36em",
                  color: "#a96c0a",
                  fontFamily: FONT_STACK_BY_FAMILY.mono,
                  fontSize: `${activeDateSize}px`,
                  fontWeight: 700,
                  lineHeight: 0.92,
                  letterSpacing: "-0.05em",
                  clipPath: getRevealClipPath(activeCardReveal, 0.03),
                }}
              >
                {activeEvent.date}
              </div>

              <div
                style={{
                  marginTop: "0.18em",
                  color: overlay.color,
                  fontFamily: FONT_STACK_BY_FAMILY.sans,
                  fontSize: `${activeTitleSize}px`,
                  fontWeight: 900,
                  lineHeight: 0.94,
                  letterSpacing: "-0.04em",
                  textWrap: "balance",
                  clipPath: getRevealClipPath(activeCardReveal, 0.08),
                }}
              >
                {activeEvent.title}
              </div>

              <div
                style={{
                  marginTop: "0.58em",
                  color: "rgba(31, 41, 55, 0.82)",
                  fontFamily: FONT_STACK_BY_FAMILY.sans,
                  fontSize: `${activeCaptionSize}px`,
                  fontWeight: 500,
                  lineHeight: 1.24,
                  textWrap: "pretty",
                  clipPath: getRevealClipPath(activeCardReveal, 0.14),
                }}
              >
                {activeEvent.caption}
              </div>
            </div>

            {!hasMediaClips ? (
              <div
                style={{
                  padding: "0.82em 0.88em",
                  border: "1px dashed rgba(45, 33, 17, 0.2)",
                  backgroundColor: "rgba(255, 255, 255, 0.52)",
                  color: "#374151",
                  opacity: interpolate(summaryReveal, [0, 1], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                  transform: `translateY(${interpolate(summaryReveal, [0, 1], [14, 0], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}px)`,
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_STACK_BY_FAMILY.mono,
                    fontSize: `${overlay.fontSize * 0.13}px`,
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
                    marginTop: "0.4em",
                    fontFamily: FONT_STACK_BY_FAMILY.sans,
                    fontSize: `${overlay.fontSize * 0.18}px`,
                    fontWeight: 600,
                    lineHeight: 1.22,
                  }}
                >
                  Upload one image clip per event to turn the ledger into a full archival storyboard.
                </div>
              </div>
            ) : null}
          </div>

          <div
            style={{
              position: "relative",
              minWidth: 0,
              paddingLeft: isVertical ? 0 : "0.68em",
              opacity: interpolate(ledgerReveal, [0, 1], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${interpolate(ledgerReveal, [0, 1], [24, 0], {
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
                marginLeft: isVertical ? 26 : 16,
                marginBottom: isVertical ? "0.54em" : "0.44em",
                paddingRight: isVertical ? 2 : 0,
              }}
            >
              <div
                style={{
                  color: "rgba(36, 46, 58, 0.76)",
                  fontFamily: FONT_STACK_BY_FAMILY.mono,
                  fontSize: `${overlay.fontSize * 0.13}px`,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Chronology
              </div>

              <div
                style={{
                  color: "#a96c0a",
                  fontFamily: FONT_STACK_BY_FAMILY.mono,
                  fontSize: `${overlay.fontSize * 0.12}px`,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {activeEventProgressLabel}
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                left: isVertical ? 12 : 0,
                top: isVertical ? 26 : 6,
                bottom: 6,
                width: 3,
                borderRadius: 999,
                backgroundColor: "rgba(38, 49, 61, 0.14)",
                transformOrigin: "center top",
                transform: `scaleY(${ledgerReveal})`,
              }}
            />

            <div
              style={{
                position: "absolute",
                left: isVertical ? 12 : 0,
                top: isVertical ? 26 : 6,
                height: `${activeSpinePercent}%`,
                width: 3,
                borderRadius: 999,
                background:
                  "linear-gradient(180deg, rgba(214, 161, 23, 0.9), rgba(214, 161, 23, 0.36))",
                transformOrigin: "center top",
                transform: `scaleY(${ledgerReveal})`,
              }}
            />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.54em",
                height: "100%",
                justifyContent: isVertical ? "flex-start" : "center",
              }}
            >
              {events.map((event, index) => {
                const eventStart = introFrames + segmentFrames * index;
                const rowEntry = spring({
                  frame: frame - eventStart,
                  fps: 30,
                  config: {
                    damping: 180,
                    stiffness: 255,
                    mass: 0.9,
                  },
                });
                const isActive = index === activeIndex;
                const isPast = index < activeIndex;
                const reveal = clamp01(
                  interpolate(rowEntry, [0, 1], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                );
                const markerScale = interpolate(reveal, [0, 1], [0.4, isActive ? 1.08 : 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });

                return (
                  <div
                    key={`${overlay.id}-vox-timeline-ledger-${index}`}
                    style={{
                      position: "relative",
                      marginLeft: isVertical ? 26 : 16,
                      padding: isVertical ? "0.7em 0.76em" : "0.68em 0.74em",
                      border: isActive
                        ? "1px solid rgba(214, 161, 23, 0.34)"
                        : "1px solid rgba(45, 33, 17, 0.08)",
                      background: isActive
                        ? "rgba(255, 249, 232, 0.98)"
                        : "rgba(255, 255, 255, 0.52)",
                      boxShadow: isActive
                        ? "0 16px 32px rgba(0, 0, 0, 0.14)"
                        : "0 6px 16px rgba(0, 0, 0, 0.06)",
                      opacity: interpolate(reveal, [0, 1], [0, isActive ? 1 : isPast ? 0.9 : 0.76], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      }),
                      transform: `translateY(${interpolate(reveal, [0, 1], [18, 0], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      })}px) scale(${interpolate(reveal, [0, 1], [0.98, isActive ? 1.01 : 1], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      })})`,
                      clipPath: getRevealClipPath(reveal),
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: isVertical ? -20 : -18,
                        top: "50%",
                        width: isActive ? 18 : 14,
                        height: isActive ? 18 : 14,
                        borderRadius: "50%",
                        backgroundColor: isActive || event.emphasis ? "#d6a117" : "#f8f3e8",
                        border: isActive
                          ? "3px solid rgba(248, 243, 232, 0.94)"
                          : "2px solid rgba(38, 49, 61, 0.22)",
                        boxShadow: isActive
                          ? "0 0 0 6px rgba(214, 161, 23, 0.14)"
                          : "0 4px 10px rgba(0, 0, 0, 0.08)",
                        opacity: interpolate(reveal, [0, 1], [0, 1], {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                        }),
                        transform: `translateY(-50%) scale(${markerScale})`,
                      }}
                    />

                    <div
                      style={{
                        color: isActive ? "#a96c0a" : "rgba(36, 46, 58, 0.72)",
                        fontFamily: FONT_STACK_BY_FAMILY.mono,
                        fontSize: `${rowDateSize}px`,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        clipPath: getRevealClipPath(reveal, 0.04),
                      }}
                    >
                      {event.date}
                    </div>

                    <div
                      style={{
                        marginTop: "0.18em",
                        color: overlay.color,
                        fontFamily: FONT_STACK_BY_FAMILY.sans,
                        fontSize: `${rowTitleSize}px`,
                        fontWeight: isActive ? 900 : 700,
                        lineHeight: 1.04,
                        letterSpacing: "-0.03em",
                        clipPath: getRevealClipPath(reveal, 0.08),
                      }}
                    >
                      {event.title}
                    </div>

                    <div
                      style={{
                        marginTop: "0.26em",
                        color: "rgba(31, 41, 55, 0.76)",
                        fontFamily: FONT_STACK_BY_FAMILY.sans,
                        fontSize: `${rowCaptionSize}px`,
                        fontWeight: 500,
                        lineHeight: 1.22,
                        clipPath: getRevealClipPath(reveal, 0.14),
                      }}
                    >
                      {event.caption}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
