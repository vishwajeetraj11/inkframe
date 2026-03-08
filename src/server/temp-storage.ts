import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { nanoid } from "nanoid";

export const TEMP_ROOT = path.join(tmpdir(), "editor-shared");
const STALE_MAX_AGE_MS = 15 * 60 * 1000;

export const ensureTempRoot = async (): Promise<void> => {
  await fs.mkdir(TEMP_ROOT, { recursive: true });
};

export const createRequestTempDir = async (): Promise<{
  requestId: string;
  requestDir: string;
}> => {
  await ensureTempRoot();

  const requestId = nanoid(12);
  const requestDir = path.join(TEMP_ROOT, requestId);
  await fs.mkdir(requestDir, { recursive: true });

  return {
    requestId,
    requestDir,
  };
};

export const cleanupPath = async (targetPath: string): Promise<void> => {
  await fs.rm(targetPath, { recursive: true, force: true });
};

export const sanitizeFilename = (filename: string): string => {
  const base = path.basename(filename);
  const normalized = base.replace(/[^a-zA-Z0-9._-]/g, "_");

  if (normalized.length === 0) {
    return "asset.bin";
  }

  return normalized;
};

export const pruneAllTempDirs = async (): Promise<void> => {
  await ensureTempRoot();

  const entries = await fs.readdir(TEMP_ROOT);
  await Promise.all(
    entries.map((entry) => cleanupPath(path.join(TEMP_ROOT, entry))),
  );
};

export const pruneStaleTempDirs = async (
  maxAgeMs: number = STALE_MAX_AGE_MS,
): Promise<void> => {
  await ensureTempRoot();

  const entries = await fs.readdir(TEMP_ROOT, { withFileTypes: true });
  const now = Date.now();

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(TEMP_ROOT, entry.name);
      const stats = await fs.stat(fullPath);
      const age = now - stats.mtimeMs;

      if (age >= maxAgeMs) {
        await cleanupPath(fullPath);
      }
    }),
  );
};
