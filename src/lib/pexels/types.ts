/** The orientations accepted by the Pexels video search endpoint. */
export const PEXELS_ORIENTATIONS = [
  "landscape",
  "portrait",
  "square",
] as const;

export type PexelsOrientation = (typeof PEXELS_ORIENTATIONS)[number];

export interface PexelsVideoRendition {
  id: number | string;
  url: string;
  fileType: "mp4";
  quality?: string;
  width: number;
  height: number;
  fps?: number;
}

/** Safe, browser-facing metadata returned by our Pexels proxy. */
export interface PexelsVideoResult {
  id: number;
  width: number;
  height: number;
  duration: number;
  thumbnail: string;
  pexelsUrl: string;
  photographer: string;
  photographerUrl: string;
  renditions: PexelsVideoRendition[];
}

export interface PexelsVideoSearchParams {
  query: string;
  orientation: PexelsOrientation;
  page: number;
  perPage: number;
}

export interface PexelsVideoSearchResult {
  page: number;
  perPage: number;
  totalResults: number;
  nextPage: string | null;
  videos: PexelsVideoResult[];
  attribution: {
    label: "Pexels";
    url: "https://www.pexels.com/";
  };
}

export interface PexelsPhotoResult {
  id: number;
  width: number;
  height: number;
  alt: string;
  thumbnail: string;
  imageUrl: string;
  pexelsUrl: string;
  photographer: string;
  photographerUrl: string;
}

export interface PexelsPhotoSearchResult {
  page: number;
  perPage: number;
  totalResults: number;
  nextPage: string | null;
  photos: PexelsPhotoResult[];
  attribution: {
    label: "Pexels";
    url: "https://www.pexels.com/";
  };
}
