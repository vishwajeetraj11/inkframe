import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClipInspector } from "@/components/editor/inspector/ClipInspector";
import { createDefaultClip } from "@/lib/editor/defaults";
import { createDefaultEditorTracks } from "@/lib/editor/tracks";

afterEach(cleanup);
const clip = createDefaultClip("clip", "asset", "video");
const tracks = [...createDefaultEditorTracks(), { id: "pip", kind: "video" as const, name: "PiP", order: 3 }];

describe("Clip placement and transforms", () => {
  it("commits frame placement once after typing and uses the selected lane", () => {
    const place = vi.fn();
    render(<ClipInspector clip={clip} tracks={tracks} onPlaceClip={place} onUpdateClip={vi.fn()} />);
    const start = screen.getByRole("spinbutton", { name: "Start frame" });
    start.focus();
    fireEvent.change(start, { target: { value: "60" } });
    expect(place).not.toHaveBeenCalled();
    fireEvent.keyDown(start, { key: "Enter" });
    expect(place).toHaveBeenCalledExactlyOnceWith("clip", "inkframe-video", 60);
    fireEvent.blur(start);
    expect(place).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole("combobox", { name: "Video track" }), { target: { value: "pip" } });
    expect(place).toHaveBeenLastCalledWith("clip", "pip", clip.startFrame);
  });

  it("does not materialize auto fit until explicitly enabled and opacity stays independent", () => {
    const update = vi.fn();
    render(<ClipInspector clip={clip} onUpdateClip={update} />);
    expect(update).not.toHaveBeenCalled();
    expect(screen.queryByRole("spinbutton", { name: "Source scale" })).not.toBeInTheDocument();
    const opacity = screen.getByRole("spinbutton", { name: "Opacity (%)" });
    fireEvent.change(opacity, { target: { value: "50" } });
    fireEvent.blur(opacity);
    expect(update).toHaveBeenLastCalledWith("clip", { opacity: 0.5 });
    fireEvent.click(screen.getByRole("button", { name: "Use source-size transform" }));
    expect(update).toHaveBeenLastCalledWith("clip", { transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, anchor: { x: 0.5, y: 0.5 } } });
  });

  it("converts degrees to radians, cancels Escape, and rejects invalid scale", () => {
    const update = vi.fn();
    const transform = { x: 0.5, y: 0.5, scale: 1, rotation: 0, anchor: { x: 0.5, y: 0.5 } };
    render(<ClipInspector clip={{ ...clip, transform }} onUpdateClip={update} />);
    const rotation = screen.getByRole("spinbutton", { name: "Rotation (degrees)" });
    fireEvent.change(rotation, { target: { value: "90" } });
    fireEvent.blur(rotation);
    expect(update).toHaveBeenLastCalledWith("clip", { transform: { ...transform, rotation: Math.PI / 2 } });
    update.mockClear();
    const scale = screen.getByRole("spinbutton", { name: "Source scale" });
    scale.focus();
    fireEvent.change(scale, { target: { value: "0.4" } });
    fireEvent.keyDown(scale, { key: "Escape" });
    expect(update).not.toHaveBeenCalled();
    fireEvent.change(scale, { target: { value: "-1" } });
    fireEvent.blur(scale);
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reset to auto fit" }));
    expect(update).toHaveBeenLastCalledWith("clip", { transform: undefined });
  });

  it("raises the whole video lane while retaining every non-video lane", () => {
    const reorder = vi.fn();
    render(<ClipInspector clip={{ ...clip, trackId: "pip" }} tracks={tracks} onPlaceClip={vi.fn()} onReorderTracks={reorder} onUpdateClip={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Raise video track" }));
    expect(reorder).toHaveBeenCalledWith(["pip", "inkframe-elements", "inkframe-audio", "inkframe-video"]);
    expect(screen.getByRole("button", { name: "Lower video track" })).toBeDisabled();
  });

  it("applies presets and promotes manual color changes to a custom grade", () => {
    const update = vi.fn();
    render(<ClipInspector clip={clip} onUpdateClip={update} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Color grade preset" }), {
      target: { value: "cinematic" },
    });
    expect(update).toHaveBeenLastCalledWith("clip", {
      videoFilter: expect.objectContaining({ preset: "cinematic", contrast: 1.18 }),
    });

    const exposure = screen.getByRole("spinbutton", { name: "Exposure (%)" });
    fireEvent.change(exposure, { target: { value: "108" } });
    fireEvent.blur(exposure);
    expect(update).toHaveBeenLastCalledWith("clip", {
      videoFilter: expect.objectContaining({ preset: "custom", brightness: 1.08 }),
    });
  });
});
