export interface ImportVideoOptions {
  signal?: AbortSignal;
  fileName?: string;
  onProgress?: (progress: number, loadedBytes: number, totalBytes: number | null) => void;
  fetcher?: typeof fetch;
}

export interface ImportedVideo {
  blob: Blob;
  file: File;
  fileName: string;
  mimeType: string;
  bytes: number;
}

const ensureHttpUrl = (value: string): URL => {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Video imports must use an HTTPS URL.");
  return url;
};

const contentDispositionFileName = (header: string | null): string | null => {
  const match = header?.match(/filename\*?=(?:UTF-8''|\")?([^;\"]+)/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1].trim()).replace(/[\\/]/g, "-").slice(0, 120);
  } catch {
    return null;
  }
};

const fallbackFileName = (url: URL): string => {
  const lastPathPart = url.pathname.split("/").filter(Boolean).at(-1);
  const clean = lastPathPart?.replace(/[^a-z0-9._-]/gi, "-");
  return clean?.toLowerCase().endsWith(".mp4") ? clean : `${clean || "pexels-footage"}.mp4`;
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException("The video import was cancelled.", "AbortError");
};

export const importVideoFromUrl = async (
  sourceUrl: string,
  options: ImportVideoOptions = {},
): Promise<ImportedVideo> => {
  const url = ensureHttpUrl(sourceUrl);
  throwIfAborted(options.signal);
  const response = await (options.fetcher ?? fetch)(url, { signal: options.signal, cache: "no-store" });
  if (!response.ok) throw new Error(`Video download failed (${response.status}).`);
  const contentType = response.headers.get("content-type")?.split(";", 1)[0] || "video/mp4";
  const totalHeader = Number(response.headers.get("content-length"));
  const totalBytes = Number.isFinite(totalHeader) && totalHeader > 0 ? totalHeader : null;
  let blob: Blob;

  if (!response.body) {
    blob = new Blob([await response.arrayBuffer()], { type: contentType });
    options.onProgress?.(1, blob.size, totalBytes ?? blob.size);
  } else {
    const reader = response.body.getReader();
    const chunks: ArrayBuffer[] = [];
    let loadedBytes = 0;
    try {
      for (;;) {
        throwIfAborted(options.signal);
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          const chunk = new Uint8Array(value.byteLength);
          chunk.set(value);
          chunks.push(chunk.buffer);
          loadedBytes += value.byteLength;
          options.onProgress?.(totalBytes ? Math.min(1, loadedBytes / totalBytes) : 0, loadedBytes, totalBytes);
        }
      }
    } finally {
      reader.releaseLock();
    }
    blob = new Blob(chunks, { type: contentType });
    options.onProgress?.(1, blob.size, totalBytes ?? blob.size);
  }

  const fileName = options.fileName?.trim() || contentDispositionFileName(response.headers.get("content-disposition")) || fallbackFileName(url);
  const file = new File([blob], fileName, { type: contentType });
  return { blob, file, fileName, mimeType: contentType, bytes: blob.size };
};

export const fetchVideoBlob = importVideoFromUrl;
