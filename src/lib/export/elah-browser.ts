import { lazyExportVideo, type Project as ElahProject } from "@elah/editor";
import { triggerBrowserDownload } from "./download";

export interface BrowserVideoExportOptions {
  filename: string;
  signal?: AbortSignal;
  onProgress?: (progress: { frame: number; totalFrames: number }) => void;
}

export const exportElahProjectInBrowser = async (
  project: ElahProject,
  { filename, signal, onProgress }: BrowserVideoExportOptions,
): Promise<Blob> => {
  const blob = await lazyExportVideo(project, {
    videoBitrate: 8_000_000,
    audioBitrate: 128_000,
    signal,
    onProgress,
  });
  const url = URL.createObjectURL(blob);
  triggerBrowserDownload({ url, filename });
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return blob;
};
