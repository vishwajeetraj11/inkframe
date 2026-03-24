export interface ParsedFilmFrameGalleryText {
  headline: string;
  subhead: string;
  location: string;
  year: string;
}

export const FILM_FRAME_GALLERY_DEFAULT_HEADLINE = "Places that still feel mythic";
export const FILM_FRAME_GALLERY_DEFAULT_SUBHEAD =
  "A cinematic framed-image sequence with archival texture and a slow documentary drift.";

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

export const parseFilmFrameGalleryText = (
  text: string,
): ParsedFilmFrameGalleryText => {
  const lines = splitOverlayLines(text);

  return {
    headline:
      stripPrefixedValue(
        lines[0] || FILM_FRAME_GALLERY_DEFAULT_HEADLINE,
        "HEADLINE:",
      ) || FILM_FRAME_GALLERY_DEFAULT_HEADLINE,
    subhead:
      stripPrefixedValue(
        lines[1] || FILM_FRAME_GALLERY_DEFAULT_SUBHEAD,
        "SUBHEAD:",
      ) || FILM_FRAME_GALLERY_DEFAULT_SUBHEAD,
    location: getPrefixedValue(lines.slice(2), "LOCATION:"),
    year: getPrefixedValue(lines.slice(2), "YEAR:"),
  };
};

export const buildFilmFrameGalleryText = (
  input: ParsedFilmFrameGalleryText,
): string =>
  [
    input.headline.trim() || FILM_FRAME_GALLERY_DEFAULT_HEADLINE,
    input.subhead.trim() || FILM_FRAME_GALLERY_DEFAULT_SUBHEAD,
    ...(input.location.trim() ? [`LOCATION: ${input.location.trim()}`] : []),
    ...(input.year.trim() ? [`YEAR: ${input.year.trim()}`] : []),
  ].join("\n");
