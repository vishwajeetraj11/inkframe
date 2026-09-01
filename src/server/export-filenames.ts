import type { ExportProjectInput } from "@/lib/editor/schema";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const LOCAL_EXPORT_ROOT = path.join(process.cwd(), "exports");
export const LOCAL_EDITOR_EXPORT_DIR = path.join(LOCAL_EXPORT_ROOT, "editor");

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getPrimaryEditorTemplateSlug = (
  timeline: ExportProjectInput["versions"][ExportProjectInput["activeVersion"]],
): string => {
  const primaryOverlay = [...timeline.textOverlays].sort(
    (left, right) => left.startFrame - right.startFrame || left.endFrame - right.endFrame,
  )[0];

  return primaryOverlay?.stylePreset ?? "custom";
};

export const buildEditorExportFilenamePrefix = (
  project: ExportProjectInput,
): string => {
  const activeTimeline = project.versions[project.activeVersion];
  const templateSlug = getPrimaryEditorTemplateSlug(activeTimeline);

  return `${project.activeVersion}-${templateSlug}`;
};

export const buildEditorExportFilenameForRequest = (
  project: ExportProjectInput,
  requestId: string,
): string => {
  const safeRequestId = requestId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!safeRequestId) {
    throw new Error("A valid export request ID is required.");
  }

  return `${buildEditorExportFilenamePrefix(project)}-${safeRequestId}.mp4`;
};

export const getNextAvailableMp4Filename = async ({
  directory,
  prefix,
}: {
  directory: string;
  prefix: string;
}): Promise<string> => {
  await mkdir(directory, { recursive: true });

  const entries = await readdir(directory, { withFileTypes: true });
  const exactMatcher = new RegExp(`^${escapeRegex(prefix)}\\.mp4$`, "i");
  const sequencedMatcher = new RegExp(`^${escapeRegex(prefix)}(\\d+)\\.mp4$`, "i");
  const takenSequences = new Set<number>();
  let exactExists = false;

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    if (exactMatcher.test(entry.name)) {
      exactExists = true;
      continue;
    }

    const match = entry.name.match(sequencedMatcher);
    if (!match) {
      continue;
    }

    const sequence = Number.parseInt(match[1] ?? "", 10);
    if (Number.isFinite(sequence) && sequence > 0) {
      takenSequences.add(sequence);
    }
  }

  if (!exactExists) {
    return `${prefix}.mp4`;
  }

  let nextSequence = 1;
  while (takenSequences.has(nextSequence)) {
    nextSequence += 1;
  }

  return `${prefix}${nextSequence}.mp4`;
};

export const getNextEditorExportFilename = async (
  project: ExportProjectInput,
): Promise<string> =>
  getNextAvailableMp4Filename({
    directory: LOCAL_EDITOR_EXPORT_DIR,
    prefix: buildEditorExportFilenamePrefix(project),
  });
