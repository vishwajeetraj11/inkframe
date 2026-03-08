import {
  cleanupPath,
  createRequestTempDir,
  pruneStaleTempDirs,
} from "@/server/temp-storage";

export const withRequestTempDir = async <T>(
  run: (context: { requestId: string; requestDir: string }) => Promise<T>,
): Promise<T> => {
  const context = await createRequestTempDir();

  try {
    return await run(context);
  } finally {
    await cleanupPath(context.requestDir);
    await pruneStaleTempDirs();
  }
};
