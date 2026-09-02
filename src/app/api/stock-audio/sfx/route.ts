import { StockAudioApiError, parseLicensedAudioSearch, searchFreesoundEffects } from "@/lib/stock-audio";
import { getErrorMessage, jsonError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!process.env.FREESOUND_API_KEY) return jsonError("Freesound effects search is not configured.", 503);
  try {
    const query = parseLicensedAudioSearch({ query: new URL(request.url).searchParams.get("query") ?? "" }).query;
    return Response.json(await searchFreesoundEffects(query, { signal: request.signal }), {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    if (error instanceof StockAudioApiError) return jsonError(error.message, error.status);
    if (error instanceof Error && error.name === "ZodError") return jsonError("Invalid sound-effect search parameters.", 400);
    return jsonError(getErrorMessage(error, "Unexpected sound-effect search error."), 500);
  }
}
