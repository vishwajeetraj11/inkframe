export interface BrowserVideoVerification {
  playable: boolean;
  containerSignature: "mp4" | "unknown";
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  error: string | null;
  sha256: string | null;
}

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");

const inspectMp4Signature = async (blob: Blob): Promise<"mp4" | "unknown"> => {
  const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  return new TextDecoder("ascii").decode(header.slice(4, 12)).includes("ftyp")
    ? "mp4"
    : "unknown";
};

const digestBlob = async (blob: Blob): Promise<string | null> => {
  // WebCrypto is not streaming. Avoid duplicating very large exports in memory.
  if (!globalThis.crypto?.subtle || blob.size > 64 * 1024 * 1024) return null;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return bytesToHex(new Uint8Array(digest));
};

const inspectPlayback = (
  objectUrl: string,
): Promise<Omit<BrowserVideoVerification, "containerSignature" | "sha256">> =>
  new Promise((resolve) => {
    const video = document.createElement("video");
    let settled = false;
    const finish = (
      value: Omit<BrowserVideoVerification, "containerSignature" | "sha256">,
    ) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };
    const timeout = window.setTimeout(() => {
      finish({
        playable: false,
        durationSeconds: null,
        width: null,
        height: null,
        error: "Browser playback verification timed out.",
      });
    }, 10_000);

    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      const durationSeconds = Number.isFinite(video.duration) ? video.duration : null;
      finish({
        playable: video.videoWidth > 0 && video.videoHeight > 0 && durationSeconds !== null,
        durationSeconds,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
        error: null,
      });
    };
    video.onerror = () => {
      finish({
        playable: false,
        durationSeconds: null,
        width: null,
        height: null,
        error: video.error?.message || "The browser could not decode the exported video.",
      });
    };
    video.src = objectUrl;
  });

export const verifyBrowserVideo = async (
  blob: Blob,
  objectUrl: string,
): Promise<BrowserVideoVerification> => {
  const [containerResult, digestResult, playbackResult] = await Promise.allSettled([
    inspectMp4Signature(blob),
    digestBlob(blob),
    inspectPlayback(objectUrl),
  ]);
  const playback = playbackResult.status === "fulfilled"
    ? playbackResult.value
    : {
        playable: false,
        durationSeconds: null,
        width: null,
        height: null,
        error: playbackResult.reason instanceof Error
          ? playbackResult.reason.message
          : "Browser playback verification failed.",
      };
  return {
    ...playback,
    containerSignature: containerResult.status === "fulfilled" ? containerResult.value : "unknown",
    sha256: digestResult.status === "fulfilled" ? digestResult.value : null,
  };
};
