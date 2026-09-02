import { describe, expect, it } from "vitest";
import { createDefaultClip, createDefaultTextOverlay } from "@/lib/editor/defaults";
import {
  autoFixEditorVersion,
  inspectEditorFrame,
  validateEditorVersion,
} from "@/lib/editor/webmcp/diagnostics";
import type { AssetRef, VersionTimeline } from "@/lib/editor/types";

const assets: AssetRef[] = [
  {
    assetId: "image-1",
    kind: "image",
    mimeType: "image/jpeg",
    name: "Image",
    size: 100,
  },
];

const createVersion = (): VersionTimeline => ({
  aspect: "reel_9_16",
  clips: [createDefaultClip("clip-1", "image-1", "image")],
  textOverlays: [
    {
      ...createDefaultTextOverlay("text-1"),
      text: "Readable title",
      startFrame: 0,
      endFrame: 60,
      fontSize: 56,
      animation: { in: "rise", out: "fade", durationFrames: 10 },
    },
  ],
  audioTracks: [],
  transitions: [],
});

describe("editor WebMCP diagnostics", () => {
  it("marks a healthy browser timeline ready for export", () => {
    const report = validateEditorVersion(createVersion(), assets);

    expect(report.readyForExport).toBe(true);
    expect(report.counts.errors).toBe(0);
    expect(report.durationInFrames).toBe(90);
  });

  it("reports missing assets and unsafe typography", () => {
    const version = createVersion();
    version.textOverlays[0] = {
      ...version.textOverlays[0],
      x: 2,
      fontSize: 20,
      text: "This headline is deliberately far too long for a vertical canvas and keeps going until the wrapped block exceeds the safe region. ".repeat(60),
    };
    const report = validateEditorVersion(version, []);

    expect(report.readyForExport).toBe(false);
    expect(report.issues.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "missing-asset",
        "unsafe-text-position",
        "small-text",
        "possible-text-overflow",
      ]),
    );
  });

  it("conservatively fixes unsafe text without rewriting its copy", () => {
    const version = createVersion();
    version.textOverlays[0] = {
      ...version.textOverlays[0],
      x: -4,
      y: 96,
      fontSize: 12,
      stylePreset: "vox-timeline",
      animation: { in: "rise", out: "fade", durationFrames: 80 },
    };

    const fixed = autoFixEditorVersion(version);

    expect(fixed.version.textOverlays[0]).toMatchObject({
      text: "Readable title",
      x: 6,
      y: 90,
      fontSize: 32,
      stylePreset: "classic",
      animation: { durationFrames: 30 },
    });
    expect(fixed.changes.map((change) => change.field)).toEqual(
      expect.arrayContaining(["x", "y", "fontSize", "stylePreset", "animation"]),
    );
  });

  it("describes exactly what is active at a requested frame", () => {
    const inspection = inspectEditorFrame(createVersion(), 12);

    expect(inspection.activeClips[0]).toMatchObject({ id: "clip-1", assetId: "image-1" });
    expect(inspection.activeTextOverlays[0]).toMatchObject({
      id: "text-1",
      text: "Readable title",
    });
  });
});
