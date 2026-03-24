export interface ParsedEditorialStatRingText {
  headline: string;
  highlight: string | null;
  subhead: string;
  value: number;
  suffix: string;
  color: string;
}

export const EDITORIAL_STAT_RING_DEFAULT_HEADLINE =
  "Most of our ocean remains unexplored";
export const EDITORIAL_STAT_RING_DEFAULT_SUBHEAD =
  "NOAA says humans have explored only about 5% of the ocean, leaving 95% still unexplored.";
export const EDITORIAL_STAT_RING_DEFAULT_VALUE = 95;
export const EDITORIAL_STAT_RING_DEFAULT_SUFFIX = "%";
export const EDITORIAL_STAT_RING_DEFAULT_COLOR = "#ef5a29";

const splitOverlayLines = (text: string): string[] => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.length > 0 ? lines : [text.trim()];
};

const stripHighlightMarkup = (headline: string): string =>
  headline.replace(/\[\[/g, "").replace(/\]\]/g, "").replace(/\s+/g, " ").trim();

const isHexColor = (value: string): boolean =>
  /^#([A-Fa-f0-9]{6})$/.test(value.trim());

const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));

const formatStatNumber = (value: number): string => {
  if (Number.isInteger(value)) {
    return `${value}`;
  }

  return value.toFixed(2).replace(/\.?0+$/, "");
};

const applyHighlightMarkup = (headline: string, highlight: string | null): string => {
  const plainHeadline =
    stripHighlightMarkup(headline) || EDITORIAL_STAT_RING_DEFAULT_HEADLINE;
  const trimmedHighlight = highlight?.trim() ?? "";

  if (!trimmedHighlight) {
    return plainHeadline;
  }

  const normalizedHeadline = plainHeadline.toLowerCase();
  const normalizedHighlight = trimmedHighlight.toLowerCase();
  const index = normalizedHeadline.indexOf(normalizedHighlight);

  if (index === -1) {
    return plainHeadline;
  }

  const matchedHeadline = plainHeadline.slice(index, index + trimmedHighlight.length);
  return (
    plainHeadline.slice(0, index) +
    `[[${matchedHeadline}]]` +
    plainHeadline.slice(index + matchedHeadline.length)
  );
};

export const parseEditorialStatRingText = (
  text: string,
): ParsedEditorialStatRingText => {
  const lines = splitOverlayLines(text);
  const rawHeadline = lines[0] || EDITORIAL_STAT_RING_DEFAULT_HEADLINE;
  const highlightMatch = rawHeadline.match(/\[\[(.+?)\]\]/);
  const highlight = highlightMatch?.[1]?.trim() || null;
  const headline =
    stripHighlightMarkup(rawHeadline) || EDITORIAL_STAT_RING_DEFAULT_HEADLINE;
  const subhead = lines[1] || EDITORIAL_STAT_RING_DEFAULT_SUBHEAD;
  const [valueRaw = "", secondRaw = "", thirdRaw = ""] = (lines[2] || "")
    .split("|")
    .map((part) => part.trim());
  const parsedValue = Number.parseFloat(valueRaw);
  const value = Number.isFinite(parsedValue)
    ? clampPercent(parsedValue)
    : EDITORIAL_STAT_RING_DEFAULT_VALUE;
  const suffix =
    secondRaw.length > 0 && !isHexColor(secondRaw)
      ? secondRaw
      : EDITORIAL_STAT_RING_DEFAULT_SUFFIX;
  const color = isHexColor(thirdRaw)
    ? thirdRaw
    : isHexColor(secondRaw)
      ? secondRaw
      : EDITORIAL_STAT_RING_DEFAULT_COLOR;

  return {
    headline,
    highlight,
    subhead,
    value,
    suffix: suffix || EDITORIAL_STAT_RING_DEFAULT_SUFFIX,
    color,
  };
};

export const buildEditorialStatRingText = ({
  headline,
  highlight,
  subhead,
  value,
  suffix,
  color,
}: ParsedEditorialStatRingText): string =>
  [
    applyHighlightMarkup(headline, highlight),
    subhead.trim() || EDITORIAL_STAT_RING_DEFAULT_SUBHEAD,
    [
      formatStatNumber(
        clampPercent(Number.isFinite(value) ? value : EDITORIAL_STAT_RING_DEFAULT_VALUE),
      ),
      suffix.trim() || EDITORIAL_STAT_RING_DEFAULT_SUFFIX,
      isHexColor(color) ? color : EDITORIAL_STAT_RING_DEFAULT_COLOR,
    ].join("|"),
  ].join("\n");

export const formatEditorialStatRingValue = (
  value: number,
  suffix: string,
): string => `${formatStatNumber(clampPercent(value))}${suffix}`;

export const splitEditorialStatRingHeadline = (
  headline: string,
  highlight: string | null,
): {
  before: string;
  highlighted: string | null;
  after: string;
} => {
  if (!highlight) {
    return {
      before: headline,
      highlighted: null,
      after: "",
    };
  }

  const index = headline.toLowerCase().indexOf(highlight.toLowerCase());
  if (index === -1) {
    return {
      before: headline,
      highlighted: null,
      after: "",
    };
  }

  return {
    before: headline.slice(0, index),
    highlighted: headline.slice(index, index + highlight.length),
    after: headline.slice(index + highlight.length),
  };
};
