import {
  extractAssetIdFromUploadedFilename,
  validateUploadedAssetFile,
  type ExportProjectInput,
} from "@/lib/editor/schema";
import { collectUsedAssetIds } from "@/lib/editor/timeline";
import {
  renderProject,
  type SandboxWriteFile,
} from "@/server/render-service";
import {
  buildEditorExportFilenameForRequest,
  getNextEditorExportFilename,
  LOCAL_EDITOR_EXPORT_DIR,
} from "@/server/export-filenames";
import { shouldUseVercelSandboxRender } from "@/server/rendering-environment";
import { sanitizeFilename } from "@/server/temp-storage";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ExportResult } from "./export-types";
import { withRequestTempDir } from "./request-temp-dir";

export const exportEditorProject = async ({
  project,
  files,
}: {
  project: ExportProjectInput;
  files: File[];
}): Promise<ExportResult> =>
  withRequestTempDir(async ({ requestDir, requestId }) => {
    const useVercelSandbox = shouldUseVercelSandboxRender();
    const activeVersion = project.versions[project.activeVersion];
    const usedAssetIds = collectUsedAssetIds(activeVersion);
    const exportFilename = useVercelSandbox
      ? buildEditorExportFilenameForRequest(project, requestId)
      : await getNextEditorExportFilename(project);

    const assetsDir = path.join(requestDir, "assets");
    const outputPath = path.join(requestDir, `${requestId}-${exportFilename}`);
    await mkdir(assetsDir, { recursive: true });

    const assetMetaById = new Map(project.assets.map((asset) => [asset.assetId, asset]));
    const storedAssetPathById = new Map<string, string>();
    const inlineImageSourceById = new Map<string, string>();
    const sandboxAssetPathById = new Map<string, string>();
    const sandboxFiles: SandboxWriteFile[] = [];

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

      if (useVercelSandbox && assetMeta.kind !== "image") {
        const sandboxPath = `/tmp/${assetId}-${safeFilename}`;
        sandboxAssetPathById.set(assetId, sandboxPath);
        sandboxFiles.push({
          path: sandboxPath,
          content: fileBuffer,
        });
      }

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

      if (assetMeta?.externalUrl) {
        assetSources[usedAssetId] = assetMeta.externalUrl;
        continue;
      }

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

      if (useVercelSandbox) {
        const sandboxPath = sandboxAssetPathById.get(usedAssetId);

        if (!sandboxPath) {
          throw new Error(`Missing sandbox file for required asset ${usedAssetId}.`);
        }

        assetSources[usedAssetId] = pathToFileURL(sandboxPath).toString();
        continue;
      }

      assetSources[usedAssetId] = pathToFileURL(resolvedPath).toString();
    }

    const renderResult = await renderProject({
      project,
      assetSources,
      outputLocation: outputPath,
      blobPath: path.posix.join(
        "exports",
        "editor",
        exportFilename,
      ),
      sandboxFiles,
    });

    if (renderResult.kind === "download-url") {
      return {
        kind: "download-url",
        downloadUrl: renderResult.downloadUrl,
        filename: exportFilename,
      };
    }

    await mkdir(LOCAL_EDITOR_EXPORT_DIR, { recursive: true });
    const persistedOutputPath = path.join(LOCAL_EDITOR_EXPORT_DIR, exportFilename);
    await copyFile(outputPath, persistedOutputPath);

    return {
      kind: "buffer",
      buffer: await readFile(persistedOutputPath),
      contentType: "video/mp4",
      filename: exportFilename,
    };
  });
