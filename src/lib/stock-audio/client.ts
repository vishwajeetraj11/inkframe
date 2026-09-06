import type {
  LicensedAudioResult,
  LicensedAudioSearchResult,
} from "./types";

const FREESOUND_SEARCH_URL = "https://freesound.org/apiv2/search/";

export class StockAudioApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StockAudioApiError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const safeHttpsUrl = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

const positiveNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : typeof value === "string" && Number.isFinite(Number(value)) && Number(value) > 0
      ? Number(value)
      : null;

const safeText = (value: unknown, fallback: string, maximum = 160): string =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, maximum) : fallback;

const permittedCreativeCommonsLicense = (url: string): boolean =>
  /creativecommons\.org\/(?:publicdomain\/zero|licenses\/(?:by|by-sa))\//i.test(url) &&
  !/licenses\/by-(?:nc|nd)/i.test(url);

export const sanitizeFreesoundSound = (value: unknown): LicensedAudioResult | null => {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "number" || typeof value.id === "string" ? String(value.id) : null;
  const previews = isRecord(value.previews) ? value.previews : {};
  const audioUrl = safeHttpsUrl(previews["preview-hq-mp3"]) ?? safeHttpsUrl(previews["preview-lq-mp3"]);
  const sourceUrl = safeHttpsUrl(value.url);
  const licenseUrl = safeHttpsUrl(value.license);
  const durationSeconds = positiveNumber(value.duration);
  if (!id || !audioUrl || !sourceUrl || !licenseUrl || !durationSeconds) return null;
  if (!permittedCreativeCommonsLicense(licenseUrl)) return null;
  const creatorName = safeText(value.username, "Freesound creator");
  return {
    id,
    provider: "freesound",
    title: safeText(value.name, "Freesound effect"),
    creatorName,
    creatorUrl: `https://freesound.org/people/${encodeURIComponent(creatorName)}/`,
    sourceUrl,
    audioUrl,
    durationSeconds: Math.round(durationSeconds * 100) / 100,
    licenseName: licenseUrl.includes("zero") ? "CC0" : licenseUrl.includes("by-sa") ? "CC BY-SA" : "CC BY",
    licenseUrl,
    attributionRequired: !licenseUrl.includes("zero"),
    tags: Array.isArray(value.tags)
      ? value.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 12)
      : [],
  };
};

export const sanitizeFreesoundResponse = (payload: unknown, query: string): LicensedAudioSearchResult => {
  const data = isRecord(payload) ? payload : {};
  const results = Array.isArray(data.results)
    ? data.results.map(sanitizeFreesoundSound).filter((item): item is LicensedAudioResult => item !== null)
    : [];
  return { provider: "freesound", query, results };
};

const fetchJson = async (url: URL, init: RequestInit, fetcher: typeof fetch): Promise<unknown> => {
  let response: Response;
  try {
    response = await fetcher(url.toString(), { ...init, cache: "no-store" });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new StockAudioApiError("Licensed audio search is temporarily unavailable.", 502);
  }
  if (response.status === 429) throw new StockAudioApiError("Licensed audio search is rate limited. Try again shortly.", 429);
  if (response.status === 401 || response.status === 403) throw new StockAudioApiError("Licensed audio credentials were rejected.", 502);
  if (!response.ok) throw new StockAudioApiError("Licensed audio search is temporarily unavailable.", 502);
  try {
    return await response.json();
  } catch {
    throw new StockAudioApiError("Licensed audio provider returned an invalid response.", 502);
  }
};

type FreesoundSearchOptions = { apiKey?: string; signal?: AbortSignal; fetcher?: typeof fetch };

const searchFreesound = async (
  query: string,
  kind: "music" | "effects",
  options: FreesoundSearchOptions = {},
): Promise<LicensedAudioSearchResult> => {
  const apiKey = options.apiKey ?? process.env.FREESOUND_API_KEY;
  if (!apiKey) throw new StockAudioApiError(`Freesound ${kind} search is not configured.`, 503);
  const url = new URL(FREESOUND_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("page_size", "24");
  url.searchParams.set("fields", "id,name,url,username,license,duration,previews,tags");
  const durationFilter = kind === "music" ? "tag:music duration:[1 TO 600]" : "duration:[0.1 TO 30]";
  url.searchParams.set("filter", `${durationFilter} license:("Creative Commons 0" OR "Attribution")`);
  const payload = await fetchJson(
    url,
    { signal: options.signal, headers: { Authorization: `Token ${apiKey}` } },
    options.fetcher ?? fetch,
  );
  return sanitizeFreesoundResponse(payload, query);
};

export const searchFreesoundMusic = (
  query: string,
  options: FreesoundSearchOptions = {},
): Promise<LicensedAudioSearchResult> => searchFreesound(query, "music", options);

export const searchFreesoundEffects = (
  query: string,
  options: FreesoundSearchOptions = {},
): Promise<LicensedAudioSearchResult> => searchFreesound(query, "effects", options);
