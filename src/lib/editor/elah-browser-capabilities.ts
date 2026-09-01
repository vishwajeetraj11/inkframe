export type ElahBrowserCapability =
  | "dom"
  | "webgl"
  | "webgl2"
  | "video-decoder"
  | "video-encoder"
  | "audio-encoder"
  | "audio-context"
  | "offline-audio-context"
  | "offscreen-canvas"
  | "image-bitmap"
  | "worker";

interface CanvasLike {
  getContext(contextId: string): unknown;
}

export interface ElahCapabilityEnvironment {
  document?: {
    createElement(tagName: "canvas"): CanvasLike;
  };
  Worker?: unknown;
  OffscreenCanvas?: unknown;
  VideoDecoder?: unknown;
  VideoEncoder?: unknown;
  AudioEncoder?: unknown;
  AudioContext?: unknown;
  webkitAudioContext?: unknown;
  OfflineAudioContext?: unknown;
  webkitOfflineAudioContext?: unknown;
  createImageBitmap?: unknown;
}

export interface ElahBrowserCapabilities {
  capabilities: Record<ElahBrowserCapability, boolean>;
  ready: {
    timeline: boolean;
    imagePreview: boolean;
    videoPreview: boolean;
    audioPlayback: boolean;
    videoExport: boolean;
    audioExport: boolean;
  };
  missing: {
    timeline: ElahBrowserCapability[];
    imagePreview: ElahBrowserCapability[];
    videoPreview: ElahBrowserCapability[];
    audioPlayback: ElahBrowserCapability[];
    videoExport: ElahBrowserCapability[];
    audioExport: ElahBrowserCapability[];
  };
}

const isAvailable = (value: unknown): boolean =>
  value !== null && (typeof value === "function" || typeof value === "object");

const missingCapabilities = (
  required: readonly ElahBrowserCapability[],
  capabilities: Record<ElahBrowserCapability, boolean>,
): ElahBrowserCapability[] => required.filter((name) => !capabilities[name]);

/**
 * Detects the browser primitives used by @elah/editor 0.4.x without importing
 * or instantiating its renderer. Safe to call during SSR: an absent DOM simply
 * reports unsupported capabilities.
 */
export const detectElahBrowserCapabilities = (
  environment: ElahCapabilityEnvironment = globalThis as unknown as ElahCapabilityEnvironment,
): ElahBrowserCapabilities => {
  let webgl = false;
  let webgl2 = false;
  if (environment.document) {
    try {
      const canvas = environment.document.createElement("canvas");
      webgl2 = Boolean(canvas.getContext("webgl2"));
      webgl = webgl2 || Boolean(canvas.getContext("webgl"));
    } catch {
      webgl = false;
      webgl2 = false;
    }
  }

  const capabilities: Record<ElahBrowserCapability, boolean> = {
    dom: Boolean(environment.document),
    webgl,
    webgl2,
    "video-decoder": isAvailable(environment.VideoDecoder),
    "video-encoder": isAvailable(environment.VideoEncoder),
    "audio-encoder": isAvailable(environment.AudioEncoder),
    "audio-context": isAvailable(
      environment.AudioContext ?? environment.webkitAudioContext,
    ),
    "offline-audio-context": isAvailable(
      environment.OfflineAudioContext ?? environment.webkitOfflineAudioContext,
    ),
    "offscreen-canvas": isAvailable(environment.OffscreenCanvas),
    "image-bitmap": isAvailable(environment.createImageBitmap),
    worker: isAvailable(environment.Worker),
  };

  const requirements = {
    timeline: ["dom"] as const,
    imagePreview: ["dom", "webgl", "image-bitmap"] as const,
    videoPreview: ["dom", "webgl", "image-bitmap", "video-decoder"] as const,
    audioPlayback: ["audio-context"] as const,
    videoExport: [
      "worker",
      "offscreen-canvas",
      "image-bitmap",
      "video-encoder",
    ] as const,
    audioExport: [
      "worker",
      "offscreen-canvas",
      "image-bitmap",
      "video-encoder",
      "audio-encoder",
      "offline-audio-context",
    ] as const,
  };

  const missing = {
    timeline: missingCapabilities(requirements.timeline, capabilities),
    imagePreview: missingCapabilities(requirements.imagePreview, capabilities),
    videoPreview: missingCapabilities(requirements.videoPreview, capabilities),
    audioPlayback: missingCapabilities(requirements.audioPlayback, capabilities),
    videoExport: missingCapabilities(requirements.videoExport, capabilities),
    audioExport: missingCapabilities(requirements.audioExport, capabilities),
  };

  return {
    capabilities,
    ready: {
      timeline: missing.timeline.length === 0,
      imagePreview: missing.imagePreview.length === 0,
      videoPreview: missing.videoPreview.length === 0,
      audioPlayback: missing.audioPlayback.length === 0,
      videoExport: missing.videoExport.length === 0,
      audioExport: missing.audioExport.length === 0,
    },
    missing,
  };
};
