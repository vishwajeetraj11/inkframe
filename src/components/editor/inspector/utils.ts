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
  buildFilmFrameGalleryText,
  FILM_FRAME_GALLERY_DEFAULT_HEADLINE,
  FILM_FRAME_GALLERY_DEFAULT_SUBHEAD,
  parseFilmFrameGalleryText,
} from "@/lib/editor/film-frame-gallery";
import {
  buildRegionalMapFocusText,
  parseRegionalMapFocusText,
  REGIONAL_MAP_FOCUS_DEFAULT_HEADLINE,
  REGIONAL_MAP_FOCUS_DEFAULT_PRIMARY_COUNTRY,
  REGIONAL_MAP_FOCUS_DEFAULT_SUBHEAD,
} from "@/lib/editor/regional-map-focus";
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
export const REGIONAL_MAP_FOCUS_DEFAULT_YEAR = "";

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

export const getEditableRegionalMapFocusData = (text: string) => {
  const parsed = parseRegionalMapFocusText(text);

  return {
    headline: parsed.headline || REGIONAL_MAP_FOCUS_DEFAULT_HEADLINE,
    subhead: parsed.subhead || REGIONAL_MAP_FOCUS_DEFAULT_SUBHEAD,
    primaryCountry:
      parsed.primaryCountry || REGIONAL_MAP_FOCUS_DEFAULT_PRIMARY_COUNTRY,
    secondaryCountry: parsed.secondaryCountry,
    label: parsed.label,
    year: parsed.year || REGIONAL_MAP_FOCUS_DEFAULT_YEAR,
    focusMode: parsed.focusMode,
  };
};

export const getEditableFilmFrameGalleryData = (text: string) => {
  const parsed = parseFilmFrameGalleryText(text);

  return {
    headline: parsed.headline || FILM_FRAME_GALLERY_DEFAULT_HEADLINE,
    subhead: parsed.subhead || FILM_FRAME_GALLERY_DEFAULT_SUBHEAD,
    location: parsed.location,
    year: parsed.year,
  };
};

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

const resolveWorldMapCountryName = (country: string): string =>
  findWorldCountry(country)?.properties?.name ?? country.trim();

export const getSelectedWorldMapCountryName = (country: string): string =>
  resolveWorldMapCountryName(country) ||
  WORLD_MAP_FOCUS_DEFAULT_COUNTRY;

export const getOptionalWorldMapCountryName = (country: string): string =>
  resolveWorldMapCountryName(country);

export const getWorldMapCountryOptions = (...selectedCountryNames: string[]): string[] => {
  const additionalCountryNames = selectedCountryNames
    .map((countryName) => resolveWorldMapCountryName(countryName))
    .filter((countryName) => countryName.length > 0 && !WORLD_MAP_COUNTRY_OPTIONS.includes(countryName));

  return [...WORLD_MAP_COUNTRY_OPTIONS, ...additionalCountryNames].sort((left, right) =>
    left.localeCompare(right),
  );
};

export {
  buildChartCardText,
  buildCreatedaleyOpenerText,
  buildEditorialStatRingText,
  buildFilmFrameGalleryText,
  buildRegionalMapFocusText,
  buildVoxTimelineText,
};

/**
 * Maps preset type to its corresponding parser function
 * Enables consolidated data extraction without repeated type checks
 */
export const PRESET_DATA_PARSERS = {
  "chart-card": parseChartCardText,
  "editorial-stat-ring": parseEditorialStatRingText,
  "world-map-focus": (text: string) => {
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
  },
  "regional-map-focus": parseRegionalMapFocusText,
  "film-frame-gallery": parseFilmFrameGalleryText,
  "createdaley-opener": parseCreatedaleyOpenerText,
  "vox-timeline": parseVoxTimelineText,
} as const;
