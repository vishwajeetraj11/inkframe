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
  const soloAudio = project.tracks.some(track => track.kind === "audio" && track.solo);
  const requiredAudioSources = new Set(Object.values(project.clips).flat().filter(clip => {
    const track = project.tracks.find(track => track.id === clip.trackId);
    return clip.type === "audio" && clip.src && !clip.disabled && (clip.volume ?? 1) > 0 &&
      track && (track.volume ?? 1) > 0 && !track.disabled && !track.muted &&
      (!soloAudio || track.solo);
  }).map(clip => clip.src));
  const blob = await lazyExportVideo(project, {
    videoCodec: "avc",
    audioCodec: ELAH_BROWSER_EXPORT_PROFILE.audioCodec,
    videoBitrate: ELAH_BROWSER_EXPORT_PROFILE.videoBitrate,
    audioBitrate: ELAH_BROWSER_EXPORT_PROFILE.audioBitrate,
    signal,
    onProgress,
    onAudioIssue: (message, source) => {
      // The mixer probes synthetic video sources and omits confirmed-silent
      // mirrors. Every remaining active soundtrack is required.
      if ((source && requiredAudioSources.has(source)) || (!source && requiredAudioSources.size > 0)) {
        throw new Error(`Required audio could not be exported: ${message}`);
      }
    },
  });
  const url = URL.createObjectURL(blob);
  triggerBrowserDownload({ url, filename });
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return blob;
};
