import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Inspector } from "@/components/editor/Inspector";
import { EditorialStatRingInspector } from "@/components/editor/inspector/preset-inspectors/EditorialStatRingInspector";

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

  it("hides generic typography controls for structured presets", () => {
    render(
      <Inspector
        clip={null}
        audioTrack={null}
        textOverlay={{
          id: "overlay-regional-map",
          text: "Why this border mattered\nA regional atlas zoom shows the local strategic context.\nIran\nIraq\nIran-Iraq boundary\n1975\nborder",
          startFrame: 0,
          endFrame: 90,
          x: 50,
          y: 46,
          fontSize: 82,
          color: "#223321",
          fontFamily: "serif",
          fontWeight: 700,
          fontStyle: "normal",
          stylePreset: "regional-map-focus",
          createdaleyTexture: "plain",
        }}
        onUpdateClip={() => undefined}
        onUpdateText={() => undefined}
        onUpdateAudio={() => undefined}
      />,
    );

    expect(screen.getAllByText(/regional map focus/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/x \(%\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/y \(%\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/^font family$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^font weight$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^font style$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^style preset$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^color$/i)).not.toBeInTheDocument();
  });

  it("allows clearing editorial stat ring value while translating empty input to zero", () => {
    const onUpdateText = vi.fn();
    const data = {
      headline: "The overwhelming scientific consensus on climate change",
      highlight: "scientific consensus",
      subhead: "Analysis of peer-reviewed climate studies.",
      value: 9,
      suffix: "%",
      color: "#ef5a29",
    };

    render(
      <EditorialStatRingInspector
        data={data}
        overlay={{
          id: "overlay-stat-ring",
          text: "The overwhelming scientific [[consensus]] on climate change\nAnalysis of peer-reviewed climate studies.\n9|%|#ef5a29",
          startFrame: 0,
          endFrame: 90,
          x: 50,
          y: 50,
          fontSize: 92,
          color: "#151515",
          fontFamily: "serif",
          fontWeight: 700,
          fontStyle: "normal",
          stylePreset: "editorial-stat-ring",
          createdaleyTexture: "plain",
        }}
        onUpdateOverlay={() => undefined}
        onUpdateText={onUpdateText}
      />,
    );

    const input = screen.getByLabelText(/value/i) as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });

    expect(input.value).toBe("");

    const updater = onUpdateText.mock.calls.at(-1)?.[0] as
      | ((current: typeof data) => typeof data)
      | undefined;

    expect(updater).toBeTypeOf("function");
    expect(updater?.(data).value).toBe(0);
  });

  it("updates editorial stat ring texture through the inspector", () => {
    const onUpdateText = vi.fn();

    render(
      <Inspector
        clip={null}
        audioTrack={null}
        textOverlay={{
          id: "overlay-stat-ring",
          text: "The overwhelming scientific [[consensus]] on climate change\nAnalysis of peer-reviewed climate studies.\n9|%|#ef5a29",
          startFrame: 0,
          endFrame: 90,
          x: 50,
          y: 50,
          fontSize: 92,
          color: "#151515",
          fontFamily: "serif",
          fontWeight: 700,
          fontStyle: "normal",
          stylePreset: "editorial-stat-ring",
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

    expect(onUpdateText).toHaveBeenCalledWith("overlay-stat-ring", {
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

  it("updates the vox timeline media-sync switch", () => {
    const onUpdateText = vi.fn();

    render(
      <Inspector
        clip={null}
        audioTrack={null}
        textOverlay={{
          id: "overlay-media-sync",
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
          syncMediaToTimelineEvents: false,
        }}
        onUpdateClip={() => undefined}
        onUpdateText={onUpdateText}
        onUpdateAudio={() => undefined}
      />,
    );

    fireEvent.click(screen.getByLabelText(/switch media with events/i));

    expect(onUpdateText).toHaveBeenCalledWith("overlay-media-sync", {
      syncMediaToTimelineEvents: true,
    });
  });

  it("hides removed vox starter presets from the style picker for new overlays", () => {
    render(
      <Inspector
        clip={null}
        audioTrack={null}
        textOverlay={{
          id: "overlay-style-picker",
          text: "Headline",
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

    expect(screen.queryByRole("option", { name: /vox explainer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /vox typography/i })).not.toBeInTheDocument();
  });

  it("keeps removed vox presets editable for legacy overlays", () => {
    render(
      <Inspector
        clip={null}
        audioTrack={null}
        textOverlay={{
          id: "overlay-legacy-vox-type",
          text: "Legacy",
          startFrame: 0,
          endFrame: 90,
          x: 50,
          y: 50,
          fontSize: 80,
          color: "#ffffff",
          fontFamily: "serif",
          fontWeight: 700,
          fontStyle: "normal",
          stylePreset: "vox-typography",
          createdaleyTexture: "plain",
        }}
        onUpdateClip={() => undefined}
        onUpdateText={() => undefined}
        onUpdateAudio={() => undefined}
      />,
    );

    expect(screen.getByRole("option", { name: /vox typography/i })).toBeInTheDocument();
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

  it("routes regional map overlays into the dedicated map inspector", () => {
    render(
      <Inspector
        clip={null}
        audioTrack={null}
        textOverlay={{
          id: "overlay-map",
          text: "Why this border mattered\nA regional atlas zoom shows the local strategic context.\nPRIMARY: Iran\nSECONDARY: Iraq\nLABEL: Iran-Iraq boundary\nYEAR: 1975\nFOCUS: border",
          startFrame: 0,
          endFrame: 90,
          x: 50,
          y: 50,
          fontSize: 82,
          color: "#1f2b21",
          fontFamily: "serif",
          fontWeight: 700,
          fontStyle: "normal",
          stylePreset: "regional-map-focus",
          createdaleyTexture: "plain",
        }}
        onUpdateClip={() => undefined}
        onUpdateText={() => undefined}
        onUpdateAudio={() => undefined}
      />,
    );

    expect(screen.getAllByText(/regional map focus/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("combobox", { name: /focus mode/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /secondary country/i })).toBeInTheDocument();
  });

  it("routes film frame gallery overlays into the dedicated inspector", () => {
    render(
      <Inspector
        clip={null}
        audioTrack={null}
        textOverlay={{
          id: "overlay-film-frame",
          text: "The night the wall opened\nA framed archival image sequence from the fall of the Berlin Wall.\nLOCATION: Berlin\nYEAR: 1989",
          startFrame: 0,
          endFrame: 120,
          x: 50,
          y: 50,
          fontSize: 80,
          color: "#f4efe5",
          fontFamily: "serif",
          fontWeight: 700,
          fontStyle: "normal",
          stylePreset: "film-frame-gallery",
          createdaleyTexture: "plain",
        }}
        onUpdateClip={() => undefined}
        onUpdateText={() => undefined}
        onUpdateAudio={() => undefined}
      />,
    );

    expect(screen.getAllByText(/film frame gallery/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/headline/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/year/i)).toBeInTheDocument();
  });
});
