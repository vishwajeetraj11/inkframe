import type { CSSProperties } from "react";
import { projectWorldMap } from "@/lib/maps/world";
import type {
  TextOverlayFontFamily,
  TextOverlayStylePreset,
  VersionTimeline,
} from "@/lib/editor/types";
import { REMOTION_FONT_STACKS } from "../fonts";
import {
  AbsoluteFill,
  Img,
  interpolate,
  OffthreadVideo,
  spring,
  staticFile,
  useCurrentFrame,
  Video,
} from "remotion";
import type { MotionTypographyAnimation, RenderMode } from "./types";

export const FONT_STACK_BY_FAMILY: Record<TextOverlayFontFamily, string> = {
  sans: REMOTION_FONT_STACKS.sans,
  serif: REMOTION_FONT_STACKS.serif,
  cursive: REMOTION_FONT_STACKS.condensed,
  mono: REMOTION_FONT_STACKS.mono,
};

export const EDITORIAL_SERIF_STACK = REMOTION_FONT_STACKS.editorialSerif;
export const STAT_RING_HEADLINE_STACK = REMOTION_FONT_STACKS.statRingHeadline;
export const STAT_RING_NUMBER_STACK = REMOTION_FONT_STACKS.statRingNumber;

export const OVERLAY_STYLE_PRESET_LABEL: Record<TextOverlayStylePreset, string> = {
  classic: "classic",
  "impact-grid": "impact-grid",
  "grid-kinetic": "grid-kinetic",
  "hero-slam": "hero-slam",
  "sticker-cutout": "sticker-cutout",
  "editorial-mono": "editorial-mono",
  "vox-explainer": "vox-explainer",
  "vox-timeline": "vox-timeline",
  "vox-timeline-ribbon": "vox-timeline-ribbon",
  "vox-timeline-ledger": "vox-timeline-ledger",
  "vox-typography": "vox-typography",
  "world-map-focus": "world-map-focus",
  "editorial-bar-chart": "editorial-bar-chart",
  "editorial-stat-ring": "editorial-stat-ring",
  "editorial-seat-arc": "editorial-seat-arc",
  "createdaley-opener": "Dictionary Animation",
  "chart-card": "chart-card",
  "news-clipping": "news-clipping",
};

export const NEWS_CRUMPLE_TEXTURE_SRC = staticFile("newsprint-crumple.svg");
export const WORLD_MAP_WIDE = projectWorldMap({
  width: 1180,
  height: 640,
  padding: 34,
});
export const WORLD_MAP_TALL = projectWorldMap({
  width: 860,
  height: 960,
  padding: 46,
});
export const WORLD_MAP_FOCUS_DEFAULT_COUNTRY = "India";

export const MissingAsset = ({ assetId }: { assetId: string }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1a1a1a",
        color: "#f7f7f7",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 36,
        fontWeight: 700,
      }}
    >
      Missing asset: {assetId}
    </AbsoluteFill>
  );
};

export const NewsCrumpleTexture = ({ style }: { style?: CSSProperties }) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        ...style,
      }}
    >
      <Img
        src={NEWS_CRUMPLE_TEXTURE_SRC}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "fill",
        }}
      />
    </div>
  );
};

export const ClipLayer = ({
  clip,
  src,
  durationInFrames,
  fadeInFrames,
  fadeOutFrames,
  renderMode,
}: {
  clip: VersionTimeline["clips"][number];
  src: string;
  durationInFrames: number;
  fadeInFrames: number;
  fadeOutFrames: number;
  renderMode: RenderMode;
}) => {
  const frame = useCurrentFrame();

  const fadeInOpacity =
    fadeInFrames > 0
      ? interpolate(frame, [0, fadeInFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  const fadeOutOpacity =
    fadeOutFrames > 0
      ? interpolate(
          frame,
          [durationInFrames - fadeOutFrames, durationInFrames],
          [1, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        )
      : 1;

  const opacity = Math.max(0, Math.min(1, fadeInOpacity * fadeOutOpacity));

  const mediaProps = {
    src,
    startFrom: clip.trimStartFrame,
    endAt: clip.trimEndFrame,
    volume: clip.volume,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover" as const,
    },
  };

  return (
    <AbsoluteFill style={{ opacity }}>
      {clip.kind === "image" ? (
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : renderMode === "render" ? (
        <OffthreadVideo {...mediaProps} />
      ) : (
        <Video {...mediaProps} />
      )}
    </AbsoluteFill>
  );
};

export const splitOverlayLines = (text: string): string[] => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.length > 0 ? lines : [text.trim()];
};

export const splitOverlayWords = (text: string): string[] => {
  const words = text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
  return words.length > 0 ? words : [text.trim()];
};

export const normalizeGridKineticToken = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

export const splitGridKineticText = (
  text: string,
): {
  stackLines: string[];
  accentLine: string;
} => {
  const lines = splitOverlayLines(text);

  if (lines.length >= 2) {
    return {
      stackLines: lines.slice(0, -1),
      accentLine: lines[lines.length - 1] ?? lines[0],
    };
  }

  const words = splitOverlayWords(text);
  const accentIndex = words.reduce((bestIndex, word, index) => {
    const bestWord = words[bestIndex] ?? "";
    return normalizeGridKineticToken(word).length >
      normalizeGridKineticToken(bestWord).length
      ? index
      : bestIndex;
  }, 0);
  const accentLine = words[accentIndex] ?? words[0] ?? "";
  const stackWords = words.filter((_, index) => index !== accentIndex);

  if (stackWords.length === 0) {
    return {
      stackLines: [],
      accentLine,
    };
  }

  const stackLines =
    stackWords.length <= 2
      ? [stackWords.join(" ")]
      : stackWords.length === 3
        ? [stackWords[0], stackWords.slice(1).join(" ")]
        : [
            stackWords.slice(0, 2).join(" "),
            stackWords.slice(2, 4).join(" "),
            stackWords.slice(4).join(" "),
          ].filter((line) => line.length > 0);

  return {
    stackLines,
    accentLine,
  };
};

const NEWS_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const normalizeNewsWord = (word: string): string =>
  word.toLowerCase().replace(/[^a-z0-9$]/g, "");

const isLikelyDateLine = (line: string): boolean => {
  const normalized = line.trim();
  if (!normalized) {
    return false;
  }

  const monthRegex =
    /\b(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/i;

  return (
    monthRegex.test(normalized) ||
    /^\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?$/.test(normalized)
  );
};

export const getNewsHighlightRange = (
  words: string[],
): { start: number; end: number } | null => {
  if (words.length < 2) {
    return null;
  }

  let bestRange: { start: number; end: number; score: number } | null = null;

  for (let start = 0; start < words.length; start += 1) {
    for (let span = 2; span <= 3; span += 1) {
      const end = start + span;
      if (end > words.length) {
        continue;
      }

      let score = 0;
      let meaningfulWords = 0;

      for (let index = start; index < end; index += 1) {
        const cleaned = normalizeNewsWord(words[index]);
        if (!cleaned) {
          continue;
        }

        const isStopWord = NEWS_STOP_WORDS.has(cleaned);
        if (!isStopWord) {
          meaningfulWords += 1;
          score += Math.min(10, cleaned.length);
        } else {
          score += 0.25;
        }

        if (cleaned.includes("$") || /\d/.test(cleaned)) {
          score += 2;
        }
      }

      if (meaningfulWords === 0) {
        continue;
      }

      if (!bestRange || score > bestRange.score) {
        bestRange = { start, end, score };
      }
    }
  }

  if (!bestRange) {
    return null;
  }

  return {
    start: bestRange.start,
    end: bestRange.end,
  };
};

export const parseNewsPresetText = (
  text: string,
): {
  badge: string;
  headline: string;
  deck: string;
} => {
  const lines = splitOverlayLines(text);
  const fallbackHeadline = lines[0] || "Major headline goes here";

  if (lines.length === 1) {
    return {
      badge: "Breaking",
      headline: fallbackHeadline,
      deck: "",
    };
  }

  const firstLine = lines[0];
  const secondLine = lines[1] || fallbackHeadline;
  const shouldUseFirstLineAsBadge =
    firstLine.length <= 24 || isLikelyDateLine(firstLine);

  if (shouldUseFirstLineAsBadge) {
    return {
      badge: firstLine,
      headline: secondLine,
      deck: lines.slice(2).join(" "),
    };
  }

  return {
    badge: "Breaking",
    headline: firstLine,
    deck: lines.slice(1).join(" "),
  };
};

export const parseVoxExplainerPresetText = (
  text: string,
): {
  kicker: string;
  headline: string;
  deck: string;
  stat: string;
} => {
  const lines = splitOverlayLines(text);
  const fallbackHeadline = lines[0] || "Why this matters";

  if (lines.length === 1) {
    return {
      kicker: "EXPLAINED",
      headline: fallbackHeadline,
      deck: "",
      stat: "",
    };
  }

  return {
    kicker: lines[0] || "EXPLAINED",
    headline: lines[1] || fallbackHeadline,
    deck: lines[2] || "",
    stat: lines.length > 3 ? lines.slice(3).join(" ") : "",
  };
};

export const parseWorldMapFocusPresetText = (
  text: string,
): {
  headline: string;
  subhead: string;
  country: string;
} => {
  const lines = splitOverlayLines(text);
  const headline =
    stripPrefixedValue(lines[0] || "The global story in one frame", "HEADLINE:") ||
    "The global story in one frame";
  const subhead =
    stripPrefixedValue(
      lines[1] ||
        "Use a world atlas to orient the audience before narrowing attention to one country.",
      "SUBHEAD:",
    ) ||
    "Use a world atlas to orient the audience before narrowing attention to one country.";
  const countryLine = lines.find((line) =>
    line.trim().toLowerCase().startsWith("country:"),
  );
  const country = countryLine
    ? stripPrefixedValue(countryLine, "COUNTRY:")
    : WORLD_MAP_FOCUS_DEFAULT_COUNTRY;

  return {
    headline,
    subhead,
    country: country || WORLD_MAP_FOCUS_DEFAULT_COUNTRY,
  };
};

interface EditorialBarChartRow {
  label: string;
  value: number;
  color: string;
}

const EDITORIAL_BAR_CHART_FALLBACK_ROWS: EditorialBarChartRow[] = [
  { label: "JAN", value: 28, color: "#d8de4e" },
  { label: "FEB", value: 60, color: "#d8de4e" },
  { label: "MAR", value: 70, color: "#d8de4e" },
  { label: "APR", value: 75, color: "#d8de4e" },
  { label: "MAY", value: 45, color: "#d8de4e" },
  { label: "JUNE", value: 20, color: "#d8de4e" },
  { label: "JULY", value: 83, color: "#d8de4e" },
  { label: "AUG", value: 64, color: "#d8de4e" },
  { label: "SEPT", value: 95, color: "#d8de4e" },
  { label: "OCT", value: 78, color: "#d8de4e" },
  { label: "NOV", value: 55, color: "#d8de4e" },
  { label: "DEC", value: 68, color: "#d8de4e" },
];

export const parseEditorialBarChartPresetText = (
  text: string,
): {
  headline: string;
  subhead: string;
  rows: EditorialBarChartRow[];
} => {
  const lines = splitOverlayLines(text);
  const headline =
    stripPrefixedValue(lines[0] || "The rise and fall of energy costs", "HEADLINE:") ||
    "The rise and fall of energy costs";
  const subhead =
    stripPrefixedValue(
      lines[1] ||
        "Monthly averages illustrate how electricity prices moved between highs and lows.",
      "SUBHEAD:",
    ) ||
    "Monthly averages illustrate how electricity prices moved between highs and lows.";

  const rows = lines
    .slice(2)
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      if (parts.length < 2) {
        return null;
      }

      const label = parts[0];
      const value = Number.parseFloat(parts[1] || "");
      const colorRaw = parts[2] || "";
      const color = /^#([A-Fa-f0-9]{6})$/.test(colorRaw) ? colorRaw : "#d8de4e";

      if (!label || !Number.isFinite(value)) {
        return null;
      }

      return {
        label,
        value: clampRange(value, 0, 100),
        color,
      } satisfies EditorialBarChartRow;
    })
    .filter((row): row is EditorialBarChartRow => row !== null);

  return {
    headline,
    subhead,
    rows:
      rows.length >= 3
        ? rows
        : EDITORIAL_BAR_CHART_FALLBACK_ROWS.map((row) => ({ ...row })),
  };
};

export const clampRange = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const stripPrefixedValue = (line: string, prefix: string): string => {
  const normalizedLine = line.trim();
  const normalizedPrefix = prefix.toLowerCase();
  if (normalizedLine.toLowerCase().startsWith(normalizedPrefix)) {
    return normalizedLine.slice(prefix.length).trim();
  }

  return normalizedLine;
};

export const chunkWords = (words: string[], size: number): string[][] => {
  const chunks: string[][] = [];

  for (let index = 0; index < words.length; index += size) {
    chunks.push(words.slice(index, index + size));
  }

  return chunks;
};

interface ChartCardRow {
  label: string;
  value: number;
  color: string;
}

interface ChartCardSlice extends ChartCardRow {
  startAngle: number;
  endAngle: number;
  startProgress: number;
  endProgress: number;
}

export const getChartCardSlices = (rows: ChartCardRow[]): ChartCardSlice[] => {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  let cumulative = 0;

  return rows.map((row) => {
    const portion = total > 0 ? row.value / total : 0;
    const startProgress = cumulative;
    const endProgress = cumulative + portion;
    const startAngle = -90 + startProgress * 360;
    const endAngle = -90 + endProgress * 360;
    cumulative = endProgress;

    return {
      ...row,
      startAngle,
      endAngle,
      startProgress,
      endProgress,
    };
  });
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

export const describePieSlicePath = (
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string => {
  const sweep = endAngle - startAngle;
  if (sweep <= 0.1) {
    return "";
  }

  const start = polarToCartesian(centerX, centerY, radius, startAngle);
  const end = polarToCartesian(centerX, centerY, radius, endAngle);
  const largeArcFlag = sweep > 180 ? 1 : 0;

  return [
    `M ${centerX} ${centerY}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
};

export const getAnimatedSliceAngles = (
  slice: ChartCardSlice,
  progress: number,
): { startAngle: number; endAngle: number } | null => {
  if (progress <= 0) {
    return null;
  }

  const clampedProgress = clamp01(progress);
  const seamAngle = -90;

  const animatedStartAngle =
    seamAngle + (slice.startAngle - seamAngle) * clampedProgress;
  let animatedEndAngle =
    seamAngle + (slice.endAngle - seamAngle) * clampedProgress;
  const minimumSpan =
    clampedProgress < 0.28
      ? interpolate(clampedProgress, [0, 0.28], [2.4, 0], {
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

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

type CreatedaleyEdgeSide = "left" | "right";

const CREATEDALEY_TORN_EDGE_STEPS = Array.from(
  { length: 29 },
  (_, index) => Math.round((index / 28) * 100),
);

export const CREATEDALEY_EDGE_SIDES: readonly CreatedaleyEdgeSide[] = [
  "left",
  "right",
] as const;

const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));

const getCreatedaleyTearOffset = (
  y: number,
  side: CreatedaleyEdgeSide,
  progress: number,
): number => {
  const normalized = y / 100;
  const phase = side === "left" ? 0.82 : 1.74;
  const major = Math.sin(normalized * 8.4 + phase) * 1.34;
  const minor = Math.sin(normalized * 19.7 + phase * 1.6) * 0.52;
  const micro = Math.cos(normalized * 33.5 + phase * 2.1) * 0.24;
  const notchUpper =
    Math.max(0, 1 - Math.abs(normalized - 0.16) / 0.055) *
    (side === "left" ? -1.08 : 1.02);
  const notchMiddle =
    Math.max(0, 1 - Math.abs(normalized - 0.57) / 0.085) *
    (side === "left" ? 1.42 : -1.48);
  const notchLower =
    Math.max(0, 1 - Math.abs(normalized - 0.83) / 0.05) *
    (side === "left" ? -0.82 : 0.76);
  const amplitude = interpolate(clamp01(progress), [0, 0.3, 1], [0.64, 0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (major + minor + micro + notchUpper + notchMiddle + notchLower) * amplitude;
};

export const getCreatedaleyPaperBounds = (
  progress: number,
): { left: number; right: number; halfWidth: number } => {
  const halfWidth = interpolate(progress, [0, 0.76, 1], [7.2, 45.6, 49.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return {
    left: 50 - halfWidth,
    right: 50 + halfWidth,
    halfWidth,
  };
};

export const getCreatedaleyPaperClipPath = (progress: number): string => {
  const { left, right } = getCreatedaleyPaperBounds(progress);
  const leftPoints = CREATEDALEY_TORN_EDGE_STEPS.map(
    (y) =>
      `${clampPercent(left + getCreatedaleyTearOffset(y, "left", progress))}% ${y}%`,
  );
  const rightPoints = [...CREATEDALEY_TORN_EDGE_STEPS]
    .reverse()
    .map(
      (y) =>
        `${clampPercent(right + getCreatedaleyTearOffset(y, "right", progress))}% ${y}%`,
    );

  return `polygon(${[...leftPoints, ...rightPoints].join(", ")})`;
};

export const getCreatedaleyEdgeBandClipPath = (side: CreatedaleyEdgeSide): string => {
  const boundaryBase = side === "left" ? 70 : 30;
  const raggedPoints = CREATEDALEY_TORN_EDGE_STEPS.map((y) => {
    const x = boundaryBase + getCreatedaleyTearOffset(y, side, 1) * 6.8;
    return `${clampPercent(x)}% ${y}%`;
  });

  return side === "left"
    ? `polygon(0 0, ${raggedPoints.join(", ")}, 0 100%)`
    : `polygon(100% 0, ${raggedPoints.join(", ")}, 100% 100%)`;
};

export const getRevealClipPath = (progress: number, lead = 0): string => {
  const reveal = clamp01(progress + lead);
  return `inset(0 ${Math.round((1 - reveal) * 100)}% 0 0)`;
};

export const getRevealSweepLeft = (progress: number, widthPercent: number): string =>
  `${interpolate(clamp01(progress), [0, 1], [-widthPercent, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })}%`;

export const getBaseTypographyAnimation = (
  frame: number,
  safeDuration: number,
): MotionTypographyAnimation => {
  const introFrames = Math.min(
    18,
    Math.max(8, Math.round(safeDuration * 0.22)),
  );
  const outroFrames = Math.min(14, Math.max(6, Math.round(safeDuration * 0.2)));
  const outroStart = Math.max(introFrames + 1, safeDuration - outroFrames);

  const entry = spring({
    frame,
    fps: 30,
    config: {
      damping: 200,
      stiffness: 180,
      mass: 0.8,
    },
  });

  const entryOpacity = interpolate(entry, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitProgress = interpolate(frame, [outroStart, safeDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return {
    baseOpacity: clamp01(
      entryOpacity *
        interpolate(exitProgress, [0, 1], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
    ),
    baseTranslateY:
      interpolate(entry, [0, 1], [34, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }) +
      Math.sin(frame / 18) * 1.4,
    baseScale:
      interpolate(entry, [0, 1], [0.9, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }) *
      interpolate(exitProgress, [0, 1], [1, 1.04], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    baseRotate: interpolate(entry, [0, 1], [1.8, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    blur: interpolate(exitProgress, [0, 1], [0, 6], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  };
};
