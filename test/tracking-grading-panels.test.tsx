import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ObjectTrackingPanel } from "@/components/editor/features/ObjectTrackingPanel";
import { DeterministicEditingInspector } from "@/components/editor/features/DeterministicEditingInspector";
import { SelectiveGradingPanel } from "@/components/editor/features/SelectiveGradingPanel";
import { createDefaultClip, createInitialProjectSession } from "@/lib/editor/defaults";
import { cloneVideoFilterPreset } from "@/lib/editor/video-filters";
import { trackVideoObject } from "@/lib/export/object-tracking-browser";

vi.mock("@/lib/export/object-tracking-browser", () => ({ trackVideoObject: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const clip = { ...createDefaultClip("source", "source-media", "video"), endFrame: 90, trimEndFrame: 90 };
const graphic = { ...createDefaultClip("graphic", "graphic-media", "image"), endFrame: 90, trimEndFrame: 90, keyframes: { opacity: [{ id: "alpha", frame: 0, value: .8, interpolation: "hold" as const }] } };
const version = { ...createInitialProjectSession().versions.reel_9_16, clips: [clip, graphic] };
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("selective grading controls", () => {
  it("does not recreate an edited region removed by another edit", () => {
    const region = { id: "one", shape: "ellipse" as const, x: .5, y: .5, width: .5, height: .5, feather: .3, exposure: 1, temperature: 0, tint: 0, saturation: 1 };
    const onEdit = vi.fn(() => true);
    const { rerender } = render(<SelectiveGradingPanel clip={{ ...clip, videoFilter: { ...cloneVideoFilterPreset("none"), selectiveRegions: [region] } }} aspect={version.aspect} onEdit={onEdit} />);
    fireEvent.click(screen.getByText("Selective grading", { selector: "summary" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit region 1" }));
    rerender(<SelectiveGradingPanel clip={clip} aspect={version.aspect} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: "Save region" }));
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("This region changed.");
  });

  it("adds a local grade while preserving the global grade", () => {
    const onEdit = vi.fn(() => true);
    render(<SelectiveGradingPanel clip={{ ...clip, videoFilter: { ...cloneVideoFilterPreset("warm"), exposure: .7 } }} aspect={version.aspect} onEdit={onEdit} />);
    fireEvent.click(screen.getByText("Selective grading", { selector: "summary" }));
    fill("Region shape", "rectangle"); fill("Region center X (%)", "25"); fill("Region exposure (stops)", "1.2");
    fireEvent.click(screen.getByLabelText("Grade outside region"));
    fireEvent.click(screen.getByRole("button", { name: "Add grading region" }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ type: "update-clip", clipId: "source", patch: { videoFilter: expect.objectContaining({ preset: "warm", exposure: .7, selectiveRegions: [expect.objectContaining({ shape: "rectangle", x: .25, exposure: 1.2, inverted: true })] }) } }));
  });

  it("edits and removes a region without removing another region", () => {
    const region = { id: "one", shape: "ellipse" as const, x: .5, y: .5, width: .5, height: .5, feather: .3, exposure: 1, temperature: 0, tint: 0, saturation: 1 };
    const second = { ...region, id: "two" };
    const onEdit = vi.fn(() => true);
    render(<SelectiveGradingPanel clip={{ ...clip, videoFilter: { ...cloneVideoFilterPreset("none"), selectiveRegions: [region, second] } }} aspect={version.aspect} onEdit={onEdit} />);
    fireEvent.click(screen.getByText("Selective grading", { selector: "summary" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit region 1" }));
    fill("Region exposure (stops)", "-1");
    fireEvent.click(screen.getByRole("button", { name: "Save region" }));
    expect(onEdit).toHaveBeenLastCalledWith(expect.objectContaining({ patch: { videoFilter: expect.objectContaining({ selectiveRegions: [{ ...region, exposure: -1 }, second] }) } }));
    fireEvent.click(screen.getByRole("button", { name: "Remove region 1" }));
    expect(onEdit).toHaveBeenLastCalledWith(expect.objectContaining({ patch: { videoFilter: expect.objectContaining({ selectiveRegions: [second] }) } }));
  });
});

describe("object tracking controls", () => {
  it("aborts in-flight tracking when the project revision changes", () => {
    vi.mocked(trackVideoObject).mockImplementation(() => new Promise(() => {}));
    const props = { clip, version, assets: [], assetNames: {}, assetSources: { "source-media": "blob:source" }, onEdit: vi.fn(() => true) };
    const { rerender } = render(<DeterministicEditingInspector {...props} revision={1} />);
    fireEvent.click(screen.getByText("Object tracking", { selector: "summary" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze object motion" }));
    const signal = vi.mocked(trackVideoObject).mock.calls[0][0].signal;
    rerender(<DeterministicEditingInspector {...props} revision={2} />);
    expect(signal?.aborted).toBe(true);
  });

  it("explains missing video and disables analysis", () => {
    render(<ObjectTrackingPanel clip={clip} version={version} assetNames={{}} onEdit={vi.fn()} />);
    fireEvent.click(screen.getByText("Object tracking", { selector: "summary" }));
    expect(screen.getByRole("button", { name: "Analyze object motion" })).toBeDisabled();
    expect(screen.getByText("Load the source video to analyze motion.")).toBeInTheDocument();
  });

  it("reviews confidence and applies manual corrections through existing graphic keyframes", async () => {
    vi.mocked(trackVideoObject).mockResolvedValue({ status: "complete", sourceWidth: 1080, sourceHeight: 1920, points: [{ frame: 0, x: .5, y: .5, confidence: 1 }, { frame: 30, x: .6, y: .6, confidence: .9 }] });
    const onEdit = vi.fn(() => true);
    render(<ObjectTrackingPanel clip={clip} version={version} sourceUrl="blob:source" assetNames={{ "graphic-media": "Logo" }} onEdit={onEdit} />);
    fireEvent.click(screen.getByText("Object tracking", { selector: "summary" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze object motion" }));
    await screen.findByText(/Analysis complete · 2 points/);
    expect(screen.getByRole("option", { name: "Frame 30 · 90% confidence" })).toBeInTheDocument();
    fill("Review tracking point", "30"); fill("Correction X (%)", "75");
    fireEvent.click(screen.getByRole("button", { name: "Save point correction" }));
    expect(screen.getByRole("option", { name: "Frame 30 · manual" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Attach path to graphic" }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ type: "set-clip-keyframes", clipId: "graphic", keyframes: expect.objectContaining({ opacity: graphic.keyframes.opacity, x: expect.arrayContaining([expect.objectContaining({ frame: 30, value: .75 })]) }) }));
  });

  it("keeps lost tracks blocked after a manual correction", async () => {
    vi.mocked(trackVideoObject).mockResolvedValue({ status: "lost", sourceWidth: 1080, sourceHeight: 1920, points: [{ frame: 0, x: .5, y: .5, confidence: 1 }, { frame: 30, x: .6, y: .6, confidence: .9 }] });
    const onEdit = vi.fn(() => true);
    render(<ObjectTrackingPanel clip={clip} version={version} sourceUrl="blob:source" assetNames={{}} onEdit={onEdit} />);
    fireEvent.click(screen.getByText("Object tracking", { selector: "summary" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze object motion" }));
    await screen.findByText(/Tracking lost · 2 points/);
    fill("Correction frame", "89");
    fireEvent.click(screen.getByRole("button", { name: "Save point correction" }));
    expect(screen.getByRole("button", { name: "Attach path to graphic" })).toBeDisabled();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("cancels analysis and ignores a late result", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof trackVideoObject>>) => void;
    vi.mocked(trackVideoObject).mockImplementation(() => new Promise((done) => { resolve = done; }));
    render(<ObjectTrackingPanel clip={clip} version={version} sourceUrl="blob:source" assetNames={{}} onEdit={vi.fn()} />);
    fireEvent.click(screen.getByText("Object tracking", { selector: "summary" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze object motion" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel tracking" }));
    expect(vi.mocked(trackVideoObject).mock.calls[0][0].signal?.aborted).toBe(true);
    resolve({ status: "complete", points: [], sourceWidth: 1080, sourceHeight: 1920 });
    await waitFor(() => expect(screen.queryByText(/Analysis complete/)).not.toBeInTheDocument());
    expect(screen.getByText("Tracking canceled.")).toBeInTheDocument();
  });
});
