import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultClip, createInitialProjectSession } from "@/lib/editor/defaults";
import { migrateProjectContent } from "@/lib/editor/project-migrations";
import { validateVersionPlacement } from "@/lib/editor/domain/version";
import { loadProjectSnapshot, saveProjectSnapshot } from "@/lib/editor/project-storage";

const legacyProject = () => {
  const project = createInitialProjectSession();
  delete project.contentVersion;
  delete project.versions.reel_9_16.tracks;
  project.versions.reel_9_16.clips = [
    { ...createDefaultClip("a", "asset", "video"), startFrame: 30, endFrame: 120, trimStartFrame: 10, trimEndFrame: 100 },
    { ...createDefaultClip("b", "asset", "video"), startFrame: 120, endFrame: 210, trimEndFrame: 90 },
  ];
  project.versions.reel_9_16.transitions = [
    { id: "transition", kind: "fade", fromClipId: "a", toClipId: "b", durationInFrames: 10 },
  ];
  return project;
};

// Exercise the request/transaction flow without adding a browser database dependency.
const mockStorage = (record: unknown) => {
  const stores = {
    projects: new Map<unknown, unknown>([["latest", record]]),
    assets: new Map<unknown, unknown>([["asset", { assetId: "asset", fingerprint: "existing", blob: new Blob(["media"]) }]]),
  };
  const writes: string[] = [];
  const database = {
    close: vi.fn(),
    transaction(name: string | string[]) {
      const transaction: Record<string, unknown> = {};
      transaction.objectStore = (storeName: keyof typeof stores) => {
        const store = stores[storeName];
        const request = (result: unknown) => {
          const value = { result, onsuccess: undefined as undefined | (() => void) };
          queueMicrotask(() => value.onsuccess?.());
          return value;
        };
        return {
          get: (key: unknown) => request(store.get(key)),
          getAll: () => request([...store.values()]),
          getAllKeys: () => request([...store.keys()]),
          put: (value: { key?: unknown; assetId?: unknown }) => {
            writes.push(storeName);
            store.set(value.key ?? value.assetId, value);
          },
          delete: (key: unknown) => store.delete(key),
        };
      };
      void name;
      setTimeout(() => (transaction.oncomplete as (() => void) | undefined)?.(), 0);
      return transaction;
    },
  };
  vi.stubGlobal("indexedDB", {
    open: (_name: string, version: number) => {
      expect(version).toBe(2);
      const request = { result: database, onsuccess: undefined as undefined | (() => void) };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  });
  return { stores, writes };
};

afterEach(() => vi.unstubAllGlobals());

describe("project content migration", () => {
  it("preserves legacy gap, source trim, and centered-cut transition timing", () => {
    const legacy = legacyProject();
    const migrated = migrateProjectContent(legacy);
    expect(migrated.contentVersion).toBe(1);
    expect(migrated.versions.reel_9_16.clips.map(({ startFrame, endFrame, trimStartFrame, trimEndFrame }) => ({ startFrame, endFrame, trimStartFrame, trimEndFrame })))
      .toEqual(legacy.versions.reel_9_16.clips.map(({ startFrame, endFrame, trimStartFrame, trimEndFrame }) => ({ startFrame, endFrame, trimStartFrame, trimEndFrame })));
    expect(migrated.versions.reel_9_16.transitions[0].durationInFrames).toBe(10);
    expect(migrated.versions.reel_9_16.clips[0].trackId).toBe("inkframe-video");
    expect(migrateProjectContent(migrated)).toEqual(migrated);
    expect(legacy.contentVersion).toBeUndefined();
  });

  it("rejects unknown versions and invalid content explicitly", () => {
    expect(() => migrateProjectContent({ ...legacyProject(), contentVersion: 2 })).toThrow("unsupported content version");
    const invalid = legacyProject();
    invalid.versions.reel_9_16.clips[0].endFrame = -1;
    expect(() => migrateProjectContent(invalid)).toThrow("invalid");
    const tooLong = legacyProject();
    tooLong.versions.reel_9_16.clips[1].endFrame = 1801;
    tooLong.versions.reel_9_16.clips[1].trimEndFrame = 1681;
    expect(() => migrateProjectContent(tooLong)).toThrow();
    const overlap = legacyProject();
    overlap.versions.reel_9_16.clips[1].startFrame = 100;
    overlap.versions.reel_9_16.clips[1].endFrame = 190;
    expect(() => migrateProjectContent(overlap)).toThrow();
  });

  it("upgrades metadata once without touching existing asset blobs", async () => {
    const { stores, writes } = mockStorage({ key: "latest", schemaVersion: 2, savedAt: 123, project: legacyProject(), assets: [{ assetId: "asset" }] });
    const blobRecord = stores.assets.get("asset");
    const restored = await loadProjectSnapshot();
    expect(restored?.project.contentVersion).toBe(1);
    expect(restored?.savedAt).toBe(123);
    expect(restored?.assets[0].blob).toBe((blobRecord as { blob: Blob }).blob);
    expect(writes).toEqual(["projects"]);
    expect(stores.assets.get("asset")).toBe(blobRecord);
    await loadProjectSnapshot();
    expect(writes).toEqual(["projects"]);
  });

  it("retains inline blobs for legacy storage records", async () => {
    const blob = new Blob(["legacy"]);
    const { writes } = mockStorage({ key: "latest", savedAt: 42, project: legacyProject(), assets: [{ assetId: "asset", blob }] });
    expect((await loadProjectSnapshot())?.assets[0].blob).toBe(blob);
    expect(writes).toEqual(["projects"]);
  });

  it("stamps saves and reuses fingerprint-matched blobs", async () => {
    const { stores, writes } = mockStorage(undefined);
    const file = new File(["media"], "clip.mp4", { type: "video/mp4", lastModified: 5 });
    stores.assets.set("asset", { assetId: "asset", fingerprint: "clip.mp4:video/mp4:5:5", blob: file });
    const result = await saveProjectSnapshot(legacyProject(), [{ assetId: "asset", kind: "video", name: "clip.mp4", mimeType: "video/mp4", size: 5, file, objectUrl: "blob:test" }]);
    expect(result.writtenAssetBlobs).toBe(0);
    expect(result.reusedAssetBlobs).toBe(1);
    expect(writes).toEqual(["projects"]);
    expect((stores.projects.get("latest") as { project: { contentVersion: number } }).project.contentVersion).toBe(1);
  });
  it("retains optional media metadata through save and reload without blob changes", async () => {
    const { stores } = mockStorage(undefined);
    const mediaMetadata = { durationUs: 5_000_000, width: 1920, height: 1080 };
    await saveProjectSnapshot(legacyProject(), [{ assetId: "remote", kind: "video", name: "Remote", mimeType: "video/mp4", size: 0, externalUrl: "https://example.com/video.mp4", mediaMetadata }]);
    const saved = stores.projects.get("latest") as { assets: Array<{ mediaMetadata: unknown }> };
    expect(saved.assets[0].mediaMetadata).toEqual(mediaMetadata);
    expect((await loadProjectSnapshot())?.assets[0].mediaMetadata).toEqual(mediaMetadata);
  });

  it.each([NaN, Infinity, -1, 0, Number.MAX_SAFE_INTEGER + 1])("rejects invalid media durations before saving: %s", async (durationUs) => {
    const { writes } = mockStorage(undefined);
    await expect(saveProjectSnapshot(legacyProject(), [{ assetId: "bad", kind: "video", name: "Bad", mimeType: "video/mp4", size: 0, mediaMetadata: { durationUs } }])).rejects.toThrow("invalid media metadata");
    expect(writes).toEqual([]);
  });

  it("rejects invalid restored media dimensions before metadata migration", async () => {
    const { writes } = mockStorage({ key: "latest", schemaVersion: 2, savedAt: 123, project: legacyProject(), assets: [{ assetId: "asset", mediaMetadata: { durationUs: 10, width: Infinity } }] });
    await expect(loadProjectSnapshot()).rejects.toThrow("invalid media metadata");
    expect(writes).toEqual([]);
  });

  it("reloads captions, keyframes, ducking and source-time mappings without loss", async () => {
    mockStorage(undefined);
    const project = legacyProject();
    const version = project.versions.reel_9_16;
    version.tracks = [{ id: "captions", name: "Captions", kind: "caption", order: 3 }];
    version.transitions = [];
    version.captionCues = [{ id: "cue", trackId: "captions", startFrame: 30, endFrame: 60, text: "Plain caption" }];
    version.clips[0].keyframes = { opacity: [{ id: "k1", frame: 0, value: 0.5, interpolation: "linear" }, { id: "k2", frame: 60, value: 1, interpolation: "hold" }] };
    version.clips[0].timeMapping = { kind: "hold", sourceTimeUs: 100000 };
    version.clips[0].sourceDurationUs = 10_000_000;
    version.clips[1].timeMapping = { kind: "speed", points: [{ frame: 0, speed: 1, interpolation: "linear" }, { frame: 90, speed: 2, interpolation: "hold" }] };
    version.clips[1].sourceDurationUs = 10_000_000;
    version.duckingRules = [{ id: "duck", target: { kind: "video", id: "a" }, triggers: [{ kind: "video", id: "b" }], attenuationDb: -12, attackFrames: 3, releaseFrames: 6 }];
    expect(validateVersionPlacement(version)).toEqual([]);
    await saveProjectSnapshot(project, []);
    const restored = (await loadProjectSnapshot())?.project.versions.reel_9_16;
    expect(restored?.captionCues).toEqual(version.captionCues);
    expect(restored?.duckingRules).toEqual(version.duckingRules);
    expect(restored?.clips[0].keyframes).toEqual(version.clips[0].keyframes);
    expect(restored?.clips.map(({ timeMapping, sourceDurationUs }) => ({ timeMapping, sourceDurationUs })))
      .toEqual(version.clips.map(({ timeMapping, sourceDurationUs }) => ({ timeMapping, sourceDurationUs })));
  });

});
