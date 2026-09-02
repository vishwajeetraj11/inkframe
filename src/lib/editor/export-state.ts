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

export interface EditorContrastCheck {
  overlayId: string;
  contrastRatio: number;
  minimumRatio: number;
  passes: boolean;
  sampledBackgroundLuminance: number;
  recommendedColor: "#ffffff" | "#000000";
}
