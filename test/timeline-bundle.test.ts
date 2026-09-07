import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import {
  createFcpxmlMediaBundle,
  planFcpxmlMediaBundle,
} from "@/lib/export/timeline-bundle";
import type { VersionTimeline } from "@/lib/editor/types";

const version: VersionTimeline = {
  aspect: "widescreen_16_9",
  clips: [{
    id: "clip",
    assetId: "video/one",
    kind: "video",
    startFrame: 0,
    endFrame: 30,
    trimStartFrame: 0,
    trimEndFrame: 30,
    volume: 1,
  }],
  textOverlays: [],
  audioTracks: [],
  transitions: [],
};

describe("FCPXML media bundles", () => {
  it("packages stored media, a relative FCPXML reference, manifest, and instructions", async () => {
    const plan = planFcpxmlMediaBundle({
      version,
      assets: [{
        assetId: "video/one",
        kind: "video",
        mimeType: "video/mp4",
        name: "../Interview: take?.mp4",
        size: 5,
        externalUrl: "https://cdn.example.com/interview.mp4",
        file: new Blob(["video"], { type: "video/mp4" }),
      }],
    });

    expect(plan.content).toContain("Media/0001-video-one-Interview-%20take-.mp4");
    expect(plan.content).not.toContain("https://cdn.example.com/interview.mp4");
    expect(plan.diagnostics.map((item) => item.code)).not.toContain("FCPXML_OFFLINE_ASSET");

    const bundle = await createFcpxmlMediaBundle(plan);
    const archive = unzipSync(new Uint8Array(await bundle.blob.arrayBuffer()));
    expect(Object.keys(archive).sort()).toEqual([
      "Media/0001-video-one-Interview- take-.mp4",
      "README.txt",
      "relink-manifest.json",
      "timeline.fcpxml",
    ]);
    expect(strFromU8(archive["timeline.fcpxml"]!)).toBe(plan.content);
    expect(JSON.parse(strFromU8(archive["relink-manifest.json"]!))).toMatchObject({
      version: 1,
      assets: [{ assetId: "video/one", archivePath: "Media/0001-video-one-Interview- take-.mp4" }],
      looks: [],
    });
    expect(bundle).toMatchObject({ includedMedia: 1, linkedMedia: 0, includedLooks: 0 });
  });

  it("blocks a bundle when neither media bytes nor a durable URL exist", async () => {
    const plan = planFcpxmlMediaBundle({
      version,
      assets: [{
        assetId: "video/one",
        kind: "video",
        mimeType: "video/mp4",
        name: "offline.mp4",
        size: 5,
      }],
    });
    expect(plan.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "error", code: "BUNDLE_MEDIA_UNAVAILABLE" }),
    );
    await expect(createFcpxmlMediaBundle(plan)).rejects.toThrow("neither stored media bytes");
  });

  it("keeps a durable provider URL when stored bytes are unavailable", async () => {
    const plan = planFcpxmlMediaBundle({
      version,
      assets: [{
        assetId: "video/one",
        kind: "video",
        mimeType: "video/mp4",
        name: "remote.mp4",
        size: 5,
        externalUrl: "https://cdn.example.com/remote.mp4",
      }],
    });
    expect(plan.content).toContain("https://cdn.example.com/remote.mp4");
    expect(plan.manifest.assets[0]).toMatchObject({
      assetId: "video/one",
      externalUrl: "https://cdn.example.com/remote.mp4",
    });
    const bundle = await createFcpxmlMediaBundle(plan);
    expect(bundle).toMatchObject({ includedMedia: 0, linkedMedia: 1 });
  });

  it("packages an approximate per-clip color LUT with manual application metadata", async () => {
    const plan = planFcpxmlMediaBundle({
      version: {
        ...version,
        clips: [{
          ...version.clips[0],
          videoFilter: {
            preset: "custom",
            brightness: 1.1,
            contrast: 1.05,
            saturation: 0.9,
            sepia: 0,
            grayscale: 0,
            hueRotate: 4,
            exposure: 0.25,
          },
        }],
      },
      assets: [{
        assetId: "video/one",
        kind: "video",
        mimeType: "video/mp4",
        name: "graded.mp4",
        size: 5,
        externalUrl: "https://cdn.example.com/graded.mp4",
      }],
    });

    expect(plan.looks).toHaveLength(1);
    expect(plan.manifest.looks).toEqual([{
      clipId: "clip",
      archivePath: "Looks/0001-clip.cube",
      application: "manual",
    }]);
    expect(plan.diagnostics).toContainEqual(expect.objectContaining({
      code: "COLOR_LOOK_LUT_INCLUDED",
      itemId: "clip",
    }));

    const bundle = await createFcpxmlMediaBundle(plan);
    const archive = unzipSync(new Uint8Array(await bundle.blob.arrayBuffer()));
    expect(strFromU8(archive["Looks/0001-clip.cube"]!)).toContain("LUT_3D_SIZE 17");
    expect(bundle.includedLooks).toBe(1);
  });
});
