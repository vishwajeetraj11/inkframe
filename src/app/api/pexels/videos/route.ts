import { getErrorMessage, jsonError } from "@/server/http";
import {
  PexelsApiError,
  searchPexelsVideos,
} from "@/lib/pexels/client";
import { parsePexelsSearchParams } from "@/lib/pexels/validation";
import type { PexelsVideoSearchResult } from "@/lib/pexels/types";
import { fetchPexelsOverIpv4 } from "@/server/pexels-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 100;
const responseCache = new Map<string, { expiresAt: number; value: PexelsVideoSearchResult }>();

const errorResponse = (message: string, status: number, headers?: HeadersInit): Response =>
  Response.json({ error: message }, { status, headers });

const cacheKey = (params: ReturnType<typeof parsePexelsSearchParams>): string =>
  [params.query.toLowerCase(), params.orientation, params.page, params.perPage].join("|");

const cachedSearch = async (
  params: ReturnType<typeof parsePexelsSearchParams>,
  request: Request,
): Promise<PexelsVideoSearchResult> => {
  const key = cacheKey(params);
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  responseCache.delete(key);

  const value = await searchPexelsVideos(params, {
    signal: request.signal,
    fetcher: process.env.NODE_ENV === "test" ? fetch : fetchPexelsOverIpv4,
  });
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
};

export async function GET(request: Request): Promise<Response> {
  if (!process.env.PEXELS_API_KEY) {
    return jsonError("Pexels video search is not configured.", 503);
  }

  try {
    const searchParams = new URL(request.url).searchParams;
    const params = parsePexelsSearchParams({
      query: searchParams.get("query") ?? "",
      orientation: searchParams.get("orientation") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      per_page: searchParams.get("per_page") ?? undefined,
    });
    const result = await cachedSearch(params, request);
    return Response.json(result, {
      headers: {
        "Cache-Control": "private, max-age=60",
        "X-Pexels-Attribution": "https://www.pexels.com/",
      },
    });
  } catch (error) {
    if (error instanceof PexelsApiError) {
      const headers = error.retryAfterSeconds === null
        ? undefined
        : { "Retry-After": String(error.retryAfterSeconds) };
      return errorResponse(error.message, error.status, headers);
    }
    if (error instanceof Error && error.name === "ZodError") {
      return jsonError("Invalid Pexels search parameters.", 400);
    }
    return jsonError(getErrorMessage(error, "Unexpected Pexels search error."), 500);
  }
}
