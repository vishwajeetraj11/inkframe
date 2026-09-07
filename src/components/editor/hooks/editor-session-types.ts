import type { AssetRef } from "@/lib/editor/types";
import type { EditorExportArtifact } from "@/lib/editor/export-state";
import type { ExportDiagnostic } from "@/lib/export/timeline-interchange";

export type {
  EditorExportArtifact,
  EditorExportState,
  EditorFrameCapture,
  EditorVisualReview,
} from "@/lib/editor/export-state";

export interface LocalAsset extends AssetRef {
  file?: File;
  objectUrl?: string;
}

export interface ExportActionResult {
  ok: boolean;
  message: string;
  export?: EditorExportArtifact;
  timelineExport?: {
    format: "fcpxml" | "edl" | "fcpxml-bundle";
    filename: string;
    diagnostics: ExportDiagnostic[];
  };
}

export type EditorStorageStatus =
  | "loading"
  | "saving"
  | "saved"
  | "error"
  | "unavailable";
