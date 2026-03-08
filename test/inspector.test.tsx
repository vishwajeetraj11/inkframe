import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Inspector } from "@/components/editor/Inspector";

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
    expect(screen.getByRole("button", { name: /add slice/i })).toBeInTheDocument();
  });
});
