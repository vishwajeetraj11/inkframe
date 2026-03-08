export interface ChartCardRow {
  label: string;
  value: number;
  color: string;
}

export interface ParsedChartCardText {
  headline: string;
  highlight: string | null;
  subhead: string;
  rows: ChartCardRow[];
}

export const CHART_CARD_FALLBACK_PALETTE = [
  "#69bdfb",
  "#ff5a43",
  "#ddd8d1",
  "#8fd2ff",
  "#f39d8b",
  "#bfb9b0",
] as const;

export const CHART_CARD_FALLBACK_ROWS: ChartCardRow[] = [
  {
    label: "Democrats",
    value: 49,
    color: "#69bdfb",
  },
  {
    label: "Republicans",
    value: 49,
    color: "#ff5a43",
  },
  {
    label: "Others",
    value: 2,
    color: "#ddd8d1",
  },
];

export const CHART_CARD_DEFAULT_HEADLINE =
  "How Americans split their political loyalties";
export const CHART_CARD_DEFAULT_SUBHEAD =
  "Based on national survey data collected by Gallup in 2024, showing how U.S. adults identify politically across the two major parties and independents.";

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

const formatChartCardNumber = (value: number): string => {
  if (Number.isInteger(value)) {
    return `${value}`;
  }

  return value.toFixed(2).replace(/\.?0+$/, "");
};

const applyHighlightMarkup = (headline: string, highlight: string | null): string => {
  const plainHeadline = stripHighlightMarkup(headline) || CHART_CARD_DEFAULT_HEADLINE;
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

export const formatChartCardValue = (value: number): string =>
  `${formatChartCardNumber(value)}%`;

export const parseChartCardText = (
  text: string,
  options?: { useFallbackRows?: boolean },
): ParsedChartCardText => {
  const useFallbackRows = options?.useFallbackRows ?? true;
  const lines = splitOverlayLines(text);
  const rawHeadline = lines[0] || CHART_CARD_DEFAULT_HEADLINE;
  const highlightMatch = rawHeadline.match(/\[\[(.+?)\]\]/);
  const highlight = highlightMatch?.[1]?.trim() || null;
  const headline = stripHighlightMarkup(rawHeadline) || CHART_CARD_DEFAULT_HEADLINE;
  const subhead = lines[1] || CHART_CARD_DEFAULT_SUBHEAD;

  const rows = lines
    .slice(2)
    .map((line, index) => {
      const [labelRaw = "", valueRaw = "", colorRaw = ""] = line
        .split("|")
        .map((part) => part.trim());
      const value = Number.parseFloat(valueRaw);

      if (!labelRaw || !Number.isFinite(value) || value <= 0) {
        return null;
      }

      return {
        label: labelRaw,
        value,
        color: isHexColor(colorRaw)
          ? colorRaw
          : CHART_CARD_FALLBACK_PALETTE[index % CHART_CARD_FALLBACK_PALETTE.length],
      } satisfies ChartCardRow;
    })
    .filter((row): row is ChartCardRow => row !== null);

  return {
    headline,
    highlight,
    subhead,
    rows:
      useFallbackRows && rows.length < 2
        ? CHART_CARD_FALLBACK_ROWS.map((row) => ({ ...row }))
        : rows,
  };
};

export const buildChartCardText = ({
  headline,
  highlight,
  subhead,
  rows,
}: ParsedChartCardText): string => {
  const normalizedRows = rows
    .map((row, index) => ({
      label: row.label.trim(),
      value: Number.isFinite(row.value) ? row.value : 0,
      color: isHexColor(row.color)
        ? row.color
        : CHART_CARD_FALLBACK_PALETTE[index % CHART_CARD_FALLBACK_PALETTE.length],
    }))
    .filter((row) => row.label.length > 0 && row.value > 0);
  const safeRows =
    normalizedRows.length >= 2
      ? normalizedRows
      : CHART_CARD_FALLBACK_ROWS.map((row) => ({ ...row }));

  return [
    applyHighlightMarkup(headline, highlight),
    subhead.trim() || CHART_CARD_DEFAULT_SUBHEAD,
    ...safeRows.map(
      (row) => `${row.label}|${formatChartCardNumber(row.value)}|${row.color}`,
    ),
  ].join("\n");
};

export const splitHeadlineAroundHighlight = (
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
