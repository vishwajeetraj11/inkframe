import { act, render } from "@testing-library/react";
import type { Project } from "@elah/editor";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VersionTimeline } from "@/lib/editor/types";

const harness = vi.hoisted(() => ({
  props: null as null | { project: Project; onProjectChange: (project: Project) => void },
  reject: false,
}));
vi.mock("@/components/editor/elah/ElahEditorProvider", () => ({
  ElahEditorProvider: (props: typeof harness.props) => { harness.props = props; return null; },
}));
vi.mock("@/components/editor/elah/ElahMediaLibraryBridge", () => ({ ElahMediaLibraryBridge: () => null }));
vi.mock("@/lib/editor/timeline", () => ({ sanitizeVersion: (version: VersionTimeline) => harness.reject ? null : version }));
import { ElahEditorWorkspace } from "@/components/editor/elah/ElahEditorWorkspace";

const version: VersionTimeline = {
  aspect: "widescreen_16_9", clips: [{ id: "clip", assetId: "asset", kind: "video", startFrame: 0, endFrame: 90, trimStartFrame: 0, trimEndFrame: 90, volume: 1 }],
  textOverlays: [], audioTracks: [], transitions: [],
};

describe("native project synchronization", () => {
  beforeEach(() => { harness.props = null; harness.reject = false; });

  it("reloads an accepted projection after rejection without recording history", () => {
    const onVersionChange = vi.fn();
    render(<ElahEditorWorkspace version={version} assets={[]} assetSources={{ asset: "blob:asset" }} onVersionChange={onVersionChange}>{null}</ElahEditorWorkspace>);
    const initial = harness.props!.project;
    const changed = structuredClone(initial);
    changed.clips["inkframe-video"][0].startFrame = 2000;
    harness.reject = true;
    act(() => harness.props!.onProjectChange(changed));
    expect(harness.props!.project).not.toBe(initial);
    expect(harness.props!.project.clips["inkframe-video"][0].startFrame).toBe(0);
    expect(onVersionChange).not.toHaveBeenCalled();
  });

  it("reprojects embedded audio after accepting a native clip move", () => {
    const onVersionChange = vi.fn();
    const props = { assets: [], assetSources: { asset: "blob:asset" }, onVersionChange };
    const view = render(<ElahEditorWorkspace {...props} version={version}>{null}</ElahEditorWorkspace>);
    const changed = structuredClone(harness.props!.project);
    changed.clips["inkframe-video"][0].startFrame = 45;
    act(() => harness.props!.onProjectChange(changed));
    const accepted = onVersionChange.mock.calls[0][0];
    view.rerender(<ElahEditorWorkspace {...props} version={accepted}>{null}</ElahEditorWorkspace>);
    const audio = Object.values(harness.props!.project.clips).flat().find((clip) => clip.id === "inkframe-video-audio-clip")!;
    expect(audio.startFrame).toBe(45);
    expect(audio.durationFrames).toBe(90);
  });

  it("restores native trims of animated clips even when the canonical version is valid", () => {
    const onVersionChange = vi.fn();
    const animated: VersionTimeline = {
      ...version,
      clips: [{ ...version.clips[0], keyframes: { opacity: [
        { id: "fade", frame: 0, value: 0, interpolation: "linear" },
        { id: "visible", frame: 90, value: 1, interpolation: "linear" },
      ] } }],
    };
    render(<ElahEditorWorkspace version={animated} assets={[]} assetSources={{ asset: "blob:asset" }} onVersionChange={onVersionChange}>{null}</ElahEditorWorkspace>);
    const changed = structuredClone(harness.props!.project);
    changed.clips["inkframe-video"][0].durationFrames = 60;
    act(() => harness.props!.onProjectChange(changed));
    expect(harness.props!.project.clips["inkframe-video"][0].durationFrames).toBe(90);
    expect(onVersionChange).not.toHaveBeenCalled();
  });
});
