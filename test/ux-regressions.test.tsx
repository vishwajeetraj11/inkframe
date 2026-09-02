import { readFile } from "node:fs/promises";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AspectSwitcher } from "@/components/editor/AspectSwitcher";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { TimelineResizeHandle } from "@/components/editor/TimelineResizeHandle";

describe("UX regressions", () => {
  it("keeps responsive aspect controls explicitly named", () => {
    render(
      <AspectSwitcher
        activeAspect="reel_9_16"
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Use Reel 9:16 canvas" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Use Widescreen 16:9 canvas" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("does not duplicate text creation in the source rail", () => {
    render(
      <EditorSidebar
        isExporting={false}
        assets={[]}
        onFilesSelected={vi.fn()}
        onRemoveAsset={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /text layer/i })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Project" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Footage" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Sound FX" }));
    expect(screen.getByRole("tab", { name: "Sound FX" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("searchbox", { name: "Search stock sound effects" })).toBeInTheDocument();
  });

  it("lets keyboard users resize and reset the timeline", () => {
    const onHeightChange = vi.fn();
    render(
      <TimelineResizeHandle
        height={188}
        minHeight={140}
        maxHeight={360}
        defaultHeight={188}
        onHeightChange={onHeightChange}
      />,
    );

    const separator = screen.getByRole("separator", { name: "Resize timeline" });
    expect(separator).toHaveAttribute("aria-valuenow", "188");

    fireEvent.keyDown(separator, { key: "ArrowUp" });
    expect(onHeightChange).toHaveBeenLastCalledWith(204);
    fireEvent.keyDown(separator, { key: "ArrowDown" });
    expect(onHeightChange).toHaveBeenLastCalledWith(172);
    fireEvent.keyDown(separator, { key: "Home" });
    expect(onHeightChange).toHaveBeenLastCalledWith(140);
    fireEvent.keyDown(separator, { key: "End" });
    expect(onHeightChange).toHaveBeenLastCalledWith(360);
    fireEvent.doubleClick(separator);
    expect(onHeightChange).toHaveBeenLastCalledWith(188);

    Object.assign(separator, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
    });
    fireEvent.pointerDown(separator, { button: 0, clientY: 500, pointerId: 1 });
    fireEvent.pointerMove(separator, { clientY: 400, pointerId: 1 });
    expect(onHeightChange).toHaveBeenLastCalledWith(288);
    fireEvent.pointerUp(separator, { pointerId: 1 });
  });

  it("keeps Elah utility selectors inside the timeline boundary", async () => {
    const css = await readFile(
      path.join(
        process.cwd(),
        "src/components/editor/elah/elah-vendor-scoped.css",
      ),
      "utf8",
    );

    expect(css).toContain(".inkframe-elah .hidden");
    expect(css).toContain(".inkframe-elah *");
    expect(css).not.toMatch(/(^|})\.hidden\{/);
  });
});
