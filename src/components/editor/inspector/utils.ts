import {
  buildChartCardText,
  CHART_CARD_FALLBACK_ROWS,
  parseChartCardText,
} from "@/lib/editor/chart-card";
import {
  buildCreatedaleyOpenerText,
  parseCreatedaleyOpenerText,
} from "@/lib/editor/createdaley-opener";
import {
  buildEditorialStatRingText,
  parseEditorialStatRingText,
} from "@/lib/editor/editorial-stat-ring";
import {
  buildVoxTimelineText,
  parseVoxTimelineText,
} from "@/lib/editor/vox-timeline";
import { FPS } from "@/lib/editor/constants";
import { findWorldCountry, WORLD_COUNTRY_NAMES } from "@/lib/maps/world";

export const framesToSeconds = (frames: number): number => Number((frames / FPS).toFixed(2));
export const secondsToFrames = (seconds: number): number => Math.max(1, Math.round(seconds * FPS));
export const WORLD_MAP_FOCUS_DEFAULT_HEADLINE = "The global story in one frame";
export const WORLD_MAP_FOCUS_DEFAULT_SUBHEAD =
  "Use a world atlas to orient the audience before narrowing attention to one country.";
export const WORLD_MAP_FOCUS_DEFAULT_COUNTRY = "India";
export const WORLD_MAP_COUNTRY_OPTIONS = [...WORLD_COUNTRY_NAMES].sort((left, right) =>
  left.localeCompare(right),
);

export const parseNumber = (value: string, fallback: number): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const splitStructuredLines = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const stripPrefixedValue = (line: string, prefix: string): string => {
  const normalizedLine = line.trim();
  if (normalizedLine.toLowerCase().startsWith(prefix.toLowerCase())) {
    return normalizedLine.slice(prefix.length).trim();
  }

  return normalizedLine;
};

export const getEditableWorldMapFocusData = (text: string) => {
  const lines = splitStructuredLines(text);
  const headlineLine =
    lines.find((line) => line.toLowerCase().startsWith("headline:")) ??
    lines.find(
      (line) =>
        !line.toLowerCase().startsWith("subhead:") &&
        !line.toLowerCase().startsWith("country:"),
    ) ??
    WORLD_MAP_FOCUS_DEFAULT_HEADLINE;
  const subheadLine =
    lines.find((line) => line.toLowerCase().startsWith("subhead:")) ??
    lines.find(
      (line, index) =>
        index > lines.indexOf(headlineLine) && !line.toLowerCase().startsWith("country:"),
    ) ??
    WORLD_MAP_FOCUS_DEFAULT_SUBHEAD;
  const countryLine =
    lines.find((line) => line.toLowerCase().startsWith("country:")) ??
    `COUNTRY: ${WORLD_MAP_FOCUS_DEFAULT_COUNTRY}`;

  return {
    headline:
      stripPrefixedValue(headlineLine, "HEADLINE:") || WORLD_MAP_FOCUS_DEFAULT_HEADLINE,
    subhead:
      stripPrefixedValue(subheadLine, "SUBHEAD:") || WORLD_MAP_FOCUS_DEFAULT_SUBHEAD,
    country:
      stripPrefixedValue(countryLine, "COUNTRY:") || WORLD_MAP_FOCUS_DEFAULT_COUNTRY,
  };
};

export const buildWorldMapFocusText = (data: {
  headline: string;
  subhead: string;
  country: string;
}) =>
  [
    data.headline.trim() || WORLD_MAP_FOCUS_DEFAULT_HEADLINE,
    data.subhead.trim() || WORLD_MAP_FOCUS_DEFAULT_SUBHEAD,
    `COUNTRY: ${data.country.trim() || WORLD_MAP_FOCUS_DEFAULT_COUNTRY}`,
  ].join("\n");

export const getEditableChartCardData = (text: string) => {
  const parsed = parseChartCardText(text, { useFallbackRows: false });

  return {
    ...parsed,
    rows:
      parsed.rows.length >= 2
        ? parsed.rows.map((row) => ({ ...row }))
        : CHART_CARD_FALLBACK_ROWS.map((row) => ({ ...row })),
  };
};

export const getEditableCreatedaleyOpenerData = (text: string) =>
  parseCreatedaleyOpenerText(text);

export const getEditableEditorialStatRingData = (text: string) =>
  parseEditorialStatRingText(text);

export const getEditableVoxTimelineData = (text: string) =>
  parseVoxTimelineText(text);

export const getSelectedWorldMapCountryName = (country: string): string =>
  (findWorldCountry(country)?.properties?.name ?? country.trim()) ||
  WORLD_MAP_FOCUS_DEFAULT_COUNTRY;

export const getWorldMapCountryOptions = (selectedCountryName: string): string[] =>
  WORLD_MAP_COUNTRY_OPTIONS.includes(selectedCountryName)
    ? WORLD_MAP_COUNTRY_OPTIONS
    : [...WORLD_MAP_COUNTRY_OPTIONS, selectedCountryName].sort((left, right) =>
        left.localeCompare(right),
      );

export {
  buildChartCardText,
  buildCreatedaleyOpenerText,
  buildEditorialStatRingText,
  buildVoxTimelineText,
};
