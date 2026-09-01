import { getFilenameFromContentDisposition } from "@/lib/export/download";
import type { ExportProjectInput } from "@/lib/editor/schema";
import {
  buildEditorExportFilenameForRequest,
  buildEditorExportFilenamePrefix,
  getNextAvailableMp4Filename,
} from "@/server/export-filenames";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const createEditorExportProject = (): ExportProjectInput => ({
  activeVersion: "widescreen_16_9",
  versions: {
    reel_9_16: {
      aspect: "reel_9_16",
      clips: [],
      textOverlays: [],
      audioTracks: [],
      transitions: [],
    },
    widescreen_16_9: {
      aspect: "widescreen_16_9",
      clips: [],
      textOverlays: [
        {
          id: "text-1",
          text: "Why this border mattered",
          startFrame: 0,
          endFrame: 180,
          x: 8,
          y: 10,
          fontSize: 80,
          color: "#111111",
          fontFamily: "serif",
          fontWeight: 700,
          fontStyle: "normal",
          stylePreset: "regional-map-focus",
          createdaleyTexture: "plain",
          syncMediaToTimelineEvents: false,
        },
      ],
      audioTracks: [],
      transitions: [],
    },
  },
  assets: [],
});

describe("editor export filenames", () => {
  let tempDir: string | null = null;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("builds the export prefix from the active aspect and template", () => {
    expect(buildEditorExportFilenamePrefix(createEditorExportProject())).toBe(
      "widescreen_16_9-regional-map-focus",
    );
  });

  it("builds a request-scoped filename without touching persistent storage", () => {
    expect(
      buildEditorExportFilenameForRequest(
        createEditorExportProject(),
        "request-abc_123",
      ),
    ).toBe("widescreen_16_9-regional-map-focus-request-abc_123.mp4");
  });

  it("increments the next available export number from the filesystem", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "editor-export-filenames-"));

    await writeFile(
      path.join(tempDir, "widescreen_16_9-regional-map-focus.mp4"),
      "base",
    );
    await writeFile(
      path.join(tempDir, "widescreen_16_9-regional-map-focus1.mp4"),
      "a",
    );
    await writeFile(
      path.join(tempDir, "widescreen_16_9-regional-map-focus2.mp4"),
      "b",
    );
    await writeFile(
      path.join(tempDir, "widescreen_16_9-world-map-focus1.mp4"),
      "c",
    );

    await expect(
      getNextAvailableMp4Filename({
        directory: tempDir,
        prefix: "widescreen_16_9-regional-map-focus",
      }),
    ).resolves.toBe("widescreen_16_9-regional-map-focus3.mp4");
  });

  it("uses the plain filename when no matching export exists yet", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "editor-export-filenames-"));

    await writeFile(
      path.join(tempDir, "widescreen_16_9-world-map-focus1.mp4"),
      "other",
    );

    await expect(
      getNextAvailableMp4Filename({
        directory: tempDir,
        prefix: "widescreen_16_9-regional-map-focus",
      }),
    ).resolves.toBe("widescreen_16_9-regional-map-focus.mp4");
  });
});

describe("download filename parsing", () => {
  it("reads the filename from a quoted content-disposition header", () => {
    expect(
      getFilenameFromContentDisposition(
        'attachment; filename="widescreen_16_9-regional-map-focus3.mp4"',
      ),
    ).toBe("widescreen_16_9-regional-map-focus3.mp4");
  });

  it("reads the filename from a UTF-8 content-disposition header", () => {
    expect(
      getFilenameFromContentDisposition(
        "attachment; filename*=UTF-8''widescreen_16_9-regional-map-focus4.mp4",
      ),
    ).toBe("widescreen_16_9-regional-map-focus4.mp4");
  });
});
