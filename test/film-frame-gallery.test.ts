import { describe, expect, it } from "vitest";
import {
  FILM_FRAME_GALLERY_DEFAULT_HEADLINE,
  FILM_FRAME_GALLERY_DEFAULT_SUBHEAD,
  buildFilmFrameGalleryText,
  parseFilmFrameGalleryText,
} from "@/lib/editor/film-frame-gallery";

describe("film frame gallery parser", () => {
  it("parses headline, subhead, and optional metadata", () => {
    const parsed = parseFilmFrameGalleryText(
      "The night the wall opened\nA framed archival image sequence from the fall of the Berlin Wall.\nLOCATION: Berlin\nYEAR: 1989",
    );

    expect(parsed).toEqual({
      headline: "The night the wall opened",
      subhead: "A framed archival image sequence from the fall of the Berlin Wall.",
      location: "Berlin",
      year: "1989",
    });
  });

  it("fills in defaults when copy is missing", () => {
    const parsed = parseFilmFrameGalleryText("");

    expect(parsed).toEqual({
      headline: FILM_FRAME_GALLERY_DEFAULT_HEADLINE,
      subhead: FILM_FRAME_GALLERY_DEFAULT_SUBHEAD,
      location: "",
      year: "",
    });
  });

  it("round-trips through the text builder", () => {
    const built = buildFilmFrameGalleryText({
      headline: "Ancient places",
      subhead: "A quiet framed-image sequence.",
      location: "Petra",
      year: "2nd century BCE",
    });

    expect(parseFilmFrameGalleryText(built)).toEqual({
      headline: "Ancient places",
      subhead: "A quiet framed-image sequence.",
      location: "Petra",
      year: "2nd century BCE",
    });
  });
});
