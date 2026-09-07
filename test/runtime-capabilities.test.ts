import { describe, expect, it } from "vitest";
import { detectRuntimeCapabilities } from "@/lib/webmcp/runtime-capabilities";
import { createEditorWebMcpTools } from "@/lib/editor/webmcp/tools";
import { createInitialEditorHistory } from "@/lib/editor/history";

describe("runtime capability discovery", () => {
  it.each([
    ["MacIntel", "macos"], ["Win32", "windows"], ["Linux x86_64", "linux"],
    ["Linux Android", "android"], ["", "unknown"],
  ])("treats %s as a hint, never evidence of native software", (platform, expected) => {
    const result = detectRuntimeCapabilities({ navigator: { platform } });
    expect(result.operatingSystem).toBe(expected);
    expect(result.operations.generateVoiceOver.status).toBe("unsupported");
    expect(result.operations.processMediaLocally.status).toBe("unknown");
    expect(result.policy.automaticCloudFallback).toBe(false);
  });

  it("recognizes iPad desktop mode without advertising Mac speech", () => {
    expect(detectRuntimeCapabilities({ navigator: { platform: "MacIntel", maxTouchPoints: 5 } }).operatingSystem).toBe("ios");
  });

  it("requires user file selection and does not equate codec APIs with export readiness", () => {
    const result = detectRuntimeCapabilities({
      document: {}, File: class {}, FileReader: class {},
      VideoEncoder: class {}, AudioEncoder: class {}, Worker: class {},
      OffscreenCanvas: class {}, createImageBitmap: () => {}, OfflineAudioContext: class {},
    });
    expect(result.operations.importLocalFiles.status).toBe("permission-required");
    expect(result.operations.exportMp4.status).toBe("unknown");
    expect(detectRuntimeCapabilities({}).operations.exportMp4.status).toBe("unsupported");
  });

  it("refreshes the inventory on each discovery call", async () => {
    let platform = "MacIntel";
    const tool = createEditorWebMcpTools({
      getState: () => createInitialEditorHistory(),
      getAssets: () => [],
      getRuntimeCapabilities: () => detectRuntimeCapabilities({ navigator: { platform } }),
    }).find((entry) => entry.name === "editor_get_capabilities")!;
    const read = async () => JSON.parse(await tool.execute({}, { signal: new AbortController().signal }) as string);
    expect((await read()).runtime.operatingSystem).toBe("macos");
    platform = "Win32";
    expect((await read()).runtime.operatingSystem).toBe("windows");
  });
});
