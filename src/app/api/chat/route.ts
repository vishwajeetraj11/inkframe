import { getErrorMessage, jsonError } from "@/server/http";
import { parseEditorContext, streamEditorChat } from "@/server/services/chat-service";
import type { UIMessage } from "ai";
import { checkRateLimit, readJsonBody, RequestBodyError } from "@/server/request-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const rateLimit = checkRateLimit(request, { bucket: "editor-chat", limit: 12, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;
  if (!process.env.OPENAI_API_KEY) {
    return jsonError("Missing OPENAI_API_KEY environment variable.", 500);
  }

  try {
    const body = await readJsonBody<{ messages?: UIMessage[]; editorContext?: unknown }>(request, 256_000);
    const messages = body?.messages as UIMessage[] | undefined;
    const editorContext = parseEditorContext(body?.editorContext);

    if (!Array.isArray(messages)) {
      return jsonError("Invalid chat payload.", 400);
    }

    const result = await streamEditorChat({
      messages,
      editorContext,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    if (error instanceof RequestBodyError) return jsonError(error.message, error.status);
    return jsonError(getErrorMessage(error, "Unexpected chat server error."), 500);
  }
}
