import type {
  PexelsVideoResult,
  PexelsVideoRendition,
  PexelsVideoSearchParams,
  PexelsVideoSearchResult,
  PexelsPhotoResult,
  PexelsPhotoSearchResult,
} from "@/lib/pexels/types";

const PEXELS_VIDEO_SEARCH_URL = "https://api.pexels.com/v1/videos/search";
const PEXELS_PHOTO_SEARCH_URL = "https://api.pexels.com/v1/search";
const MAX_RENDITIONS_PER_VIDEO = 12;

export class PexelsApiError extends Error {
  readonly status: number;
  readonly retryAfterSeconds: number | null;

  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "PexelsApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const finitePositiveNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

const safeHttpsUrl = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

const sanitizeRendition = (value: unknown): PexelsVideoRendition | null => {
  if (!isRecord(value)) return null;
  const url = safeHttpsUrl(value.link);
  const width = finitePositiveNumber(value.width);
  const height = finitePositiveNumber(value.height);
  if (!url || !width || !height) return null;

  const fileType = typeof value.file_type === "string"
    ? value.file_type.toLowerCase()
    : typeof value.fileType === "string"
      ? value.fileType.toLowerCase()
      : "";
  if (fileType !== "mp4" && fileType !== "video/mp4" && !url.toLowerCase().split("?")[0].endsWith(".mp4")) return null;

  const fps = finitePositiveNumber(value.fps);
  return {
    id: typeof value.id === "number" || typeof value.id === "string" ? value.id : url,
    url,
    fileType: "mp4",
    quality: typeof value.quality === "string" ? value.quality.slice(0, 32) : undefined,
    width: Math.round(width),
    height: Math.round(height),
    fps: fps ? Math.round(fps * 100) / 100 : undefined,
  };
};

export const sanitizePexelsVideo = (value: unknown): PexelsVideoResult | null => {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "number" && Number.isSafeInteger(value.id) ? value.id : null;
  const width = finitePositiveNumber(value.width);
  const height = finitePositiveNumber(value.height);
  const duration = typeof value.duration === "number" && Number.isFinite(value.duration)
    ? Math.max(0, Math.round(value.duration * 100) / 100)
    : null;
  const thumbnail = safeHttpsUrl(value.image);
  const pexelsUrl = safeHttpsUrl(value.url);
  const user = isRecord(value.user) ? value.user : null;
  const photographer = typeof user?.name === "string" ? user.name.trim().slice(0, 160) : "Pexels creator";
  const photographerUrl = safeHttpsUrl(user?.url) ?? "https://www.pexels.com/";
  if (!id || !width || !height || duration === null || !thumbnail || !pexelsUrl) return null;

  const renditions = Array.isArray(value.video_files)
    ? value.video_files
        .map(sanitizeRendition)
        .filter((rendition): rendition is PexelsVideoRendition => rendition !== null)
        .sort((a, b) => (b.width * b.height) - (a.width * a.height))
        .slice(0, MAX_RENDITIONS_PER_VIDEO)
    : [];
  if (renditions.length === 0) return null;

  return {
    id,
    width: Math.round(width),
    height: Math.round(height),
    duration,
    thumbnail,
    pexelsUrl,
    photographer,
    photographerUrl,
    renditions,
  };
};

export const sanitizePexelsSearchResponse = (payload: unknown): PexelsVideoSearchResult => {
  const data = isRecord(payload) ? payload : {};
  const videos = Array.isArray(data.videos)
    ? data.videos
        .map(sanitizePexelsVideo)
        .filter((video): video is PexelsVideoResult => video !== null)
    : [];
  return {
    page: typeof data.page === "number" ? Math.max(1, Math.round(data.page)) : 1,
    perPage: typeof data.per_page === "number" ? Math.max(1, Math.round(data.per_page)) : videos.length,
    totalResults: typeof data.total_results === "number" ? Math.max(0, Math.round(data.total_results)) : videos.length,
    nextPage: safeHttpsUrl(data.next_page),
    videos,
    attribution: { label: "Pexels", url: "https://www.pexels.com/" },
  };
};

export interface SearchPexelsVideosOptions {
  apiKey?: string;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}

export const searchPexelsVideos = async (
  params: PexelsVideoSearchParams,
  options: SearchPexelsVideosOptions = {},
): Promise<PexelsVideoSearchResult> => {
  const apiKey = options.apiKey ?? process.env.PEXELS_API_KEY;
  if (!apiKey) {
    throw new PexelsApiError("Pexels video search is not configured.", 503);
  }

  const url = new URL(PEXELS_VIDEO_SEARCH_URL);
  url.searchParams.set("query", params.query);
  url.searchParams.set("orientation", params.orientation);
  url.searchParams.set("page", String(params.page));
  url.searchParams.set("per_page", String(params.perPage));
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(url.toString(), {
      headers: { Authorization: apiKey, Accept: "application/json" },
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new PexelsApiError("Pexels video search is temporarily unavailable.", 502);
  }

  if (!response.ok) {
    const retryAfter = Number(response.headers.get("retry-after"));
    if (response.status === 429) {
      throw new PexelsApiError("Pexels search is temporarily rate limited. Try again shortly.", 429, Number.isFinite(retryAfter) ? retryAfter : null);
    }
    if (response.status === 401 || response.status === 403) {
      throw new PexelsApiError("Pexels video search credentials were rejected.", 502);
    }
    throw new PexelsApiError("Pexels video search is temporarily unavailable.", 502);
  }

  try {
    return sanitizePexelsSearchResponse(await response.json());
  } catch {
    throw new PexelsApiError("Pexels returned an invalid video search response.", 502);
  }
};

export const sanitizePexelsPhoto = (value: unknown): PexelsPhotoResult | null => {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "number" && Number.isSafeInteger(value.id) ? value.id : null;
  const width = finitePositiveNumber(value.width);
  const height = finitePositiveNumber(value.height);
  const src = isRecord(value.src) ? value.src : {};
  const imageUrl = safeHttpsUrl(src.large2x) ?? safeHttpsUrl(src.large) ?? safeHttpsUrl(src.original);
  const thumbnail = safeHttpsUrl(src.medium) ?? imageUrl;
  const pexelsUrl = safeHttpsUrl(value.url);
  const photographer = typeof value.photographer === "string"
    ? value.photographer.trim().slice(0, 160)
    : "Pexels creator";
  const photographerUrl = safeHttpsUrl(value.photographer_url) ?? "https://www.pexels.com/";
  if (!id || !width || !height || !imageUrl || !thumbnail || !pexelsUrl) return null;
  return {
    id,
    width: Math.round(width),
    height: Math.round(height),
    alt: typeof value.alt === "string" ? value.alt.trim().slice(0, 240) : "Pexels photo",
    thumbnail,
    imageUrl,
    pexelsUrl,
    photographer,
    photographerUrl,
  };
};

export const sanitizePexelsPhotoSearchResponse = (
  payload: unknown,
): PexelsPhotoSearchResult => {
  const data = isRecord(payload) ? payload : {};
  const photos = Array.isArray(data.photos)
    ? data.photos
        .map(sanitizePexelsPhoto)
        .filter((photo): photo is PexelsPhotoResult => photo !== null)
    : [];
  return {
    page: typeof data.page === "number" ? Math.max(1, Math.round(data.page)) : 1,
    perPage: typeof data.per_page === "number" ? Math.max(1, Math.round(data.per_page)) : photos.length,
    totalResults: typeof data.total_results === "number" ? Math.max(0, Math.round(data.total_results)) : photos.length,
    nextPage: safeHttpsUrl(data.next_page),
    photos,
    attribution: { label: "Pexels", url: "https://www.pexels.com/" },
  };
};

export const searchPexelsPhotos = async (
  params: PexelsVideoSearchParams,
  options: SearchPexelsVideosOptions = {},
): Promise<PexelsPhotoSearchResult> => {
  const apiKey = options.apiKey ?? process.env.PEXELS_API_KEY;
  if (!apiKey) throw new PexelsApiError("Pexels photo search is not configured.", 503);
  const url = new URL(PEXELS_PHOTO_SEARCH_URL);
  url.searchParams.set("query", params.query);
  url.searchParams.set("orientation", params.orientation);
  url.searchParams.set("page", String(params.page));
  url.searchParams.set("per_page", String(params.perPage));
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(url.toString(), {
      headers: { Authorization: apiKey, Accept: "application/json" },
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new PexelsApiError("Pexels photo search is temporarily unavailable.", 502);
  }
  if (!response.ok) {
    const retryAfter = Number(response.headers.get("retry-after"));
    if (response.status === 429) {
      throw new PexelsApiError("Pexels search is temporarily rate limited. Try again shortly.", 429, Number.isFinite(retryAfter) ? retryAfter : null);
    }
    if (response.status === 401 || response.status === 403) {
      throw new PexelsApiError("Pexels photo search credentials were rejected.", 502);
    }
    throw new PexelsApiError("Pexels photo search is temporarily unavailable.", 502);
  }
  try {
    return sanitizePexelsPhotoSearchResponse(await response.json());
  } catch {
    throw new PexelsApiError("Pexels returned an invalid photo search response.", 502);
  }
};
