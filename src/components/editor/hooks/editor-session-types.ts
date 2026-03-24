import type { AssetRef } from "@/lib/editor/types";

export interface LocalAsset extends AssetRef {
  file?: File;
  objectUrl?: string;
}

export interface ExportActionResult {
  ok: boolean;
  message: string;
}
