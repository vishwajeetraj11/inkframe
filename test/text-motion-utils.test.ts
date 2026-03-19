import { describe, expect, it } from "vitest";
import {
  MAX_TEXT_MOTION_DURATION_FRAMES,
  MAX_TEXT_MOTION_SCENE_COUNT,
  MIN_SCENE_DURATION_FRAMES,
} from "@/lib/text-motion/constants";
import { sanitizeTextMotionProject } from "@/lib/text-motion/utils";
import type { TextMotionProject } from "@/lib/text-motion/types";

const project: TextMotionProject = {
  title: "Demo",
  aspect: "reel_9_16",
  template: "photo-card",
  theme: {
    backgroundFrom: "#000000",
    backgroundTo: "#111111",
    textColor: "#ffffff",
    accentColor: "#00ff99",
  },
  imageAssets: [
    {
      id: "image-1",
      name: "Hero",
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,abc",
    },
  ],
  scenes: [
    {
      id: "scene-1",
      text: "  hello world  ",
      durationInFrames: 1000,
      animation: "slide-up",
      fontFamily: "mono",
      fontWeight: 973,
      fontStyle: "italic",
      keepOnScreen: true,
      imageAssetId: "missing-image",
    },
  ],
};

describe("text motion sanitization", () => {
  it("normalizes invalid scene/image fields", () => {
    const sanitized = sanitizeTextMotionProject(project);

    expect(sanitized.template).toBe("photo-card");
    expect(sanitized.scenes[0]).toMatchObject({
      text: "hello world",
      fontFamily: "mono",
      fontWeight: 900,
      fontStyle: "italic",
      imageAssetId: undefined,
    });
  });

  it("creates a fallback scene when all text scenes are empty", () => {
    const sanitized = sanitizeTextMotionProject({
      ...project,
      scenes: [{ ...project.scenes[0], text: "   " }],
    });

    expect(sanitized.scenes).toHaveLength(1);
    expect(sanitized.scenes[0]?.text).toMatch(/add your first text scene/i);
  });

  it("rebalances scene durations to stay within the export ceiling", () => {
    const sanitized = sanitizeTextMotionProject({
      ...project,
      scenes: Array.from({ length: 59 }, (_, index) => ({
        ...project.scenes[0],
        id: `scene-${index + 1}`,
        text: `Scene ${index + 1}`,
        durationInFrames: 31,
        fontFamily: "sans" as const,
        fontStyle: "normal" as const,
        fontWeight: 700,
        imageAssetId: undefined,
      })),
    });

    expect(
      sanitized.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0),
    ).toBe(MAX_TEXT_MOTION_DURATION_FRAMES);
    expect(
      sanitized.scenes.every(
        (scene) =>
          scene.durationInFrames >= MIN_SCENE_DURATION_FRAMES &&
          scene.durationInFrames <= 31,
      ),
    ).toBe(true);
  });

  it("caps scene count at the maximum exportable count", () => {
    const sanitized = sanitizeTextMotionProject({
      ...project,
      scenes: Array.from(
        { length: MAX_TEXT_MOTION_SCENE_COUNT + 3 },
        (_, index) => ({
          ...project.scenes[0],
          id: `scene-${index + 1}`,
          text: `Scene ${index + 1}`,
          durationInFrames: MIN_SCENE_DURATION_FRAMES,
          fontFamily: "sans" as const,
          fontStyle: "normal" as const,
          fontWeight: 700,
          imageAssetId: undefined,
        }),
      ),
    });

    expect(sanitized.scenes).toHaveLength(MAX_TEXT_MOTION_SCENE_COUNT);
    expect(sanitized.scenes[0]?.id).toBe("scene-1");
    expect(sanitized.scenes.at(-1)?.id).toBe(
      `scene-${MAX_TEXT_MOTION_SCENE_COUNT}`,
    );
  });
});
