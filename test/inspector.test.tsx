import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Inspector } from "@/components/editor/Inspector";
import { createDefaultTextOverlay } from "@/lib/editor/defaults";

afterEach(cleanup);

describe("Inspector routing", () => {
  it("renders the empty state with nothing selected", () => {
    render(
      <Inspector
        clip={null}
        textOverlay={null}
        audioTrack={null}
        onUpdateClip={() => undefined}
        onUpdateText={() => undefined}
        onUpdateAudio={() => undefined}
      />,
    );

    expect(screen.getByText(/select a clip, text overlay, or audio track/i)).toBeInTheDocument();
  });

  it("edits classic text and typography without a preset picker", () => {
    const onUpdateText = vi.fn();
    render(
      <Inspector
        clip={null}
        audioTrack={null}
        textOverlay={createDefaultTextOverlay("overlay-1")}
        onUpdateClip={() => undefined}
        onUpdateText={onUpdateText}
        onUpdateAudio={() => undefined}
      />,
    );

    expect(screen.queryByLabelText(/style preset/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^text$/i), { target: { value: "Updated title" } });
    expect(onUpdateText).toHaveBeenCalledWith("overlay-1", { text: "Updated title" });
  });

  it("keeps generic text motion controls", () => {
    render(
      <Inspector
        clip={null}
        audioTrack={null}
        textOverlay={createDefaultTextOverlay("overlay-1")}
        onUpdateClip={() => undefined}
        onUpdateText={() => undefined}
        onUpdateAudio={() => undefined}
      />,
    );

    expect(screen.getByText(/text motion/i)).toBeInTheDocument();
  });
});
