import { textMotionGenerateInputSchema } from "@/lib/text-motion/schema";
import { getErrorMessage, jsonError } from "@/server/http";
import { generateTextMotionProject } from "@/server/services/text-motion-generate-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!process.env.OPENAI_API_KEY) {
    return jsonError("Missing OPENAI_API_KEY environment variable.", 500);
  }

  try {
    const payload = await request.json();
    const parsedInput = textMotionGenerateInputSchema.safeParse(payload);

    if (!parsedInput.success) {
      return jsonError(parsedInput.error.issues[0]?.message ?? "Invalid input.", 400);
    }

    const project = await generateTextMotionProject(parsedInput.data);

    return Response.json({ project });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Generation failed."), 500);
  }
}
