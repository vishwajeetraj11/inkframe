import { exportProjectSchema } from "@/lib/editor/schema";
import { jsonError, getErrorMessage } from "@/server/http";
import { ensureStartupCleanup } from "@/server/startup";
import { exportEditorProjectToBuffer } from "@/server/services/editor-export-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

ensureStartupCleanup();

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const projectField = formData.get("project");

    if (typeof projectField !== "string") {
      return jsonError("Missing project payload.", 400);
    }

    let parsedProjectJson: unknown;

    try {
      parsedProjectJson = JSON.parse(projectField);
    } catch {
      return jsonError("Invalid project JSON.", 400);
    }

    const projectParse = exportProjectSchema.safeParse(parsedProjectJson);
    if (!projectParse.success) {
      return jsonError(projectParse.error.issues[0]?.message ?? "Invalid project.", 400);
    }

    const files = formData
      .getAll("assets")
      .filter((value): value is File => value instanceof File);

    const result = await exportEditorProjectToBuffer({
      project: projectParse.data,
      files,
    });

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
      getErrorMessage(error, "Unexpected export error. Please try again."),
      500,
    );
  }
}
