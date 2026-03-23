import { textMotionProjectSchema } from "@/lib/text-motion/schema";
import { getErrorMessage, jsonError } from "@/server/http";
import { ensureStartupCleanup } from "@/server/startup";
import { exportTextMotionProject } from "@/server/services/text-motion-export-service";

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

    const result = await exportTextMotionProject(parsed.data);

    if (result.kind === "download-url") {
      return Response.json(
        {
          downloadUrl: result.downloadUrl,
          filename: result.filename,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
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
