import { textMotionProjectSchema } from "@/lib/text-motion/schema";
import { getErrorMessage, jsonError } from "@/server/http";
import { ensureStartupCleanup } from "@/server/startup";
import { exportTextMotionProjectToBuffer } from "@/server/services/text-motion-export-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

ensureStartupCleanup();

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const parsed = textMotionProjectSchema.safeParse(body?.project);

    if (!parsed.success) {
      return jsonError(
        parsed.error.issues[0]?.message ?? "Invalid text motion project.",
        400,
      );
    }

    const result = await exportTextMotionProjectToBuffer(parsed.data);

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(
      getErrorMessage(error, "Failed to export text motion video."),
      500,
    );
  }
}
