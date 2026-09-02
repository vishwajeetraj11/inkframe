import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AudioEnhancementsInspector,
  TextMotionInspector,
  TransitionInspector,
} from "@/components/editor/features";

afterEach(cleanup);

describe("feature inspectors", () => {
  it("updates transition fields and removes the transition", () => {
    const onUpdate = vi.fn();
    const onRemove = vi.fn();

    render(
      <TransitionInspector
        transition={{ kind: "slide", direction: "left", easing: "ease-out", duration: 0.4 }}
        onUpdate={onUpdate}
        onRemove={onRemove}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Transition kind" }), {
      target: { value: "wipe" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Transition duration" }), {
      target: { value: "0.8" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove transition" }));

    expect(onUpdate).toHaveBeenNthCalledWith(1, { kind: "wipe" });
    expect(onUpdate).toHaveBeenNthCalledWith(2, { duration: 0.8 });
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("exposes purpose-built text motion and timing presets", () => {
    const onUpdate = vi.fn();

    render(
      <TextMotionInspector
        textMotion={{ in: "fade", out: "fade", duration: 0.35 }}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByRole("combobox", { name: "In motion effect" })).toHaveValue("fade");
    expect(screen.getAllByRole("option", { name: "Punch in" })).toHaveLength(2);

    fireEvent.change(screen.getByRole("combobox", { name: "In motion effect" }), {
      target: { value: "punch" },
    });
    const cinematicPreset = screen.getByRole("button", { name: "Cinematic" });
    expect(cinematicPreset).toHaveClass("min-w-0", "overflow-hidden", "normal-case");
    expect(cinematicPreset).not.toHaveClass("uppercase");
    fireEvent.click(cinematicPreset);

    fireEvent.change(screen.getByRole("combobox", { name: "Out motion effect" }), {
      target: { value: "none" },
    });

    expect(onUpdate).toHaveBeenNthCalledWith(1, { in: "punch" });
    expect(onUpdate).toHaveBeenNthCalledWith(2, { duration: 0.65 });
    expect(onUpdate).toHaveBeenNthCalledWith(3, { out: "none" });
  });

  it("shows frame-derived durations with readable precision", () => {
    render(
      <TextMotionInspector
        textMotion={{ in: "rise", out: "fade", duration: 14 / 30 }}
        onUpdate={() => undefined}
      />,
    );

    expect(screen.getByRole("spinbutton", { name: "Text motion duration" })).toHaveValue(0.47);
  });

  it("updates audio mix controls and exposes mute and delete actions", () => {
    const onUpdate = vi.fn();
    const onDelete = vi.fn();

    render(
      <AudioEnhancementsInspector
        audio={{ volume: 0.7, fadeIn: 0, fadeOut: 0.25, muted: false }}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    fireEvent.change(screen.getByRole("slider", { name: "Audio volume" }), {
      target: { value: "0.4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mute audio" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete audio" }));

    expect(onUpdate).toHaveBeenNthCalledWith(1, { volume: 0.4 });
    expect(onUpdate).toHaveBeenNthCalledWith(2, { muted: true });
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("provides an accessible disabled state for controls", () => {
    render(
      <TransitionInspector
        disabled
        transition={{ kind: "fade", direction: "left", easing: "linear", duration: 0.4 }}
        onUpdate={() => undefined}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Transition kind" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Transition direction" })).toBeDisabled();
  });
});
