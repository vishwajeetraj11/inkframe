import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@elah/core";
const mocks = vi.hoisted(() => ({ export: vi.fn(), download: vi.fn() }));
vi.mock("@elah/editor", () => ({ lazyExportVideo: mocks.export }));
vi.mock("@/lib/export/download", () => ({ triggerBrowserDownload: mocks.download }));
import { exportElahProjectInBrowser } from "@/lib/export/elah-browser";
const project = (id = "music", muted = false): Project => ({ id: "export", version: 1, fps: 30, stage: { width: 320, height: 180 }, tracks: [{ id: "audio", name: "Audio", kind: "audio", order: 0, height: 40, locked: false, disabled: false, muted, solo: false, volume: 1 }], clips: { audio: [{ id, name: "Audio", trackId: "audio", type: "audio", src: "blob:audio", startFrame: 0, durationFrames: 30, sourceStartFrame: 0, sourceDurationFrames: 30 }] }, transitions: [] });
describe("required export audio", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("fails required standalone audio decoding before download", async () => {
    mocks.export.mockImplementation(async (_project, options) => { options.onAudioIssue("decode failed", "blob:audio"); return new Blob(); });
    await expect(exportElahProjectInBrowser(project(), { filename: "test.mp4" })).rejects.toThrow("Required audio could not be exported");
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it("fails missing offline audio support when a standalone track is active", async () => {
    mocks.export.mockImplementation(async (_project, options) => { options.onAudioIssue("OfflineAudioContext unavailable", undefined); return new Blob(); });
    await expect(exportElahProjectInBrowser(project(), { filename: "test.mp4" })).rejects.toThrow("OfflineAudioContext unavailable");
  });
  it("tolerates muted standalone tracks", async () => {
    const reachedAfterIssue = new Error("export continued after optional audio issue");
    mocks.export.mockImplementation(async (_project, options) => { options.onAudioIssue("no audio stream", "blob:audio"); throw reachedAfterIssue; });
    await expect(exportElahProjectInBrowser(project("music", true), { filename: "test.mp4" })).rejects.toBe(reachedAfterIssue);
  });
  it("fails audio backend and source failures for audible synthetic mirrors", async () => {
    for (const source of [undefined, "blob:audio"]) {
      mocks.export.mockImplementation(async (_project, options) => { options.onAudioIssue("audio unavailable", source); return new Blob(); });
      await expect(exportElahProjectInBrowser(project("inkframe-video-audio-source"), { filename: "test.mp4" })).rejects.toThrow("Required audio");
    }
  });

  it("excludes intentionally zero-gain audio from required failures", async () => {
    const continued = new Error("continued");
    mocks.export.mockImplementation(async (_project, options) => { options.onAudioIssue("unreadable", "blob:audio"); throw continued; });
    const clipMuted = project(); clipMuted.clips.audio[0].volume = 0;
    const laneMuted = project(); laneMuted.tracks[0].volume = 0;
    await expect(exportElahProjectInBrowser(clipMuted, { filename: "test.mp4" })).rejects.toBe(continued);
    await expect(exportElahProjectInBrowser(laneMuted, { filename: "test.mp4" })).rejects.toBe(continued);
  });

});
