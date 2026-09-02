import type { AssetRef } from "@/lib/editor/types";
import type { EditorExportArtifact } from "@/lib/editor/export-state";

export type {
  EditorExportArtifact,
  EditorExportState,
  EditorFrameCapture,
} from "@/lib/editor/export-state";

export interface LocalAsset extends AssetRef {
  file?: File;
  objectUrl?: string;
}

export interface ExportActionResult {
  ok: boolean;
  message: string;
  export?: EditorExportArtifact;
}
