import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { put } from "@vercel/blob";
import { bundle } from "@remotion/bundler";
import { createSandbox } from "@remotion/vercel";

const cwd = path.dirname(fileURLToPath(import.meta.url));
const buildDir = ".remotion";
const sandboxBundleDir = "remotion-bundle";
const getSnapshotBlobKey = () =>
  `snapshot-cache/${process.env.VERCEL_DEPLOYMENT_ID ?? "local"}.json`;
const getBlobToken = () =>
  process.env.new_READ_WRITE_TOKEN?.trim() ||
  process.env.BLOB_READ_WRITE_TOKEN?.trim();

const getBundleFiles = async (bundleRootDir) => {
  const files = [];

  const walk = async (directory, basePath = "") => {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      const relativePath = path.join(basePath, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath, relativePath);
        continue;
      }

      files.push({
        path: relativePath,
        content: await readFile(fullPath),
      });
    }
  };

  await walk(bundleRootDir);
  return files;
};

const mkdirIfMissing = async (sandbox, dirPath) => {
  try {
    await sandbox.mkDir(dirPath);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);

    if (message.includes("File exists")) {
      return;
    }

    throw error;
  }
};

const uploadBundleToSandbox = async (sandbox) => {
  const bundleRootDir = path.join(cwd, buildDir);
  const bundleFiles = await getBundleFiles(bundleRootDir);
  const bundleDirs = new Set();

  for (const file of bundleFiles) {
    const dir = path.dirname(file.path);

    if (dir && dir !== ".") {
      bundleDirs.add(dir);
    }
  }

  await mkdirIfMissing(sandbox, sandboxBundleDir);

  for (const dir of Array.from(bundleDirs).sort((left, right) => {
    const depthDiff = left.split(path.sep).length - right.split(path.sep).length;
    return depthDiff || left.localeCompare(right);
  })) {
    await mkdirIfMissing(sandbox, `${sandboxBundleDir}/${dir}`);
  }

  await sandbox.writeFiles(
    bundleFiles.map((file) => ({
      path: `${sandboxBundleDir}/${file.path}`,
      content: file.content,
    })),
  );
};

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
    await uploadBundleToSandbox(sandbox);

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
