export type EditorExportStatus =
  | "idle"
  | "rendering"
  | "completed"
  | "failed"
  | "cancelled";

export interface EditorExportArtifact {
  jobId: string;
  filename: string;
  mimeType: string;
  bytes: number;
  durationInFrames: number;
  durationSeconds: number;
  container: "mp4";
  videoCodec: "h264";
  audioCodec: "aac" | null;
  videoBitrate: number;
  audioBitrate: number | null;
  width: number;
  height: number;
  fps: number;
  completedAt: string;
  /** Page-scoped Blob URL retained until the next export or editor teardown. */
  objectUrl: string;
  retainedUntil: "next-export-or-page-close";
  sha256: string | null;
  verification: {
    playable: boolean;
    containerSignature: "mp4" | "unknown";
    durationSeconds: number | null;
    width: number | null;
    height: number | null;
    error: string | null;
  };
}

export interface EditorExportState {
  jobId: string | null;
  status: EditorExportStatus;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  message: string | null;
  artifact: EditorExportArtifact | null;
}

export interface EditorFrameCapture {
  frame: number;
  width: number;
  height: number;
  mimeType?: "image/jpeg";
  dataUrl?: string;
  imageError?: string;
  contrastChecks: EditorContrastCheck[];
}

export interface EditorVisualReview {
  id: string;
  aspect: "reel_9_16" | "widescreen_16_9";
  createdAt: string;
  captures: EditorFrameCapture[];
  summary: {
    framesCaptured: number;
    failedContrastChecks: number;
    imageFailures: number;
  };
}

export interface EditorContrastCheck {
  overlayId: string;
  contrastRatio: number;
  minimumRatio: number;
  passes: boolean;
  sampledBackgroundLuminance: number;
  recommendedColor: "#ffffff" | "#000000";
}
