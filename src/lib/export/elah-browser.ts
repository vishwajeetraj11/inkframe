import { lazyExportVideo, type Project as ElahProject } from "@elah/editor";
import { triggerBrowserDownload } from "./download";

export const ELAH_BROWSER_EXPORT_PROFILE = {
  container: "mp4",
  videoCodec: "h264",
  audioCodec: "aac",
  videoBitrate: 8_000_000,
  audioBitrate: 128_000,
} as const;

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
    videoCodec: "avc",
    audioCodec: ELAH_BROWSER_EXPORT_PROFILE.audioCodec,
    videoBitrate: ELAH_BROWSER_EXPORT_PROFILE.videoBitrate,
    audioBitrate: ELAH_BROWSER_EXPORT_PROFILE.audioBitrate,
    signal,
    onProgress,
  });
  const url = URL.createObjectURL(blob);
  triggerBrowserDownload({ url, filename });
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return blob;
};
