import {
  extractAssetIdFromUploadedFilename,
  validateUploadedAssetFile,
  type ExportProjectInput,
} from "@/lib/editor/schema";
import { collectUsedAssetIds } from "@/lib/editor/timeline";
import { renderProjectToFile } from "@/server/render-service";
import { sanitizeFilename } from "@/server/temp-storage";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { withRequestTempDir } from "./request-temp-dir";

export interface EditorExportResult {
  buffer: Buffer;
  filename: string;
}

export const exportEditorProjectToBuffer = async ({
  project,
  files,
}: {
  project: ExportProjectInput;
  files: File[];
}): Promise<EditorExportResult> =>
  withRequestTempDir(async ({ requestDir, requestId }) => {
    const activeVersion = project.versions[project.activeVersion];
    const usedAssetIds = collectUsedAssetIds(activeVersion);

    if (usedAssetIds.size > 0 && files.length === 0) {
      throw new Error("Missing uploaded files for timeline media assets.");
    }

    const assetsDir = path.join(requestDir, "assets");
    const outputPath = path.join(requestDir, `${project.activeVersion}-${requestId}.mp4`);
    await mkdir(assetsDir, { recursive: true });

    const assetMetaById = new Map(project.assets.map((asset) => [asset.assetId, asset]));
    const storedAssetPathById = new Map<string, string>();
    const inlineImageSourceById = new Map<string, string>();

    for (const file of files) {
      const assetId = extractAssetIdFromUploadedFilename(file.name);
      if (!assetId) {
        throw new Error(`Invalid uploaded filename format for ${file.name}.`);
      }

      if (storedAssetPathById.has(assetId)) {
        throw new Error(`Duplicate upload for asset ${assetId}.`);
      }

      const assetMeta = assetMetaById.get(assetId);
      if (!assetMeta) {
        throw new Error(`Unknown asset upload: ${assetId}.`);
      }

      const fileValidationMessage = validateUploadedAssetFile(file, assetMeta.kind);
      if (fileValidationMessage) {
        throw new Error(fileValidationMessage);
      }

      const filenameFromClient = file.name.includes("__")
        ? file.name.split("__").slice(1).join("__")
        : file.name;
      const safeFilename = sanitizeFilename(filenameFromClient || assetMeta.name);
      const targetPath = path.join(assetsDir, `${assetId}-${safeFilename}`);

      const arrayBuffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);
      await writeFile(targetPath, fileBuffer);
      storedAssetPathById.set(assetId, targetPath);

      if (assetMeta.kind === "image") {
        const imageMimeType = (file.type || assetMeta.mimeType || "").trim();
        if (imageMimeType.startsWith("image/")) {
          inlineImageSourceById.set(
            assetId,
            `data:${imageMimeType};base64,${fileBuffer.toString("base64")}`,
          );
        }
      }
    }

    const assetSources: Record<string, string> = {};

    for (const usedAssetId of usedAssetIds) {
      const assetMeta = assetMetaById.get(usedAssetId);
      const resolvedPath = storedAssetPathById.get(usedAssetId);
      if (!resolvedPath) {
        throw new Error(`Missing uploaded file for required asset ${usedAssetId}.`);
      }

      if (assetMeta?.kind === "image") {
        const inlineImageSource = inlineImageSourceById.get(usedAssetId);
        if (inlineImageSource) {
          assetSources[usedAssetId] = inlineImageSource;
          continue;
        }
      }

      assetSources[usedAssetId] = pathToFileURL(resolvedPath).toString();
    }

    await renderProjectToFile({
      project,
      assetSources,
      outputLocation: outputPath,
    });

    return {
      buffer: await readFile(outputPath),
      filename: `${project.activeVersion}.mp4`,
    };
  });
