import { describe, expect, it } from "vitest";
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
});
