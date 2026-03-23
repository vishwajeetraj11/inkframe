import path from "node:path";
import { fileURLToPath } from "node:url";
import { put } from "@vercel/blob";
import { bundle } from "@remotion/bundler";
import { addBundleToSandbox, createSandbox } from "@remotion/vercel";

const cwd = path.dirname(fileURLToPath(import.meta.url));
const buildDir = ".remotion";
const getSnapshotBlobKey = () =>
  `snapshot-cache/${process.env.VERCEL_DEPLOYMENT_ID ?? "local"}.json`;
const getBlobToken = () =>
  process.env.new_READ_WRITE_TOKEN?.trim() ||
  process.env.BLOB_READ_WRITE_TOKEN?.trim();

const bundleRemotionProject = async () => {
  await bundle({
    entryPoint: path.join(cwd, "src/remotion/index.ts"),
    outDir: path.join(cwd, buildDir),
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
            "@": path.join(cwd, "src"),
          },
        },
      };
    },
  });
};

const run = async () => {
  if (!process.env.VERCEL) {
    console.log("[create-remotion-snapshot] Skipping outside Vercel.");
    return;
  }

  const blobToken = getBlobToken();

  if (!blobToken) {
    console.warn(
      "[create-remotion-snapshot] Skipping because new_READ_WRITE_TOKEN is not configured. Attach a Vercel Blob store or add the token manually to enable Vercel exports.",
    );
    return;
  }

  console.log("[create-remotion-snapshot] Bundling Remotion project...");
  await bundleRemotionProject();

  console.log("[create-remotion-snapshot] Creating sandbox...");
  const sandbox = await createSandbox({
    onProgress: ({ progress, message }) => {
      const pct = Math.round(progress * 100);
      console.log(`[create-remotion-snapshot] ${message} (${pct}%)`);
    },
  });

  try {
    console.log("[create-remotion-snapshot] Uploading bundle to sandbox...");
    await addBundleToSandbox({
      sandbox,
      bundleDir: buildDir,
    });

    console.log("[create-remotion-snapshot] Taking snapshot...");
    const snapshot = await sandbox.snapshot({ expiration: 0 });

    await put(
      getSnapshotBlobKey(),
      JSON.stringify({ snapshotId: snapshot.snapshotId }),
      {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        token: blobToken,
      },
    );

    console.log(
      `[create-remotion-snapshot] Snapshot saved: ${snapshot.snapshotId}`,
    );
  } finally {
    await sandbox.stop({ blocking: false }).catch(() => undefined);
  }
};

run().catch((error) => {
  console.error("[create-remotion-snapshot] Failed.", error);
  process.exitCode = 1;
});
