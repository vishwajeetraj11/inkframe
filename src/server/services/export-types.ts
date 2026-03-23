export interface BufferedExportResult {
  kind: "buffer";
  buffer: Buffer;
  contentType: string;
  filename: string;
}

export interface DownloadUrlExportResult {
  kind: "download-url";
  downloadUrl: string;
  filename: string;
}

export type ExportResult = BufferedExportResult | DownloadUrlExportResult;
