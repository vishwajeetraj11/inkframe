import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Inspector } from "@/components/editor/Inspector";

afterEach(() => {
  cleanup();
});

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

    expect(
      screen.getByText(/select a clip, text overlay, or audio track/i),
    ).toBeInTheDocument();
  });

  it("routes chart-card overlays into the chart inspector", () => {
    render(
      <Inspector
        clip={null}
        audioTrack={null}
        textOverlay={{
          id: "overlay-1",
          text: "Headline\nSubhead\nA|60|#ffffff\nB|40|#000000",
          startFrame: 0,
          endFrame: 90,
          x: 50,
          y: 50,
          fontSize: 80,
          color: "#ffffff",
          fontFamily: "serif",
          fontWeight: 700,
          fontStyle: "normal",
          stylePreset: "chart-card",
          createdaleyTexture: "plain",
        }}
        onUpdateClip={() => undefined}
        onUpdateText={() => undefined}
        onUpdateAudio={() => undefined}
      />,
    );

    expect(screen.getAllByText(/pie chart card/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /add row/i })).toBeInTheDocument();
  });

  it("routes editorial seat arc overlays into the chart inspector", () => {
    render(
      <Inspector
        clip={null}
        audioTrack={null}
        textOverlay={{
          id: "overlay-seat-arc",
          text: "The current [[balance of power]] in the UK Parliament\nData from the 2024 general election.\nLabour|411|#dd6b66\nOthers|118|#e8e2d7\nConservative|121|#8ed7f0",
          startFrame: 0,
          endFrame: 90,
          x: 50,
          y: 50,
          fontSize: 74,
          color: "#121212",
          fontFamily: "serif",
          fontWeight: 700,
          fontStyle: "normal",
          stylePreset: "editorial-seat-arc",
          createdaleyTexture: "plain",
        }}
        onUpdateClip={() => undefined}
        onUpdateText={() => undefined}
        onUpdateAudio={() => undefined}
      />,
    );

    expect(screen.getAllByText(/editorial seat arc/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/chart rows/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("combobox", { name: /paper texture/i })).toBeInTheDocument();
  });

  it("updates editorial seat arc texture through the inspector", () => {
    const onUpdateText = vi.fn();

    render(
      <Inspector
        clip={null}
        audioTrack={null}
        textOverlay={{
          id: "overlay-seat-arc",
          text: "The current [[balance of power]] in the UK Parliament\nData from the 2024 general election.\nLabour|411|#dd6b66\nOthers|118|#e8e2d7\nConservative|121|#8ed7f0",
          startFrame: 0,
          endFrame: 90,
          x: 50,
          y: 50,
          fontSize: 74,
          color: "#121212",
          fontFamily: "serif",
          fontWeight: 700,
          fontStyle: "normal",
          stylePreset: "editorial-seat-arc",
          createdaleyTexture: "plain",
        }}
        onUpdateClip={() => undefined}
        onUpdateText={onUpdateText}
        onUpdateAudio={() => undefined}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: /paper texture/i }), {
      target: { value: "warm-editorial" },
    });

    expect(onUpdateText).toHaveBeenCalledWith("overlay-seat-arc", {
      createdaleyTexture: "warm-editorial",
    });
  });

  it("routes vox-timeline overlays into the timeline inspector", () => {
    render(
      <Inspector
        clip={null}
        audioTrack={null}
        textOverlay={{
          id: "overlay-2",
          text: "HOW IT HAPPENED\nThe fall of the Berlin Wall\n1989|Protests spread|Demonstrations grow across East Germany.\nNov 9|Checkpoint opens|Border guards begin letting Berliners through.|focus\n1990|Germany reunifies|The Cold War map of Europe begins to change.",
          startFrame: 0,
          endFrame: 90,
          x: 50,
          y: 50,
          fontSize: 88,
          color: "#111827",
          fontFamily: "serif",
          fontWeight: 700,
          fontStyle: "normal",
          stylePreset: "vox-timeline",
          createdaleyTexture: "plain",
        }}
        onUpdateClip={() => undefined}
        onUpdateText={() => undefined}
        onUpdateAudio={() => undefined}
      />,
    );

    expect(screen.getAllByText(/vox timeline/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /add event/i })).toBeInTheDocument();
  });

  it("routes timeline variation overlays into the timeline inspector", () => {
    render(
      <Inspector
        clip={null}
        audioTrack={null}
        textOverlay={{
          id: "overlay-3",
          text: "HOW IT HAPPENED\nThe fall of the Berlin Wall\n1989|Protests spread|Demonstrations grow across East Germany.\nNov 9|Checkpoint opens|Border guards begin letting Berliners through.|focus\n1990|Germany reunifies|The Cold War map of Europe begins to change.",
          startFrame: 0,
          endFrame: 90,
          x: 50,
          y: 50,
          fontSize: 88,
          color: "#111827",
          fontFamily: "serif",
          fontWeight: 700,
          fontStyle: "normal",
          stylePreset: "vox-timeline-ribbon",
          createdaleyTexture: "plain",
        }}
        onUpdateClip={() => undefined}
        onUpdateText={() => undefined}
        onUpdateAudio={() => undefined}
      />,
    );

    expect(screen.getAllByText(/timeline ribbon/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /add event/i }).length).toBeGreaterThan(0);
  });
});
