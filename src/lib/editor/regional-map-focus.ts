export type RegionalMapFocusMode = "country" | "border";

export interface ParsedRegionalMapFocusText {
  headline: string;
  subhead: string;
  primaryCountry: string;
  secondaryCountry: string;
  label: string;
  year: string;
  focusMode: RegionalMapFocusMode;
}

export const REGIONAL_MAP_FOCUS_DEFAULT_HEADLINE = "Why this border mattered";
export const REGIONAL_MAP_FOCUS_DEFAULT_SUBHEAD =
  "A regional atlas zoom shows the local strategic context.";
export const REGIONAL_MAP_FOCUS_DEFAULT_PRIMARY_COUNTRY = "India";

const splitOverlayLines = (text: string): string[] => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.length > 0 ? lines : [text.trim()];
};

const stripPrefixedValue = (line: string, prefix: string): string => {
  const normalizedLine = line.trim();
  if (normalizedLine.toLowerCase().startsWith(prefix.toLowerCase())) {
    return normalizedLine.slice(prefix.length).trim();
  }

  return normalizedLine;
};

const getPrefixedValue = (lines: string[], prefix: string): string => {
  const match = lines.find((line) =>
    line.trim().toLowerCase().startsWith(prefix.toLowerCase()),
  );

  return match ? stripPrefixedValue(match, prefix) : "";
};

const normalizeFocusMode = (value: string): RegionalMapFocusMode =>
  value.trim().toLowerCase() === "border" ? "border" : "country";

export const getRegionalMapFocusDefaultLabel = (
  primaryCountry: string,
  secondaryCountry: string,
): string => {
  const safePrimary = primaryCountry.trim() || REGIONAL_MAP_FOCUS_DEFAULT_PRIMARY_COUNTRY;
  const safeSecondary = secondaryCountry.trim();

  return safeSecondary
    ? `${safePrimary}-${safeSecondary} boundary`
    : safePrimary;
};

export const parseRegionalMapFocusText = (
  text: string,
): ParsedRegionalMapFocusText => {
  const lines = splitOverlayLines(text);
  const headline =
    stripPrefixedValue(
      lines[0] || REGIONAL_MAP_FOCUS_DEFAULT_HEADLINE,
      "HEADLINE:",
    ) || REGIONAL_MAP_FOCUS_DEFAULT_HEADLINE;
  const subhead =
    stripPrefixedValue(
      lines[1] || REGIONAL_MAP_FOCUS_DEFAULT_SUBHEAD,
      "SUBHEAD:",
    ) || REGIONAL_MAP_FOCUS_DEFAULT_SUBHEAD;
  const primaryCountry =
    getPrefixedValue(lines.slice(2), "PRIMARY:") ||
    REGIONAL_MAP_FOCUS_DEFAULT_PRIMARY_COUNTRY;
  const secondaryCountry = getPrefixedValue(lines.slice(2), "SECONDARY:");
  const label =
    getPrefixedValue(lines.slice(2), "LABEL:") ||
    getRegionalMapFocusDefaultLabel(primaryCountry, secondaryCountry);
  const year = getPrefixedValue(lines.slice(2), "YEAR:");
  const focusMode = normalizeFocusMode(getPrefixedValue(lines.slice(2), "FOCUS:"));

  return {
    headline,
    subhead,
    primaryCountry,
    secondaryCountry,
    label,
    year,
    focusMode,
  };
};

export const buildRegionalMapFocusText = (
  input: ParsedRegionalMapFocusText,
): string => {
  const primaryCountry =
    input.primaryCountry.trim() || REGIONAL_MAP_FOCUS_DEFAULT_PRIMARY_COUNTRY;
  const secondaryCountry = input.secondaryCountry.trim();
  const label =
    input.label.trim() ||
    getRegionalMapFocusDefaultLabel(primaryCountry, secondaryCountry);
  const year = input.year.trim();
  const focusMode = normalizeFocusMode(input.focusMode);

  return [
    input.headline.trim() || REGIONAL_MAP_FOCUS_DEFAULT_HEADLINE,
    input.subhead.trim() || REGIONAL_MAP_FOCUS_DEFAULT_SUBHEAD,
    `PRIMARY: ${primaryCountry}`,
    ...(secondaryCountry ? [`SECONDARY: ${secondaryCountry}`] : []),
    `LABEL: ${label}`,
    ...(year ? [`YEAR: ${year}`] : []),
    `FOCUS: ${focusMode}`,
  ].join("\n");
};
