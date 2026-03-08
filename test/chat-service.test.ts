import { describe, expect, it } from "vitest";
import { buildEditorContextPrompt, parseEditorContext } from "@/server/services/chat-service";

describe("chat service editor context", () => {
  it("rejects invalid editor context payloads", () => {
    expect(parseEditorContext(null)).toBeNull();
    expect(parseEditorContext({ activeAspect: "square" })).toBeNull();
  });

  it("builds a stable prompt from parsed editor context", () => {
    const context = parseEditorContext({
      activeAspect: "reel_9_16",
      timelineDurationInFrames: 150,
      timelineDurationSeconds: 5,
      clipCount: 2,
      textOverlayCount: 1,
      audioTrackCount: 0,
      assetCount: 3,
    });

    expect(context).not.toBeNull();
    expect(buildEditorContextPrompt(context)).toContain("remainingSecondsTo60: 55.00");
    expect(buildEditorContextPrompt(context)).toContain("assetCount: 3");
  });
});
