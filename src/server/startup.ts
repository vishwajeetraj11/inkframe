import { pruneAllTempDirs } from "@/server/temp-storage";

let initialized = false;

export const ensureStartupCleanup = (): void => {
  if (initialized) {
    return;
  }

  initialized = true;
  void pruneAllTempDirs();
};
