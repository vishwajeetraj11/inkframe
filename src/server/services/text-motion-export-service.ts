import type { TextMotionProject } from "@/lib/text-motion/types";
import { renderTextMotionProjectToFile } from "@/server/render-service";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { withRequestTempDir } from "./request-temp-dir";

export interface TextMotionExportResult {
  buffer: Buffer;
  filename: string;
}

export const exportTextMotionProjectToBuffer = async (
  project: TextMotionProject,
): Promise<TextMotionExportResult> =>
  withRequestTempDir(async ({ requestDir, requestId }) => {
    const outputPath = path.join(
      requestDir,
      `text-motion-${project.aspect}-${requestId}.mp4`,
    );

    await renderTextMotionProjectToFile({
      project,
      outputLocation: outputPath,
    });

    return {
      buffer: await readFile(outputPath),
      filename: `text-motion-${project.aspect}.mp4`,
    };
  });
