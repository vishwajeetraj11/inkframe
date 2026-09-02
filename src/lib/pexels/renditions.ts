import type { PexelsVideoRendition } from "@/lib/pexels/types";

export interface TargetVideoResolution {
  width: number;
  height: number;
}

const renditionAspect = (rendition: PexelsVideoRendition): number =>
  rendition.width / Math.max(1, rendition.height);

/**
 * Pick an MP4 rendition that is closest to the requested canvas size. Ties go
 * to the larger file so an imported clip does not become unexpectedly soft.
 */
export const chooseMp4Rendition = (
  renditions: readonly PexelsVideoRendition[],
  target: TargetVideoResolution,
): PexelsVideoRendition | null => {
  const targetWidth = Math.max(1, target.width);
  const targetHeight = Math.max(1, target.height);
  const candidates = renditions.filter(
    (rendition) => rendition.fileType === "mp4" && rendition.url.length > 0 && rendition.width > 0 && rendition.height > 0,
  );
  return candidates
    .map((rendition) => {
      const sizeDistance = Math.abs(rendition.width - targetWidth) / targetWidth + Math.abs(rendition.height - targetHeight) / targetHeight;
      const aspectDistance = Math.abs(renditionAspect(rendition) - targetWidth / targetHeight);
      const upscalePenalty = rendition.width < targetWidth || rendition.height < targetHeight ? 0 : 0.001;
      return { rendition, score: sizeDistance + aspectDistance * 0.25 + upscalePenalty };
    })
    .sort((a, b) => a.score - b.score || b.rendition.width * b.rendition.height - a.rendition.width * a.rendition.height)[0]?.rendition ?? null;
};

export const selectBestVideoRendition = chooseMp4Rendition;
