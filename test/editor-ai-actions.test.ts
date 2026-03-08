import { describe, expect, it } from "vitest";
import { parseAIEditorActionsFromMessage } from "@/lib/editor/ai-actions";

describe("AI editor actions parser", () => {
  it("extracts the action block and normalizes preset aliases", () => {
    const parsed = parseAIEditorActionsFromMessage(`Use this direction.\n[[EDITOR_ACTIONS]]\n{"targetAspect":"active","scenes":[{"text":"Hello world","stylePreset":"kinetic grid","fontFamily":"script"}],"transitionSeconds":0}\n[[/EDITOR_ACTIONS]]`);

    expect(parsed.cleanedText).toBe("Use this direction.");
    expect(parsed.parseError).toBeNull();
    expect(parsed.actions?.scenes[0]).toMatchObject({
      stylePreset: "grid-kinetic",
      fontFamily: "sans",
    });
  });

  it("returns a parse error for invalid JSON blocks", () => {
    const parsed = parseAIEditorActionsFromMessage("[[EDITOR_ACTIONS]]not json[[/EDITOR_ACTIONS]]");
    expect(parsed.actions).toBeNull();
    expect(parsed.parseError).toMatch(/invalid json/i);
  });
});
