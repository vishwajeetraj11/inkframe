import { describe, expect, it } from "vitest";
import { createDefaultTextMotionProject } from "@/lib/text-motion/defaults";
import { toElahTextMotionProject } from "@/lib/text-motion/elah-adapter";

describe("Text Motion → Elah adapter", () => {
  it("creates a browser-renderable project with theme and scene timing", () => {
    const source = createDefaultTextMotionProject("reel_9_16");
    const project = toElahTextMotionProject(source);
    const clips = Object.values(project.clips).flat();
    const totalFrames = source.scenes.reduce(
      (sum, scene) => sum + scene.durationInFrames,
      0,
    );

    expect(project).toMatchObject({
      fps: 30,
      stage: { width: 1080, height: 1920 },
      version: 1,
    });
    expect(clips[0]).toMatchObject({
      type: "shape",
      durationFrames: totalFrames,
      shapeKind: "rect",
      shapeStrokeWidth: 0,
    });
    expect(clips.filter((clip) => clip.type === "text")).toHaveLength(
      source.scenes.length,
    );
  });
});
