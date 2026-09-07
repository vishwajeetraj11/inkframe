export type CapabilityStatus =
  | "available"
  | "unsupported"
  | "not-installed"
  | "permission-required"
  | "unknown";

export interface RuntimeCapability {
  status: CapabilityStatus;
  reason: string;
  nextAction: string;
}

export interface RuntimeEnvironment {
  navigator?: { platform?: string; userAgent?: string; maxTouchPoints?: number };
  document?: unknown;
  File?: unknown;
  FileReader?: unknown;
  VideoEncoder?: unknown;
  AudioEncoder?: unknown;
  Worker?: unknown;
  OffscreenCanvas?: unknown;
  createImageBitmap?: unknown;
  OfflineAudioContext?: unknown;
  webkitOfflineAudioContext?: unknown;
}

/** Browser evidence only: never infer installed native software from an OS hint. */
export function detectRuntimeCapabilities(
  environment: RuntimeEnvironment = globalThis as unknown as RuntimeEnvironment,
) {
  const nav = environment.navigator;
  const hint = `${nav?.platform ?? ""} ${nav?.userAgent ?? ""}`;
  const operatingSystem = /iPhone|iPad|iPod/i.test(hint) ||
    (/Mac/i.test(hint) && (nav?.maxTouchPoints ?? 0) > 1)
    ? "ios"
    : /Android/i.test(hint) ? "android"
      : /Win/i.test(hint) ? "windows"
        : /Mac/i.test(hint) ? "macos"
          : /Linux/i.test(hint) ? "linux" : "unknown";
  const capability = (
    status: CapabilityStatus, reason: string, nextAction: string,
  ): RuntimeCapability => ({ status, reason, nextAction });
  const missingExportPrimitives = [
    "VideoEncoder", "AudioEncoder", "Worker", "OffscreenCanvas", "createImageBitmap",
  ].filter((key) => typeof environment[key as keyof RuntimeEnvironment] !== "function");
  if (typeof (environment.OfflineAudioContext ?? environment.webkitOfflineAudioContext) !== "function") {
    missingExportPrimitives.push("OfflineAudioContext");
  }

  return {
    operatingSystem,
    operatingSystemEvidence: "browser hint; not proof of native tool availability",
    localCompanion: capability("unsupported",
      "Inkframe has no connected local companion. Native executables and permissions cannot be inspected from this page.",
      "Use browser workflows or import files produced by an external local tool."),
    operations: {
      generateVoiceOver: capability("unsupported",
        "No audio-file speech generator is connected. Browser speech playback does not provide an importable narration file.",
        "Generate narration externally and use editor_request_media_picker to import it."),
      processMediaLocally: capability("unknown",
        "FFmpeg installation on the user's device is unknown and native execution is unavailable through this page.",
        "Use existing timeline editing tools, or process a file externally and import it."),
      importLocalFiles: capability(
        environment.document && typeof environment.File === "function" && typeof environment.FileReader === "function"
          ? "permission-required" : "unsupported",
        "Local file access requires the user to select files in the browser picker; no persistent filesystem permission is inferred.",
        "Call editor_request_media_picker and let the user choose files."),
      exportMp4: capability(missingExportPrimitives.length ? "unsupported" : "unknown",
        missingExportPrimitives.length
          ? `Missing browser export primitives: ${missingExportPrimitives.join(", ")}.`
          : "Browser export primitives exist; support for the requested codec, dimensions, and resources is checked during export.",
        missingExportPrimitives.length
          ? "Use a browser supporting the missing primitives, or export a timeline for an external editor."
          : "Validate the project, request export, then inspect editor_get_export_status."),
    },
    policy: {
      automaticCloudFallback: false,
      cloudFallbackRequires: "Explicit user choice before uploading media or using a paid provider.",
    },
  };
}

export type RuntimeCapabilities = ReturnType<typeof detectRuntimeCapabilities>;
