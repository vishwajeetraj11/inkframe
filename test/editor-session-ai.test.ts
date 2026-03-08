import { describe, expect, it } from "vitest";
import { createInitialProjectSession } from "@/lib/editor/defaults";
import { applyAIEditorActions } from "@/components/editor/hooks/editor-session-ai";
import type { LocalAsset } from "@/components/editor/hooks/editor-session-types";

const createLocalImageAsset = (): Record<string, LocalAsset> => {
  const file = new File(["image"], "hero.png", { type: "image/png" });
  return {
    "asset-1": {
      assetId: "asset-1",
      kind: "image",
      mimeType: "image/png",
      name: "hero.png",
      size: file.size,
      file,
      objectUrl: "blob:hero",
    },
  };
};

describe("applyAIEditorActions", () => {
  it("rejects AI edits when no visual asset is available", () => {
    const result = applyAIEditorActions({
      actions: {
        scenes: [{ text: "Hook line" }],
      },
      currentProject: createInitialProjectSession(),
      currentAssets: {},
    });

    expect(result).toEqual({
      ok: false,
      message: "Upload at least one image or video before applying AI edits.",
    });
  });

  it("builds a version with clips and overlays from AI scenes", () => {
    const result = applyAIEditorActions({
      actions: {
        targetAspect: "reel_9_16",
        scenes: [
          {
            text: "Move fast",
            stylePreset: "grid-kinetic",
            fontSize: 92,
          },
          {
            text: "Break the scroll",
            stylePreset: "hero-slam",
          },
        ],
      },
      currentProject: createInitialProjectSession(),
      currentAssets: createLocalImageAsset(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected success result");
    }

    expect(result.targetAspect).toBe("reel_9_16");
    expect(result.nextVersion.clips).toHaveLength(2);
    expect(result.nextVersion.textOverlays).toHaveLength(2);
    expect(result.selectedClipId).toBe(result.nextVersion.clips[0]?.id ?? null);
    expect(result.selectedTextId).toBe(result.nextVersion.textOverlays[0]?.id ?? null);
    expect(result.nextVersion.textOverlays[0]?.stylePreset).toBe("grid-kinetic");
    expect(result.nextVersion.textOverlays[1]?.stylePreset).toBe("hero-slam");
  });
});
