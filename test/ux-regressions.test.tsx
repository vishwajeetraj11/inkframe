import { readFile } from "node:fs/promises";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AspectSwitcher } from "@/components/editor/AspectSwitcher";
import { TextMotionSceneList } from "@/components/text-motion/TextMotionSceneList";

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

  it("names the compact add-scene control", () => {
    render(
      <TextMotionSceneList
        imageAssets={[]}
        imagePreviewById={new Map()}
        onAddScene={vi.fn()}
        onChangeScene={vi.fn()}
        onDeleteScene={vi.fn()}
        scenes={[]}
      />,
    );

    expect(screen.getByRole("button", { name: "Add scene" })).toBeEnabled();
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
