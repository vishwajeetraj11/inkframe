import { MAX_DURATION_FRAMES } from "@/lib/editor/constants";
import type { ExportProjectInput } from "@/lib/editor/schema";
import { getVersionRenderDurationInFrames } from "@/lib/editor/timeline";
import type { AspectPreset } from "@/lib/editor/types";
import type { TextMotionProject } from "@/lib/text-motion/types";
import { getTextMotionDurationInFrames } from "@/lib/text-motion/utils";
import type { EditorCompositionProps } from "@/remotion/EditorComposition";
import type { TextMotionCompositionProps } from "@/remotion/TextMotionComposition";
import { get, getDownloadUrl } from "@vercel/blob";
import { renderMedia, selectComposition } from "@remotion/renderer";
import {
  renderMediaOnVercel,
  uploadToVercelBlob,
} from "@remotion/vercel";
import { Sandbox } from "@vercel/sandbox";
import { createRequire } from "node:module";
import path from "node:path";
import {
  getVercelBlobToken,
  shouldUseVercelSandboxRender,
} from "./rendering-environment";

let bundleDirPromise: Promise<string> | null = null;
const nodeRequire = createRequire(import.meta.url);

export interface SandboxWriteFile {
  path: string;
  content: Buffer;
  mode?: number;
}

export type RenderedMediaResult =
  | {
      kind: "file";
      outputPath: string;
    }
  | {
      kind: "download-url";
      downloadUrl: string;
    };

const EDITOR_COMPOSITION_ID_BY_ASPECT: Record<AspectPreset, string> = {
  reel_9_16: "reel-9-16",
  widescreen_16_9: "widescreen-16-9",
};

const TEXT_MOTION_COMPOSITION_ID_BY_ASPECT: Record<AspectPreset, string> = {
  reel_9_16: "text-motion-reel-9-16",
  widescreen_16_9: "text-motion-widescreen-16-9",
};

const getEditorRenderDurationInFrames = (
  project: ExportProjectInput,
): number => {
  const version = project.versions[project.activeVersion];
  const duration = getVersionRenderDurationInFrames(version);
  return Math.max(1, Math.min(MAX_DURATION_FRAMES, duration));
};

const getSnapshotBlobKey = (): string =>
  `snapshot-cache/${process.env.VERCEL_DEPLOYMENT_ID ?? "local"}.json`;

const getBundleDir = async (): Promise<string> => {
  if (!bundleDirPromise) {
    bundleDirPromise = Promise.resolve()
      .then(() => {
        const { bundle } = nodeRequire("@remotion/bundler") as typeof import("@remotion/bundler");

        return bundle({
          entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
          webpackOverride: (currentConfig) => {
            const existingAlias =
              currentConfig.resolve &&
              currentConfig.resolve.alias &&
              !Array.isArray(currentConfig.resolve.alias)
                ? currentConfig.resolve.alias
                : {};

            return {
              ...currentConfig,
              resolve: {
                ...currentConfig.resolve,
                alias: {
                  ...existingAlias,
                  "@": path.join(process.cwd(), "src"),
                },
              },
            };
          },
        });
      })
      .catch((error) => {
        bundleDirPromise = null;
        throw error;
      });
  }

  try {
    return await bundleDirPromise;
  } catch (error) {
    bundleDirPromise = null;
    throw error;
  }
};

const restoreSandboxSnapshot = async (): Promise<Sandbox> => {
  const blobToken = getVercelBlobToken();
  const snapshotBlob = await get(getSnapshotBlobKey(), {
    access: "public",
    token: blobToken,
  });

  if (!snapshotBlob || snapshotBlob.statusCode !== 200) {
    throw new Error(
      "No Remotion sandbox snapshot found for this deployment. Redeploy so the build can create one.",
    );
  }

  const response = new Response(snapshotBlob.stream);
  const snapshotPayload = (await response.json()) as { snapshotId?: string };

  if (!snapshotPayload.snapshotId) {
    throw new Error(
      "The stored Remotion sandbox snapshot is invalid. Redeploy to refresh it.",
    );
  }

  return Sandbox.create({
    source: {
      type: "snapshot",
      snapshotId: snapshotPayload.snapshotId,
    },
    timeout: 5 * 60 * 1000,
  });
};

const renderCompositionLocally = async ({
  compositionId,
  inputProps,
  outputLocation,
  frameRange,
}: {
  compositionId: string;
  inputProps: Record<string, unknown>;
  outputLocation: string;
  frameRange: [number, number];
}): Promise<RenderedMediaResult> => {
  const serveUrl = await getBundleDir();
  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps,
    logLevel: "error",
  });

  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    inputProps,
    outputLocation,
    overwrite: true,
    logLevel: "error",
    frameRange,
  });

  return {
    kind: "file",
    outputPath: outputLocation,
  };
};

const renderCompositionOnVercel = async ({
  compositionId,
  inputProps,
  outputLocation,
  frameRange,
  blobPath,
  sandboxFiles,
}: {
  compositionId: string;
  inputProps: Record<string, unknown>;
  outputLocation: string;
  frameRange: [number, number];
  blobPath: string;
  sandboxFiles?: SandboxWriteFile[];
}): Promise<RenderedMediaResult> => {
  const blobToken = getVercelBlobToken();
  const sandbox = await restoreSandboxSnapshot();

  try {
    if (sandboxFiles && sandboxFiles.length > 0) {
      await sandbox.writeFiles(sandboxFiles);
    }

    const rendered = await renderMediaOnVercel({
      sandbox,
      compositionId,
      inputProps,
      outputFile: `/tmp/${path.basename(outputLocation)}`,
      frameRange,
      codec: "h264",
      logLevel: "error",
    });

    const uploaded = await uploadToVercelBlob({
      sandbox,
      sandboxFilePath: rendered.sandboxFilePath,
      contentType: rendered.contentType,
      blobToken,
      access: "public",
      blobPath,
    });

    return {
      kind: "download-url",
      downloadUrl: getDownloadUrl(uploaded.url),
    };
  } finally {
    await sandbox.stop({ blocking: false }).catch(() => undefined);
  }
};

const renderComposition = async ({
  compositionId,
  inputProps,
  outputLocation,
  frameRange,
  blobPath,
  sandboxFiles,
}: {
  compositionId: string;
  inputProps: Record<string, unknown>;
  outputLocation: string;
  frameRange: [number, number];
  blobPath: string;
  sandboxFiles?: SandboxWriteFile[];
}): Promise<RenderedMediaResult> => {
  if (shouldUseVercelSandboxRender()) {
    return renderCompositionOnVercel({
      compositionId,
      inputProps,
      outputLocation,
      frameRange,
      blobPath,
      sandboxFiles,
    });
  }

  return renderCompositionLocally({
    compositionId,
    inputProps,
    outputLocation,
    frameRange,
  });
};

export const renderProject = async ({
  project,
  assetSources,
  outputLocation,
  blobPath,
  sandboxFiles,
}: {
  project: ExportProjectInput;
  assetSources: Record<string, string>;
  outputLocation: string;
  blobPath: string;
  sandboxFiles?: SandboxWriteFile[];
}): Promise<RenderedMediaResult> => {
  const version = project.versions[project.activeVersion];
  const durationInFrames = getEditorRenderDurationInFrames(project);
  const inputProps: EditorCompositionProps = {
    version,
    assetSources,
    renderMode: "render",
  };

  return renderComposition({
    compositionId: EDITOR_COMPOSITION_ID_BY_ASPECT[project.activeVersion],
    inputProps,
    outputLocation,
    frameRange: [0, Math.max(0, durationInFrames - 1)],
    blobPath,
    sandboxFiles,
  });
};

export const renderTextMotionProject = async ({
  project,
  outputLocation,
  blobPath,
}: {
  project: TextMotionProject;
  outputLocation: string;
  blobPath: string;
}): Promise<RenderedMediaResult> => {
  const inputProps: TextMotionCompositionProps = {
    project,
  };
  const durationInFrames = getTextMotionDurationInFrames(project);

  return renderComposition({
    compositionId: TEXT_MOTION_COMPOSITION_ID_BY_ASPECT[project.aspect],
    inputProps,
    outputLocation,
    frameRange: [0, Math.max(0, durationInFrames - 1)],
    blobPath,
  });
};
