import { StockAudioApiError, parseLicensedAudioSearch, searchJamendoMusic } from "@/lib/stock-audio";
import { getErrorMessage, jsonError } from "@/server/http";
import { checkRateLimit } from "@/server/request-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const rateLimit = checkRateLimit(request, { bucket: "licensed-music", limit: 40, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;
  if (!process.env.JAMENDO_CLIENT_ID) return jsonError("Jamendo music search is not configured.", 503);
  try {
    const query = parseLicensedAudioSearch({ query: new URL(request.url).searchParams.get("query") ?? "" }).query;
    return Response.json(await searchJamendoMusic(query, { signal: request.signal }), {
      headers: { ...rateLimit.headers, "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    if (error instanceof StockAudioApiError) return jsonError(error.message, error.status);
    if (error instanceof Error && error.name === "ZodError") return jsonError("Invalid music search parameters.", 400);
    return jsonError(getErrorMessage(error, "Unexpected music search error."), 500);
  }
}
