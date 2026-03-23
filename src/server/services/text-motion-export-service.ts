import type { TextMotionProject } from "@/lib/text-motion/types";
import { renderTextMotionProject } from "@/server/render-service";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ExportResult } from "./export-types";
import { withRequestTempDir } from "./request-temp-dir";

export const exportTextMotionProject = async (
  project: TextMotionProject,
): Promise<ExportResult> =>
  withRequestTempDir(async ({ requestDir, requestId }) => {
    const outputPath = path.join(
      requestDir,
      `text-motion-${project.aspect}-${requestId}.mp4`,
    );

    const renderResult = await renderTextMotionProject({
      project,
      outputLocation: outputPath,
      blobPath: path.posix.join(
        "exports",
        "text-motion",
        `text-motion-${project.aspect}-${requestId}.mp4`,
      ),
    });

    if (renderResult.kind === "download-url") {
      return {
        kind: "download-url",
        downloadUrl: renderResult.downloadUrl,
        filename: `text-motion-${project.aspect}.mp4`,
      };
    }

    return {
      kind: "buffer",
      buffer: await readFile(outputPath),
      contentType: "video/mp4",
      filename: `text-motion-${project.aspect}.mp4`,
    };
  });
