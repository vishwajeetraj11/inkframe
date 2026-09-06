import type { ProjectSession } from "./types";
import { persistedProjectSchema } from "./schema";
import { sanitizeVersion } from "./domain/version";

export const PROJECT_CONTENT_VERSION = 1 as const;

/** Upgrade content independently of the IndexedDB asset-storage layout. */
export const migrateProjectContent = (input: unknown): ProjectSession => {
  if (
    typeof input === "object" && input !== null &&
    "contentVersion" in input && input.contentVersion !== undefined &&
    input.contentVersion !== PROJECT_CONTENT_VERSION
  ) {
    throw new Error("The saved project uses an unsupported content version.");
  }
  const parsed = persistedProjectSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("The saved project is invalid or from an unsupported editor version.");
  }

  const versions: ProjectSession["versions"] = { ...parsed.data.versions };
  for (const aspect of ["reel_9_16", "widescreen_16_9"] as const) {
    const original = versions[aspect];
    if (original.aspect !== aspect) {
      throw new Error(`The saved ${aspect} timeline has an invalid aspect.`);
    }
    const normalized = sanitizeVersion(original);
    if (!normalized) {
      throw new Error(`The saved ${aspect} timeline has invalid placement or exceeds the duration limit.`);
    }
    // Legacy Elah rendered stored placement directly and centered transitions
    // at cuts. A migration must never repack clips or subtract transition time.
    if (original.clips.some((clip, index) => {
      const next = normalized.clips[index];
      return !next || clip.startFrame !== next.startFrame ||
        clip.endFrame !== next.endFrame ||
        clip.trimStartFrame !== next.trimStartFrame ||
        clip.trimEndFrame !== next.trimEndFrame;
    }) || original.transitions.length !== normalized.transitions.length ||
      original.transitions.some((transition, index) => {
        const next = normalized.transitions[index];
        return !next || next.fromClipId !== transition.fromClipId ||
          next.toClipId !== transition.toClipId ||
          next.durationInFrames !== transition.durationInFrames;
      })) {
      throw new Error(`The saved ${aspect} timeline cannot be migrated without changing its timing.`);
    }
    versions[aspect] = normalized;
  }
  return { ...parsed.data, contentVersion: PROJECT_CONTENT_VERSION, versions };
};
