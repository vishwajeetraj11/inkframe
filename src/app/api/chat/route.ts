import { getErrorMessage, jsonError } from "@/server/http";
import { parseEditorContext, streamEditorChat } from "@/server/services/chat-service";
import type { UIMessage } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!process.env.OPENAI_API_KEY) {
    return jsonError("Missing OPENAI_API_KEY environment variable.", 500);
  }

  try {
    const body = await request.json();
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
    return jsonError(getErrorMessage(error, "Unexpected chat server error."), 500);
  }
}
