import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeterministicEditingInspector } from "@/components/editor/features/DeterministicEditingInspector";
import { createDefaultAudioTrack, createDefaultClip, createInitialProjectSession } from "@/lib/editor/defaults";
import { createDefaultEditorTracks } from "@/lib/editor/tracks";
import type { AssetRef, VersionTimeline } from "@/lib/editor/types";

afterEach(cleanup);
const clip = { ...createDefaultClip("v1", "video", "video"), endFrame: 90, trimEndFrame: 90 };
const assets: AssetRef[] = [{ assetId: "video", kind: "video", name: "Narration", mimeType: "video/mp4", size: 123, mediaMetadata: { durationUs: 12_000_000, width: 1920, height: 1080 } }];
const version: VersionTimeline = {
  ...createInitialProjectSession().versions.reel_9_16,
  clips: [clip],
  audioTracks: [createDefaultAudioTrack("music", "sound")],
  tracks: [...createDefaultEditorTracks(), { id: "captions", kind: "caption", name: "Captions", order: 3 }],
};
const show = (overrides: Partial<Parameters<typeof DeterministicEditingInspector>[0]> = {}) => {
  const onEdit = vi.fn(() => true);
  render(<DeterministicEditingInspector version={version} clip={clip} assets={assets} assetNames={{ video: "Narration", sound: "Music" }} onEdit={onEdit} {...overrides} />);
  return onEdit;
};
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("Deterministic editing controls", () => {
  it("saves a clip-local rotation keyframe in radians and preserves other channels", () => {
    const onEdit = show({ clip: { ...clip, keyframes: { opacity: [{ id: "alpha", frame: 0, value: 1, interpolation: "hold" }] } } });
    fireEvent.click(screen.getByText("Keyframes", { selector: "summary" }));
    fill("Keyframe property", "rotation"); fill("Keyframe frame", "30"); fill("Keyframe value", "90");
    fireEvent.click(screen.getByRole("button", { name: "Save keyframe" }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ type: "set-clip-keyframes", clipId: "v1", keyframes: { opacity: [{ id: "alpha", frame: 0, value: 1, interpolation: "hold" }], rotation: [expect.objectContaining({ frame: 30, value: Math.PI / 2, interpolation: "linear" })] } }));
  });

  it("creates captions and imports SRT with frame quantization", () => {
    const onEdit = show();
    fireEvent.click(screen.getByText("Captions", { selector: "summary" }));
    fill("Caption text", "Hello world"); fill("Caption start frame", "30"); fill("Caption end frame", "60");
    fireEvent.click(screen.getByRole("button", { name: "Add caption" }));
    expect(onEdit).toHaveBeenLastCalledWith(expect.objectContaining({ type: "upsert-caption-cues", cues: [expect.objectContaining({ text: "Hello world", startFrame: 30, endFrame: 60, trackId: "captions" })] }));
    fireEvent.click(screen.getByText("Import subtitles", { selector: "summary" }));
    fill("Subtitle content", "1\n00:00:02,000 --> 00:00:03,000\nImported caption");
    fireEvent.click(screen.getByRole("button", { name: "Import captions" }));
    expect(onEdit).toHaveBeenLastCalledWith(expect.objectContaining({ type: "upsert-caption-cues", cues: [expect.objectContaining({ text: "Imported caption", startFrame: 60, endFrame: 90 })] }));
  });

  it("opens and preloads a cue selected on the native timeline", () => {
    const onEdit = show({ selectedCaptionId: "cue", version: { ...version, captionCues: [{ id: "cue", trackId: "captions", startFrame: 12, endFrame: 48, text: "Selected cue" }] } });
    expect(screen.getByRole("textbox", { name: "Caption text" })).toHaveValue("Selected cue");
    fill("Caption text", "Updated cue");
    fireEvent.click(screen.getByRole("button", { name: "Save caption" }));
    expect(onEdit).toHaveBeenLastCalledWith(expect.objectContaining({ cues: [{ id: "cue", trackId: "captions", startFrame: 12, endFrame: 48, text: "Updated cue" }] }));
  });

  it("reports malformed caption imports without a mutation", () => {
    const onEdit = show();
    fireEvent.click(screen.getByText("Captions", { selector: "summary" }));
    fireEvent.click(screen.getByText("Import subtitles", { selector: "summary" }));
    fill("Subtitle content", "not subtitles");
    fireEvent.click(screen.getByRole("button", { name: "Import captions" }));
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("uses tagged audio and video references for ducking", () => {
    const onEdit = show();
    fireEvent.click(screen.getByText("Audio ducking", { selector: "summary" }));
    fill("Ducking attenuation (dB)", "-18"); fill("Attack frames", "3"); fill("Release frames", "9");
    fireEvent.click(screen.getByRole("button", { name: "Add ducking rule" }));
    expect(onEdit).toHaveBeenLastCalledWith(expect.objectContaining({ type: "set-ducking-rule", rule: expect.objectContaining({ target: { kind: "audio", id: "music" }, triggers: [{ kind: "video", id: "v1" }], attenuationDb: -18, attackFrames: 3, releaseFrames: 9 }) }));
  });

  it("sends speed points with source bounds and freeze IDs for the exact segment count", () => {
    const onEdit = show();
    fireEvent.click(screen.getByText("Speed & freeze", { selector: "summary" }));
    fill("Speed multiplier 1", "2");
    fireEvent.click(screen.getByRole("button", { name: "Apply speed map" }));
    expect(onEdit).toHaveBeenLastCalledWith(expect.objectContaining({ type: "set-clip-time-mapping", sourceDurationUs: 12_000_000, mapping: { kind: "speed", points: [{ frame: 0, speed: 2, interpolation: "linear" }] } }));
    fill("Freeze source time (seconds)", "1.25");
    fireEvent.click(screen.getByRole("button", { name: "Freeze range" }));
    expect(onEdit).toHaveBeenLastCalledWith(expect.objectContaining({ type: "freeze-clip-range", startFrame: 0, endFrame: 90, sourceTimeUs: 1_250_000, segmentIds: [expect.any(String)] }));
    fill("Freeze start frame", "15"); fill("Freeze end frame", "45");
    fireEvent.click(screen.getByRole("button", { name: "Freeze range" }));
    expect(onEdit).toHaveBeenLastCalledWith(expect.objectContaining({ segmentIds: [expect.any(String), expect.any(String), expect.any(String)] }));
  });

  it("preserves the source offset when changing a split speed map", () => {
    const onEdit = show({ clip: { ...clip, timeMapping: { kind: "speed", sourceStartTimeUs: 2_000_000, points: [{ frame: 0, speed: 1, interpolation: "linear" }] } } });
    fireEvent.click(screen.getByText("Speed & freeze", { selector: "summary" }));
    fill("Speed multiplier 1", "1.5");
    fireEvent.click(screen.getByRole("button", { name: "Apply speed map" }));
    expect(onEdit).toHaveBeenLastCalledWith(expect.objectContaining({ mapping: { kind: "speed", sourceStartTimeUs: 2_000_000, points: [{ frame: 0, speed: 1.5, interpolation: "linear" }] } }));
  });

  it("moves an edited keyframe instead of copying it", () => {
    const onEdit = show({ clip: { ...clip, keyframes: { opacity: [{ id: "alpha", frame: 0, value: 1, interpolation: "linear" }] } } });
    fireEvent.click(screen.getByText("Keyframes", { selector: "summary" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit keyframe at 0" }));
    fill("Keyframe frame", "30");
    fireEvent.click(screen.getByRole("button", { name: "Save keyframe" }));
    expect(onEdit).toHaveBeenLastCalledWith(expect.objectContaining({ keyframes: { opacity: [{ id: "alpha", frame: 30, value: 1, interpolation: "linear" }] } }));
  });

  it("requires source metadata for retiming and disables all edits during export", () => {
    const view = render(<DeterministicEditingInspector version={version} clip={clip} assets={[]} assetNames={{}} onEdit={vi.fn(() => true)} />);
    fireEvent.click(screen.getByText("Speed & freeze", { selector: "summary" }));
    expect(screen.getByRole("button", { name: "Apply speed map" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Source duration is not available");
    view.rerender(<DeterministicEditingInspector version={version} clip={clip} assets={assets} assetNames={{}} onEdit={vi.fn(() => true)} disabled />);
    expect(screen.getByRole("button", { name: "Freeze range" })).toBeDisabled();
  });
});
