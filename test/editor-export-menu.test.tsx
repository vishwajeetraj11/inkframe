import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorExportMenu } from "@/components/editor/EditorExportMenu";

afterEach(cleanup);

const timelinePreflight = {
  fcpxml: {
    transferred: ["2 picture clips", "1 title"],
    simplifiedOrOmitted: ["Animated text is exported as a title clip."],
    errors: [],
  },
  edl: {
    transferred: ["2 primary-track picture clips", "Clip names and non-drop-frame timecode"],
    simplifiedOrOmitted: ["CMX 3600 cannot represent titles; 1 title was omitted."],
    errors: [],
  },
  "fcpxml-bundle": {
    transferred: ["3 packaged source files", "Relinking manifest and import instructions"],
    simplifiedOrOmitted: [],
    errors: [],
  },
};

describe("EditorExportMenu", () => {
  it("keeps media and editable timeline exports as separate actions", () => {
    const onExportMp4 = vi.fn();
    const onExportTimeline = vi.fn();

    render(
      <EditorExportMenu
        canExportMp4
        canExportTimeline
        isExporting={false}
        timelinePreflight={timelinePreflight}
        onExportMp4={onExportMp4}
        onExportTimeline={onExportTimeline}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose export format" }));
    expect(screen.getByRole("menu", { name: "Export formats" })).toBeInTheDocument();
    expect(screen.getByText("Final Cut Pro timeline")).toBeInTheDocument();
    expect(screen.getByText("CMX 3600 edit list")).toBeInTheDocument();
    expect(screen.getByText("ZIP with timeline and sources")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "FCPXML: Final Cut Pro timeline" }));
    expect(screen.getByRole("region", { name: "FCPXML compatibility report" })).toHaveTextContent(
      "2 picture clips",
    );
    expect(onExportTimeline).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Known export limitations")).toHaveTextContent(
      "MP4 is the pixel-accurate visual reference.",
    );
    expect(screen.getByLabelText("Known export limitations")).toHaveTextContent(
      "Remote provider links can expire",
    );
    expect(screen.getByLabelText("Known export limitations")).toHaveTextContent(
      "Typewriter and word-reveal titles",
    );
    expect(screen.getByLabelText("Known export limitations")).toHaveTextContent(
      "Slide/wipe transitions, retimed transitions",
    );
    fireEvent.click(screen.getByRole("button", { name: "I understand — Download FCPXML" }));
    expect(onExportTimeline).toHaveBeenCalledWith("fcpxml");
    expect(onExportMp4).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Export MP4" }));
    expect(onExportMp4).toHaveBeenCalledOnce();
  });

  it("preflights and exports an FCPXML media bundle separately", () => {
    const onExportTimeline = vi.fn();
    render(
      <EditorExportMenu
        canExportMp4
        canExportTimeline
        isExporting={false}
        timelinePreflight={timelinePreflight}
        onExportMp4={vi.fn()}
        onExportTimeline={onExportTimeline}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose export format" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "FCPXML + media: ZIP with timeline and sources" }));
    expect(screen.getByRole("region", { name: "FCPXML + media compatibility report" }))
      .toHaveTextContent("3 packaged source files");
    expect(onExportTimeline).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "I understand — Download FCPXML + media" }));
    expect(onExportTimeline).toHaveBeenCalledWith("fcpxml-bundle");
  });

  it("surfaces compatibility warnings without blocking an editable export", () => {
    const onExportTimeline = vi.fn();

    render(
      <EditorExportMenu
        canExportMp4
        canExportTimeline
        isExporting={false}
        timelinePreflight={timelinePreflight}
        onExportMp4={vi.fn()}
        onExportTimeline={onExportTimeline}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose export format" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /EDL/ }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "CMX 3600 cannot represent titles; 1 title was omitted.",
    );
    expect(screen.getByRole("region", { name: "EDL compatibility report" })).toHaveTextContent(
      "Clip names and non-drop-frame timecode",
    );
    expect(onExportTimeline).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "I understand — Download EDL" }));
    expect(onExportTimeline).toHaveBeenCalledWith("edl");
  });

  it("disables every export entry point while rendering", () => {
    render(
      <EditorExportMenu
        canExportMp4
        canExportTimeline
        isExporting
        timelinePreflight={timelinePreflight}
        onExportMp4={vi.fn()}
        onExportTimeline={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Rendering MP4" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Choose export format" })).toBeDisabled();
  });
});
